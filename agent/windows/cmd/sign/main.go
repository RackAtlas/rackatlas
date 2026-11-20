// Release tool for the Windows agent updates. Runs on the developer machine, never on the server.
//
//	sign genkey <update.key> <update.pub>                          one time: a new key pair
//	sign manifest <update.key> <version> <out-dir> amd64=<exe> ... writes manifest.json and manifest.json.sig
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func die(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "sign: "+format+"\n", args...)
	os.Exit(1)
}

func main() {
	if len(os.Args) < 2 {
		die("usage: sign genkey|manifest ...")
	}

	switch os.Args[1] {
	case "genkey":
		if len(os.Args) != 4 {
			die("usage: sign genkey <update.key> <update.pub>")
		}

		pub, priv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			die("%v", err)
		}

		if err := os.WriteFile(os.Args[2], []byte(base64.StdEncoding.EncodeToString(priv)+"\n"), 0o600); err != nil {
			die("%v", err)
		}

		if err := os.WriteFile(os.Args[3], []byte(base64.StdEncoding.EncodeToString(pub)+"\n"), 0o644); err != nil {
			die("%v", err)
		}
	case "manifest":
		if len(os.Args) < 6 {
			die("usage: sign manifest <update.key> <version> <out-dir> amd64=<exe> [arm64=<exe>]")
		}

		encoded, err := os.ReadFile(os.Args[2])
		if err != nil {
			die("%v", err)
		}

		priv, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(encoded)))
		if err != nil || len(priv) != ed25519.PrivateKeySize {
			die("%s is not a valid private key", os.Args[2])
		}

		type file struct {
			Path   string `json:"path"`
			SHA256 string `json:"sha256"`
		}

		m := struct {
			Version string          `json:"version"`
			Files   map[string]file `json:"files"`
		}{Version: os.Args[3], Files: map[string]file{}}

		for _, arg := range os.Args[5:] {
			arch, path, found := strings.Cut(arg, "=")
			if !found {
				die("expected arch=file, got %q", arg)
			}

			data, err := os.ReadFile(path)
			if err != nil {
				die("%v", err)
			}

			sum := sha256.Sum256(data)
			m.Files[arch] = file{Path: "agent/windows/" + filepath.Base(path), SHA256: hex.EncodeToString(sum[:])}
		}

		raw, _ := json.MarshalIndent(m, "", "  ")
		signature := ed25519.Sign(ed25519.PrivateKey(priv), raw)

		if err := os.WriteFile(filepath.Join(os.Args[4], "manifest.json"), raw, 0o644); err != nil {
			die("%v", err)
		}

		if err := os.WriteFile(filepath.Join(os.Args[4], "manifest.json.sig"), []byte(base64.StdEncoding.EncodeToString(signature)+"\n"), 0o644); err != nil {
			die("%v", err)
		}
	default:
		die("unknown command %q", os.Args[1])
	}
}
