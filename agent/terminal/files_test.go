package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// recorder collects what the file server emits and lets a test wait for a frame.
type recorder struct {
	mu     sync.Mutex
	frames []map[string]any
}

func (r *recorder) emit(m map[string]any) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.frames = append(r.frames, m)
}

func (r *recorder) wait(t *testing.T, match func(map[string]any) bool) map[string]any {
	t.Helper()

	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(5 * time.Millisecond) {
		r.mu.Lock()
		for _, f := range r.frames {
			if match(f) {
				r.mu.Unlock()
				return f
			}
		}
		r.mu.Unlock()
	}

	t.Fatalf("frame not seen, got %v", r.frames)

	return nil
}

func ofType(kind string, rid int64) func(map[string]any) bool {
	return func(m map[string]any) bool {
		got, _ := m["rid"].(int64)

		return m["t"] == kind && (rid == 0 || got == rid)
	}
}

func request(t *testing.T, s *fileServer, m map[string]any) {
	t.Helper()
	line, _ := json.Marshal(m)
	s.handle(line)
}

func TestListShowsFoldersFilesAndLinks(t *testing.T) {
	dir := t.TempDir()
	os.Mkdir(filepath.Join(dir, "sub"), 0o755)
	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hello"), 0o644)
	os.Symlink(filepath.Join(dir, "sub"), filepath.Join(dir, "link"))

	r := &recorder{}
	s := newFileServer(r.emit)
	request(t, s, map[string]any{"t": "ls", "rid": int64(1), "path": dir})
	frame := r.wait(t, ofType("ls", 1))

	dirs := map[string]bool{}
	for _, e := range frame["entries"].([]map[string]any) {
		dirs[e["name"].(string)] = e["dir"].(bool)
	}

	if len(dirs) != 3 || dirs["a.txt"] || !dirs["sub"] || !dirs["link"] {
		t.Fatalf("unexpected listing %v", dirs)
	}
}

func TestListOfMissingFolderFails(t *testing.T) {
	r := &recorder{}
	s := newFileServer(r.emit)
	request(t, s, map[string]any{"t": "ls", "rid": int64(2), "path": filepath.Join(t.TempDir(), "nope")})
	r.wait(t, ofType("fs-error", 2))
}

func TestDownloadSendsTheWholeFileWithFlowControl(t *testing.T) {
	dir := t.TempDir()
	content := make([]byte, fileChunk*20+17)
	rand.Read(content)
	path := filepath.Join(dir, "big.bin")
	os.WriteFile(path, content, 0o644)

	r := &recorder{}
	s := newFileServer(r.emit)
	request(t, s, map[string]any{"t": "get", "rid": int64(3), "path": path})

	var got []byte
	seen := 0

	for done := false; !done; {
		time.Sleep(10 * time.Millisecond)

		r.mu.Lock()
		frames := r.frames[seen:]
		seen = len(r.frames)
		r.mu.Unlock()

		for _, f := range frames {
			if f["t"] == "fs-error" {
				t.Fatalf("error %v", f)
			}

			if f["t"] == "file" && f["last"] == true {
				done = true
			} else if f["t"] == "file" {
				data, _ := base64.StdEncoding.DecodeString(f["data"].(string))
				got = append(got, data...)
				request(t, s, map[string]any{"t": "more", "rid": int64(3)})
			}
		}
	}

	if !bytes.Equal(got, content) {
		t.Fatal("the downloaded data differs")
	}

	audit := r.wait(t, func(m map[string]any) bool { return m["t"] == "audit" })
	if audit["direction"] != "download" || audit["bytes"].(int64) != int64(len(content)) {
		t.Fatalf("bad audit %v", audit)
	}
}

func TestDownloadStopsWithoutCredit(t *testing.T) {
	path := filepath.Join(t.TempDir(), "big.bin")
	os.WriteFile(path, make([]byte, fileChunk*(downloadWindow+10)), 0o644)

	r := &recorder{}
	s := newFileServer(r.emit)
	request(t, s, map[string]any{"t": "get", "rid": int64(4), "path": path})
	time.Sleep(200 * time.Millisecond)

	r.mu.Lock()
	count := len(r.frames)
	r.mu.Unlock()

	if count != downloadWindow {
		t.Fatalf("expected %d chunks before the first credit, got %d", downloadWindow, count)
	}

	request(t, s, map[string]any{"t": "cancel", "rid": int64(4)})
}

func TestDownloadRefusesFoldersAndMissingFiles(t *testing.T) {
	r := &recorder{}
	s := newFileServer(r.emit)
	request(t, s, map[string]any{"t": "get", "rid": int64(5), "path": t.TempDir()})
	if r.wait(t, ofType("fs-error", 5))["code"] != "directory" {
		t.Fatal("expected the directory code")
	}

	request(t, s, map[string]any{"t": "get", "rid": int64(6), "path": "/definitely/missing"})
	r.wait(t, ofType("fs-error", 6))
}

func upload(t *testing.T, s *fileServer, r *recorder, rid int64, dir, name string, content []byte, overwrite bool) map[string]any {
	t.Helper()

	request(t, s, map[string]any{"t": "put", "rid": rid, "path": dir, "name": name, "size": len(content), "overwrite": overwrite})

	first := r.wait(t, func(m map[string]any) bool {
		got, _ := m["rid"].(int64)

		return got == rid && (m["t"] == "put" || m["t"] == "fs-error")
	})

	if first["t"] == "fs-error" {
		return first
	}

	for i := 0; i < len(content); i += fileChunk {
		end := min(i+fileChunk, len(content))
		request(t, s, map[string]any{"t": "chunk", "rid": rid, "data": base64.StdEncoding.EncodeToString(content[i:end])})
	}

	request(t, s, map[string]any{"t": "done", "rid": rid})

	return r.wait(t, func(m map[string]any) bool {
		got, _ := m["rid"].(int64)

		return got == rid && m["t"] == "put" && m["state"] == "done"
	})
}

func TestUploadWritesTheFileAtomically(t *testing.T) {
	dir := t.TempDir()
	content := make([]byte, fileChunk*3+5)
	rand.Read(content)

	r := &recorder{}
	s := newFileServer(r.emit)
	upload(t, s, r, 7, dir, "new.bin", content, false)

	written, err := os.ReadFile(filepath.Join(dir, "new.bin"))
	if err != nil || !bytes.Equal(written, content) {
		t.Fatalf("file not written correctly: %v", err)
	}

	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Fatalf("a temporary file was left behind: %v", entries)
	}

	audit := r.wait(t, func(m map[string]any) bool { return m["t"] == "audit" })
	if audit["direction"] != "upload" {
		t.Fatalf("bad audit %v", audit)
	}
}

func TestUploadAsksBeforeReplacingAndKeepsTheOldFileUntilDone(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "a.txt")
	os.WriteFile(target, []byte("old"), 0o600)

	r := &recorder{}
	s := newFileServer(r.emit)

	if upload(t, s, r, 8, dir, "a.txt", []byte("new"), false)["code"] != "exists" {
		t.Fatal("expected the exists code")
	}

	// A cancelled replacement leaves the old file alone.
	request(t, s, map[string]any{"t": "put", "rid": int64(9), "path": dir, "name": "a.txt", "size": 3, "overwrite": true})
	r.wait(t, ofType("put", 9))
	request(t, s, map[string]any{"t": "chunk", "rid": int64(9), "data": base64.StdEncoding.EncodeToString([]byte("zzz"))})
	request(t, s, map[string]any{"t": "cancel", "rid": int64(9)})

	if data, _ := os.ReadFile(target); string(data) != "old" {
		t.Fatalf("the old file changed: %q", data)
	}

	if entries, _ := os.ReadDir(dir); len(entries) != 1 {
		t.Fatalf("a temporary file was left behind: %v", entries)
	}

	upload(t, s, r, 10, dir, "a.txt", []byte("new"), true)

	info, _ := os.Stat(target)
	if data, _ := os.ReadFile(target); string(data) != "new" || info.Mode().Perm() != 0o600 {
		t.Fatalf("replacement wrong: %q %v", data, info.Mode())
	}
}

func TestUploadRefusesBadNamesAndTooLargeFiles(t *testing.T) {
	dir := t.TempDir()
	r := &recorder{}
	s := newFileServer(r.emit)

	for i, name := range []string{"", ".", "..", "a/b", "../x", "a\x00b"} {
		got := upload(t, s, r, int64(20+i), dir, name, []byte("x"), false)
		if got["code"] != "name" {
			t.Fatalf("name %q was not refused: %v", name, got)
		}
	}

	request(t, s, map[string]any{"t": "put", "rid": int64(30), "path": dir, "name": "big", "size": maxFileBytes + 1})
	if r.wait(t, ofType("fs-error", 30))["code"] != "too-large" {
		t.Fatal("expected too-large")
	}

	if entries, _ := os.ReadDir(dir); len(entries) != 0 {
		t.Fatalf("something was written: %v", entries)
	}
}

func TestTooManyTransfersAtOnce(t *testing.T) {
	dir := t.TempDir()
	r := &recorder{}
	s := newFileServer(r.emit)

	for i := 0; i < maxTransfers; i++ {
		request(t, s, map[string]any{"t": "put", "rid": int64(40 + i), "path": dir, "name": "f" + string(rune('a'+i)), "size": 1})
		r.wait(t, ofType("put", int64(40+i)))
	}

	request(t, s, map[string]any{"t": "put", "rid": int64(50), "path": dir, "name": "extra", "size": 1})
	if r.wait(t, ofType("fs-error", 50))["code"] != "busy" {
		t.Fatal("expected busy")
	}

	s.close()

	if entries, _ := os.ReadDir(dir); len(entries) != 0 {
		t.Fatalf("closing left temporary files: %v", entries)
	}
}

func TestFileChannelHasItsOwnKeys(t *testing.T) {
	secret := make([]byte, 32)
	salt := make([]byte, 32)
	rand.Read(secret)
	rand.Read(salt)

	shellService, _ := newSession(secret, salt, false)
	filesBrowser, _ := newSession(secret, salt, true, filesScope)
	filesService, _ := newSession(secret, salt, false, filesScope)

	frame := filesBrowser.seal([]byte(`{"t":"ls","rid":1}`))

	if plain, err := filesService.open(frame); err != nil || string(plain) != `{"t":"ls","rid":1}` {
		t.Fatalf("file channel round trip failed: %v", err)
	}

	if _, err := shellService.open(filesBrowser.seal([]byte("x"))); err == nil {
		t.Fatal("a file frame was accepted on the keystroke channel")
	}
}
