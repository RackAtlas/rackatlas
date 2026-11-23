// File transfer for the web terminal (listing, download, upload).
//
// It runs in a helper process, `rackatlas-terminal --files`, started as the terminal user, so a file is read
// and written with exactly the rights of that user and never with the root rights of the service. The service
// only relays: it decrypts a frame from the browser, writes it as one line to the helper and encrypts every
// line the helper answers with. The helper speaks the same JSON protocol as the SFTP part of the bridge
// (resources/terminal/server.mjs), one JSON object per line on stdin and stdout:
//
//	{"t":"ls","rid":1,"path":"/etc"}                  -> {"t":"ls","rid":1,"path":"/etc","entries":[..],"truncated":false}
//	{"t":"get","rid":2,"path":"/etc/hosts"}           -> {"t":"file","rid":2,"name":"hosts","size":N,"data":"<base64>"} ... {"t":"file","rid":2,"last":true}
//	{"t":"more","rid":2}                              a downloaded chunk was received, the next one may be sent
//	{"t":"put","rid":3,"path":"/tmp","name":"a.txt","size":N,"overwrite":false} -> {"t":"put","rid":3,"state":"ready","path":".."}
//	{"t":"chunk","rid":3,"data":"<base64>"}           -> {"t":"ack","rid":3}
//	{"t":"done","rid":3}                              -> {"t":"put","rid":3,"state":"done"}
//	{"t":"cancel","rid":3}
//
// A failure is {"t":"fs-error","rid":N,"code":"exists|directory|too-large|name|busy|failed","message":".."}.
// After a finished transfer the helper adds {"t":"audit","direction":"upload|download","path":"..","bytes":N}.
// The service does not forward that one to the browser, it reports it to the bridge for the activity log.
package main

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const (
	maxFileBytes   = 100 << 20
	fileChunk      = 96 * 1024
	maxTransfers   = 3
	maxListed      = 2000
	downloadWindow = 8
)

type fileRequest struct {
	T         string `json:"t"`
	Rid       int64  `json:"rid"`
	Path      string `json:"path"`
	Name      string `json:"name"`
	Size      int64  `json:"size"`
	Overwrite bool   `json:"overwrite"`
	Data      string `json:"data"`
}

type transfer struct {
	abort  chan struct{}
	once   sync.Once
	credit chan struct{}
	chunk  func(data []byte)
	done   func()
	clean  func()
}

func (t *transfer) cancel() {
	t.once.Do(func() {
		close(t.abort)

		if t.clean != nil {
			t.clean()
		}
	})
}

type fileServer struct {
	emit func(map[string]any)

	mu        sync.Mutex
	transfers map[int64]*transfer
}

func newFileServer(emit func(map[string]any)) *fileServer {
	return &fileServer{emit: emit, transfers: map[int64]*transfer{}}
}

// runFileHelper serves the protocol on stdin and stdout until stdin closes.
func runFileHelper(in io.Reader, out io.Writer) {
	var mu sync.Mutex
	writer := bufio.NewWriterSize(out, fileChunk*2)

	server := newFileServer(func(message map[string]any) {
		line, err := json.Marshal(message)
		if err != nil {
			return
		}

		mu.Lock()
		defer mu.Unlock()
		writer.Write(line)
		writer.WriteByte('\n')
		writer.Flush()
	})
	defer server.close()

	reader := bufio.NewReaderSize(in, fileChunk*4)

	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			server.handle(line)
		}

		if err != nil {
			return
		}
	}
}

func (s *fileServer) close() {
	s.mu.Lock()
	all := make([]*transfer, 0, len(s.transfers))
	for _, t := range s.transfers {
		all = append(all, t)
	}
	s.mu.Unlock()

	for _, t := range all {
		t.cancel()
	}
}

func (s *fileServer) fail(rid int64, code, message string) {
	s.emit(map[string]any{"t": "fs-error", "rid": rid, "code": code, "message": message})
}

// failure turns an error of the file system into a short sentence for the browser.
func (s *fileServer) failure(rid int64, err error) {
	switch {
	case errors.Is(err, fs.ErrPermission):
		s.fail(rid, "failed", "Permission denied.")
	case errors.Is(err, fs.ErrNotExist):
		s.fail(rid, "failed", "No such file or folder.")
	default:
		var pathErr *fs.PathError
		if errors.As(err, &pathErr) {
			err = pathErr.Err
		}

		s.fail(rid, "failed", err.Error())
	}
}

func (s *fileServer) start(rid int64, t *transfer) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.transfers) >= maxTransfers {
		return false
	}

	if previous, taken := s.transfers[rid]; taken {
		go previous.cancel()
	}

	s.transfers[rid] = t

	return true
}

func (s *fileServer) finish(rid int64, t *transfer) {
	s.mu.Lock()
	if s.transfers[rid] == t {
		delete(s.transfers, rid)
	}
	s.mu.Unlock()
}

func (s *fileServer) find(rid int64) *transfer {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.transfers[rid]
}

func (s *fileServer) handle(line []byte) {
	var request fileRequest

	if json.Unmarshal(line, &request) != nil {
		return
	}

	switch request.T {
	case "ls":
		s.list(request)
	case "get":
		s.download(request)
	case "put":
		s.upload(request)
	case "chunk":
		if t := s.find(request.Rid); t != nil && t.chunk != nil {
			data, err := base64.StdEncoding.DecodeString(request.Data)
			if err != nil {
				s.fail(request.Rid, "failed", "The data could not be read.")
				t.cancel()
				s.finish(request.Rid, t)

				return
			}

			t.chunk(data)
		}
	case "done":
		if t := s.find(request.Rid); t != nil && t.done != nil {
			t.done()
		}
	case "more":
		if t := s.find(request.Rid); t != nil && t.credit != nil {
			select {
			case t.credit <- struct{}{}:
			default:
			}
		}
	case "cancel":
		if t := s.find(request.Rid); t != nil {
			t.cancel()
			s.finish(request.Rid, t)
		}
	}
}

// resolveDir makes a path absolute and follows links. An empty path is the folder the helper started in (home).
func resolveDir(path string) (string, error) {
	if path == "" {
		path = "."
	}

	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}

	return filepath.EvalSymlinks(absolute)
}

func (s *fileServer) list(request fileRequest) {
	dir, err := resolveDir(request.Path)
	if err != nil {
		s.failure(request.Rid, err)

		return
	}

	items, err := os.ReadDir(dir)
	if err != nil {
		s.failure(request.Rid, err)

		return
	}

	truncated := len(items) > maxListed
	if truncated {
		items = items[:maxListed]
	}

	entries := make([]map[string]any, 0, len(items))

	for _, item := range items {
		// A link shows what it points to, a broken one shows itself.
		info, err := os.Stat(filepath.Join(dir, item.Name()))
		if err != nil {
			if info, err = item.Info(); err != nil {
				continue
			}
		}

		entries = append(entries, map[string]any{
			"name":  item.Name(),
			"dir":   info.IsDir(),
			"size":  info.Size(),
			"mtime": info.ModTime().Unix(),
		})
	}

	s.emit(map[string]any{"t": "ls", "rid": request.Rid, "path": dir, "entries": entries, "truncated": truncated})
}

func (s *fileServer) download(request fileRequest) {
	rid := request.Rid

	info, err := os.Stat(request.Path)
	if err != nil {
		s.failure(rid, err)

		return
	}

	if info.IsDir() {
		s.fail(rid, "directory", "A folder cannot be downloaded.")

		return
	}

	if info.Size() > maxFileBytes {
		s.fail(rid, "too-large", "The file is too large.")

		return
	}

	file, err := os.Open(request.Path)
	if err != nil {
		s.failure(rid, err)

		return
	}

	current := &transfer{abort: make(chan struct{}), credit: make(chan struct{}, 1024)}
	current.clean = func() { file.Close() }

	if !s.start(rid, current) {
		file.Close()
		s.fail(rid, "busy", "Too many transfers at once.")

		return
	}

	name := filepath.Base(request.Path)

	go func() {
		defer s.finish(rid, current)
		defer file.Close()

		buffer := make([]byte, fileChunk)
		sent := int64(0)
		chunks := 0

		for {
			n, err := file.Read(buffer)

			if n > 0 {
				// The browser says with "more" that it took a chunk, so a slow link never piles data up.
				if chunks >= downloadWindow {
					select {
					case <-current.credit:
					case <-current.abort:
						return
					}
				}

				sent += int64(n)
				chunks++

				if sent > maxFileBytes {
					s.fail(rid, "too-large", "The file is too large.")

					return
				}

				select {
				case <-current.abort:
					return
				default:
				}

				s.emit(map[string]any{"t": "file", "rid": rid, "name": name, "size": info.Size(), "data": base64.StdEncoding.EncodeToString(buffer[:n])})
			}

			if err == io.EOF {
				break
			}

			if err != nil {
				s.failure(rid, err)

				return
			}
		}

		s.emit(map[string]any{"t": "file", "rid": rid, "last": true})
		s.emit(map[string]any{"t": "audit", "direction": "download", "path": request.Path, "bytes": sent})
	}()
}

func validFileName(name string) bool {
	return name != "" && name != "." && name != ".." && len(name) <= 255 && !strings.ContainsAny(name, "/\x00")
}

func (s *fileServer) upload(request fileRequest) {
	rid := request.Rid

	if !validFileName(request.Name) {
		s.fail(rid, "name", "The file name is not allowed.")

		return
	}

	if request.Size > maxFileBytes {
		s.fail(rid, "too-large", "The file is too large.")

		return
	}

	dir, err := resolveDir(request.Path)
	if err != nil {
		s.failure(rid, err)

		return
	}

	target := filepath.Join(dir, request.Name)
	mode := fs.FileMode(0o644)
	existing, statErr := os.Stat(target)

	if statErr == nil {
		if !request.Overwrite {
			s.fail(rid, "exists", "A file with this name already exists.")

			return
		}

		if existing.IsDir() {
			s.fail(rid, "directory", "A folder with this name exists.")

			return
		}

		mode = existing.Mode().Perm()
	}

	// The data is written next to the target and moved into place at the end, so a cancelled or failed
	// upload never leaves half a file (or destroys the file that is being replaced).
	temp, err := os.CreateTemp(dir, ".rackatlas-upload-*")
	if err != nil {
		s.failure(rid, err)

		return
	}

	current := &transfer{abort: make(chan struct{})}
	written := int64(0)
	closed := false

	discard := func() {
		if !closed {
			closed = true
			temp.Close()
		}

		os.Remove(temp.Name())
	}

	current.clean = discard

	if !s.start(rid, current) {
		discard()
		s.fail(rid, "busy", "Too many transfers at once.")

		return
	}

	abort := func(code, message string) {
		current.cancel()
		s.finish(rid, current)
		s.fail(rid, code, message)
	}

	current.chunk = func(data []byte) {
		written += int64(len(data))

		if written > maxFileBytes {
			abort("too-large", "The file is too large.")

			return
		}

		if _, err := temp.Write(data); err != nil {
			current.cancel()
			s.finish(rid, current)
			s.failure(rid, err)

			return
		}

		s.emit(map[string]any{"t": "ack", "rid": rid})
	}

	current.done = func() {
		defer s.finish(rid, current)

		err := temp.Chmod(mode)

		if closeErr := temp.Close(); err == nil {
			err = closeErr
		}

		closed = true

		if err == nil {
			err = os.Rename(temp.Name(), target)
		}

		if err != nil {
			os.Remove(temp.Name())
			s.failure(rid, err)

			return
		}

		s.emit(map[string]any{"t": "put", "rid": rid, "state": "done"})
		s.emit(map[string]any{"t": "audit", "direction": "upload", "path": target, "bytes": written})
	}

	s.emit(map[string]any{"t": "put", "rid": rid, "state": "ready", "path": target})
}
