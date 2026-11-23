package main

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"os/user"
	"sync"

	"github.com/gorilla/websocket"
)

// fileHelper is the process that serves the files of one shell, started as the terminal user.
type fileHelper struct {
	cmd   *exec.Cmd
	lines chan []byte
	stdin io.WriteCloser
	done  chan struct{}
	once  sync.Once
}

func (h *fileHelper) stop() {
	h.once.Do(func() { close(h.done) })
	h.stdin.Close()

	if h.cmd.Process != nil {
		h.cmd.Process.Kill()
	}

	go h.cmd.Wait()
}

// closeFiles ends the helper, which cancels its transfers and removes unfinished uploads.
func (s *shell) closeFiles() {
	s.mu.Lock()
	helper := s.helper
	s.helper = nil
	s.mu.Unlock()

	if helper != nil {
		helper.stop()
	}
}

// fileInput takes one encrypted frame of the file channel and hands it to the helper of that shell.
func (c *connection) fileInput(id uint32, data []byte) {
	c.shMu.Lock()
	s := c.shells[id]
	c.shMu.Unlock()

	if s == nil {
		return
	}

	s.mu.Lock()
	files := s.files
	s.mu.Unlock()

	if files == nil {
		// Like keystrokes, files are never accepted before the handshake.
		return
	}

	plain, err := files.open(data)
	if err != nil {
		c.status("error", id, "The encrypted data could not be verified.")
		s.stop()
		return
	}

	helper, err := c.helperFor(id, s)
	if err != nil {
		c.status("error", id, "The file service could not be started.")
		s.stop()
		return
	}

	select {
	case helper.lines <- append(plain, '\n'):
	default:
		c.status("error", id, "The file transfer is too slow.")
		s.stop()
	}
}

// helperFor starts the helper of a shell when the first file frame arrives.
func (c *connection) helperFor(id uint32, s *shell) (*fileHelper, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.helper != nil {
		return s.helper, nil
	}

	account, err := user.Lookup(c.cfg.terminalUser)
	if err != nil {
		return nil, err
	}

	executable, err := os.Executable()
	if err != nil {
		return nil, err
	}

	cmd := exec.Command(executable, "--files")
	cmd.Dir = account.HomeDir
	cmd.Env = []string{
		"HOME=" + account.HomeDir,
		"USER=" + account.Username,
		"LOGNAME=" + account.Username,
		"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
	}
	cmd.SysProcAttr = credentialFor(account)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	helper := &fileHelper{cmd: cmd, stdin: stdin, lines: make(chan []byte, 256), done: make(chan struct{})}

	go func() {
		for {
			select {
			case line := <-helper.lines:
				if _, err := stdin.Write(line); err != nil {
					return
				}
			case <-helper.done:
				return
			}
		}
	}()

	go c.relayFiles(id, s, stdout)

	s.helper = helper

	return helper, nil
}

// relayFiles encrypts what the helper answers. A finished transfer is also reported to the bridge, without content.
func (c *connection) relayFiles(id uint32, s *shell, stdout io.Reader) {
	reader := bufio.NewReaderSize(stdout, 256*1024)
	prefix := make([]byte, 4)
	binary.BigEndian.PutUint32(prefix, id|fileFlag)

	for {
		line, err := reader.ReadBytes('\n')

		if len(line) > 1 {
			line = line[:len(line)-1]

			var head struct {
				T         string `json:"t"`
				Direction string `json:"direction"`
				Path      string `json:"path"`
				Bytes     int64  `json:"bytes"`
			}

			if json.Unmarshal(line, &head) == nil && head.T == "audit" {
				report, _ := json.Marshal(map[string]any{"t": "file", "id": id, "direction": head.Direction, "path": head.Path, "bytes": head.Bytes})
				c.send(websocket.TextMessage, report)
			} else {
				s.fileMu.Lock()
				sealed := s.files.seal(line)
				c.send(websocket.BinaryMessage, append(append([]byte{}, prefix...), sealed...))
				s.fileMu.Unlock()
			}
		}

		if err != nil {
			return
		}
	}
}
