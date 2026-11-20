//go:build windows

package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

func installDir() string {
	base := os.Getenv("ProgramFiles")
	if base == "" {
		base = `C:\Program Files`
	}

	return filepath.Join(base, "RackAtlas")
}

func installedExe() string { return filepath.Join(installDir(), "rackatlas-agent.exe") }

// fileLog writes to agent.log in the data directory and keeps it below about 1 MB.
func fileLog() func(string, ...any) {
	path := filepath.Join(dataDir(), "agent.log")

	return func(format string, args ...any) {
		if info, err := os.Stat(path); err == nil && info.Size() > 1<<20 {
			os.Remove(path + ".1")
			os.Rename(path, path+".1")
		}

		file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
		if err != nil {
			return
		}
		defer file.Close()

		fmt.Fprintf(file, "%s %s\n", time.Now().Format("2006-01-02 15:04:05"), fmt.Sprintf(format, args...))
	}
}

type agentService struct{}

func (agentService) Execute(_ []string, requests <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	logf := fileLog()
	os.MkdirAll(stateDir(), 0o700)

	status <- svc.Status{State: svc.StartPending}

	if startupCheck() {
		logf("the new version did not start properly, the previous version was put back")

		return true, 1
	}

	stop := make(chan struct{})
	done := make(chan bool, 1)

	go func() { done <- loop(stop, logf) }()

	status <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}
	logf("rackatlas-agent %s started", version)

	for {
		select {
		case restart := <-done:
			if restart {
				// A failure exit code: the recovery action of the service starts the new program.
				return true, 1
			}

			return false, 0
		case request := <-requests:
			switch request.Cmd {
			case svc.Interrogate:
				status <- request.CurrentStatus
			case svc.Stop, svc.Shutdown:
				status <- svc.Status{State: svc.StopPending}
				close(stop)

				select {
				case <-done:
				case <-time.After(20 * time.Second):
				}

				return false, 0
			}
		}
	}
}

func runCommand(bool) error {
	isService, err := svc.IsWindowsService()
	if err != nil {
		return err
	}

	if isService {
		return svc.Run(serviceName, agentService{})
	}

	// In a console: runs until Ctrl+C.
	stop := make(chan struct{})
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-signals
		close(stop)
	}()

	if startupCheck() {
		return errors.New("the previous version was put back, start the agent again")
	}

	loop(stop, consoleLog)

	return nil
}

func lockDownDataDir() {
	// Only SYSTEM and Administrators: the token is in agent.conf.
	exec.Command("icacls.exe", dataDir(), "/inheritance:r", "/grant:r", "*S-1-5-18:(OI)(CI)F", "*S-1-5-32-544:(OI)(CI)F").Run()
}

func copyFile(from, to string) error {
	in, err := os.Open(from)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(to, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
	if err != nil {
		return err
	}

	if _, err := io.Copy(out, in); err != nil {
		out.Close()

		return err
	}

	return out.Close()
}

func installCommand(args []string) error {
	fs := flag.NewFlagSet("install", flag.ContinueOnError)
	url := fs.String("url", "", "address of RackAtlas, https://...")
	token := fs.String("token", os.Getenv("RACKATLAS_TOKEN"), "agent token (or the RACKATLAS_TOKEN variable)")
	noUpdate := fs.Bool("no-update", false, "do not update the agent automatically")
	if err := fs.Parse(args); err != nil {
		return err
	}

	cfg := config{URL: strings.TrimRight(*url, "/"), Token: strings.TrimSpace(*token), AutoUpdate: !*noUpdate}
	if err := cfg.validate(); err != nil {
		return err
	}

	manager, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("run this from an elevated (Administrator) PowerShell: %w", err)
	}
	defer manager.Disconnect()

	self, err := os.Executable()
	if err != nil {
		return err
	}

	// An existing installation is stopped first so that its file can be replaced.
	existing, err := manager.OpenService(serviceName)
	if err == nil {
		stopService(existing)
	}

	if err := os.MkdirAll(installDir(), 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(stateDir(), 0o700); err != nil {
		return err
	}

	target := installedExe()
	if !strings.EqualFold(self, target) {
		os.Remove(target + ".old")
		os.Rename(target, target+".old")

		if err := copyFile(self, target); err != nil {
			return fmt.Errorf("could not copy the program to %s: %w", target, err)
		}
	}

	content := fmt.Sprintf("URL=%s\nTOKEN=%s\nAUTO_UPDATE=%d\n", cfg.URL, cfg.Token, map[bool]int{true: 1, false: 0}[cfg.AutoUpdate])
	if err := os.WriteFile(confPath(), []byte(content), 0o600); err != nil {
		return err
	}
	lockDownDataDir()

	// The previous reports belong to the old token; starting over avoids stale cursors.
	os.RemoveAll(stateDir())
	os.MkdirAll(stateDir(), 0o700)

	handle := existing
	if handle == nil {
		handle, err = manager.CreateService(serviceName, target, mgr.Config{
			DisplayName: displayName,
			Description: description,
			StartType:   mgr.StartAutomatic,
		}, "run")
		if err != nil {
			return fmt.Errorf("could not create the service: %w", err)
		}
	} else {
		current, _ := handle.Config()
		current.BinaryPathName = `"` + target + `" run`
		current.StartType = mgr.StartAutomatic
		handle.UpdateConfig(current)
	}
	defer handle.Close()

	// Restart on a crash, and when the program exits to apply an update.
	handle.SetRecoveryActions([]mgr.RecoveryAction{
		{Type: mgr.ServiceRestart, Delay: 5 * time.Second},
		{Type: mgr.ServiceRestart, Delay: 30 * time.Second},
		{Type: mgr.ServiceRestart, Delay: time.Minute},
	}, 86400)
	handle.SetRecoveryActionsOnNonCrashFailures(true)

	if err := handle.Start(); err != nil && !strings.Contains(err.Error(), "already running") {
		return fmt.Errorf("the service was installed but did not start: %w", err)
	}

	fmt.Printf("RackAtlas agent %s installed and started. Log: %s\n", version, filepath.Join(dataDir(), "agent.log"))

	return nil
}

func stopService(handle *mgr.Service) {
	defer handle.Close()

	status, err := handle.Control(svc.Stop)
	if err != nil {
		return
	}

	for deadline := time.Now().Add(30 * time.Second); status.State != svc.Stopped && time.Now().Before(deadline); {
		time.Sleep(300 * time.Millisecond)
		if status, err = handle.Query(); err != nil {
			return
		}
	}
}

func uninstallCommand(args []string) error {
	fs := flag.NewFlagSet("uninstall", flag.ContinueOnError)
	purge := fs.Bool("purge", false, "also delete the configuration and the state")
	if err := fs.Parse(args); err != nil {
		return err
	}

	manager, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("run this from an elevated (Administrator) PowerShell: %w", err)
	}
	defer manager.Disconnect()

	if handle, err := manager.OpenService(serviceName); err == nil {
		stopService(handle)

		handle, _ = manager.OpenService(serviceName)
		if handle != nil {
			handle.Delete()
			handle.Close()
		}
	}

	if *purge {
		os.RemoveAll(dataDir())
	}

	// The running program cannot delete itself; a short command does it after the exit.
	dir := installDir()
	cmd := exec.Command("cmd.exe", "/c", fmt.Sprintf(`ping -n 3 127.0.0.1 >nul & rmdir /s /q "%s"`, dir))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x00000008}
	cmd.Start()

	fmt.Println("RackAtlas agent removed.")

	return nil
}
