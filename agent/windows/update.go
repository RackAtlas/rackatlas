package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// Self-update. RackAtlas serves /agent/windows/manifest.json and /agent/windows/manifest.json.sig. The signature
// is made offline with the private key of the owner (agent/windows/update.key, never on the server), the agent
// holds the public key. A server that is taken over can therefore not push a binary to the machines.
//
//	manifest: {"version":"1.2.0","files":{"amd64":{"path":"agent/windows/rackatlas-agent-amd64.exe","sha256":"..."}}}

type manifest struct {
	Version string `json:"version"`
	Files   map[string]struct {
		Path   string `json:"path"`
		SHA256 string `json:"sha256"`
	} `json:"files"`
}

// pending marks an update that has not proved itself yet.
type pending struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Attempts int    `json:"attempts"`
}

func get(cfg config, path string, limit int64) ([]byte, error) {
	res, err := httpClient.Get(cfg.URL + "/" + strings.TrimLeft(path, "/"))
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s answered %d", path, res.StatusCode)
	}

	return io.ReadAll(io.LimitReader(res.Body, limit))
}

// newerVersion compares dotted numbers: "1.10.0" > "1.9.0".
func newerVersion(candidate, current string) bool {
	parts := func(v string) [3]int {
		var n [3]int
		fmt.Sscanf(strings.TrimPrefix(v, "v"), "%d.%d.%d", &n[0], &n[1], &n[2])

		return n
	}

	a, b := parts(candidate), parts(current)
	for i := range a {
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}

	return false
}

// checkUpdate downloads and verifies a newer version. It returns the path of the verified file and the version, or
// "" when there is nothing to do.
func checkUpdate(cfg config) (string, string, error) {
	if updateKey == "" || version == "dev" {
		return "", "", nil
	}

	key, err := base64.StdEncoding.DecodeString(updateKey)
	if err != nil || len(key) != ed25519.PublicKeySize {
		return "", "", errors.New("the built-in update key is invalid")
	}

	raw, err := get(cfg, "agent/windows/manifest.json", 64*1024)
	if err != nil {
		return "", "", err
	}

	signature, err := get(cfg, "agent/windows/manifest.json.sig", 1024)
	if err != nil {
		return "", "", err
	}

	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(signature)))
	if err != nil || !ed25519.Verify(ed25519.PublicKey(key), raw, decoded) {
		return "", "", errors.New("the signature of the update manifest is not valid")
	}

	var m manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return "", "", err
	}

	if !newerVersion(m.Version, version) {
		return "", "", nil
	}

	file, ok := m.Files[runtime.GOARCH]
	if !ok || !strings.HasPrefix(file.Path, "agent/windows/") || strings.Contains(file.Path, "..") {
		return "", "", fmt.Errorf("no update for %s", runtime.GOARCH)
	}

	binary, err := get(cfg, file.Path, 64*1024*1024)
	if err != nil {
		return "", "", err
	}

	sum := sha256.Sum256(binary)
	if !strings.EqualFold(hex.EncodeToString(sum[:]), file.SHA256) {
		return "", "", errors.New("the downloaded update does not match the signed checksum")
	}

	if len(binary) < 2 || binary[0] != 'M' || binary[1] != 'Z' {
		return "", "", errors.New("the downloaded update is not a Windows program")
	}

	dir := filepath.Join(dataDir(), "update")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", "", err
	}

	path := filepath.Join(dir, "rackatlas-agent-"+m.Version+".exe")
	if err := os.WriteFile(path, binary, 0o700); err != nil {
		return "", "", err
	}

	return path, m.Version, nil
}

func pendingPath() string { return filepath.Join(stateDir(), "update-pending.json") }

// installUpdate swaps the files. A running program can be renamed on Windows, so the old one is kept as .old
// (the rollback) and the new one takes its place; the caller then stops the service and Windows starts it again.
func installUpdate(newPath, newVersion string) error {
	current, err := os.Executable()
	if err != nil {
		return err
	}

	old := current + ".old"
	os.Remove(old)

	if err := os.Rename(current, old); err != nil {
		return err
	}

	if err := moveFile(newPath, current); err != nil {
		os.Rename(old, current)

		return err
	}

	writeJSON(pendingPath(), pending{From: version, To: newVersion})

	return nil
}

func moveFile(from, to string) error {
	if os.Rename(from, to) == nil {
		return nil
	}

	data, err := os.ReadFile(from)
	if err != nil {
		return err
	}

	if err := os.WriteFile(to, data, 0o755); err != nil {
		return err
	}

	return os.Remove(from)
}

// startupCheck runs when the agent starts. A new version that does not manage to send one good report in three
// starts is replaced by the old one. It returns true when the old version was put back and the process must exit.
func startupCheck() bool {
	var p pending
	if !readJSON(pendingPath(), &p) {
		return false
	}

	p.Attempts++

	if p.Attempts <= 3 {
		writeJSON(pendingPath(), p)

		return false
	}

	current, err := os.Executable()
	if err != nil {
		return false
	}

	old := current + ".old"
	if _, err := os.Stat(old); err != nil {
		os.Remove(pendingPath())

		return false
	}

	os.Rename(current, current+".bad")
	if os.Rename(old, current) != nil {
		return false
	}

	os.Remove(pendingPath())

	return true
}

// updateProven is called after the first accepted report of a new version.
func updateProven() {
	var p pending
	if !readJSON(pendingPath(), &p) {
		return
	}

	os.Remove(pendingPath())

	if current, err := os.Executable(); err == nil {
		os.Remove(current + ".old")
		os.Remove(current + ".bad")
	}

	os.RemoveAll(filepath.Join(dataDir(), "update"))
}

var lastUpdateCheck time.Time
