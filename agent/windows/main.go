// RackAtlas agent for Windows and Windows Server.
//
// It does the same job as the shell agent for Linux: once a minute it collects CPU, memory, disks, network,
// the busiest processes, the services and serious Event Log entries, and sends them to RackAtlas over HTTPS.
// The report has the same ###SECTIONS as the Linux one (see App\Services\Ssh\MetricsParser), so the server reads
// both. Nothing connects into the machine. There is no terminal on Windows.
//
//	rackatlas-agent.exe install --url https://rackatlas.dev   (token in RACKATLAS_TOKEN)   install and start the service
//	rackatlas-agent.exe uninstall [--purge]                    remove the service (--purge also the configuration)
//	rackatlas-agent.exe run                                    run in the console (the service runs this itself)
//	rackatlas-agent.exe once                                   send one report and exit
//	rackatlas-agent.exe --dry-run                              print the report without sending it
//	rackatlas-agent.exe --version
package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// version is set at build time (-ldflags "-X main.version=1.0.0").
var version = "dev"

// updateKey is the base64 public key (ed25519) that signs the updates, set at build time from agent/windows/update.pub.
// Without it the agent never updates itself.
var updateKey = ""

const (
	serviceName = "RackAtlasAgent"
	displayName = "RackAtlas Agent"
	description = "Sends the state of this machine to RackAtlas once a minute."
)

var tokenPattern = regexp.MustCompile(`^ra_[A-Za-z0-9]{40}$`)

// config is agent.conf: KEY=value lines. Only the known keys are read, the file is never executed.
type config struct {
	URL        string
	Token      string
	AutoUpdate bool
}

func dataDir() string {
	if dir := os.Getenv("RACKATLAS_DATA"); dir != "" {
		return dir
	}

	base := os.Getenv("ProgramData")
	if base == "" {
		base = `C:\ProgramData`
	}

	return filepath.Join(base, "RackAtlas")
}

func confPath() string    { return filepath.Join(dataDir(), "agent.conf") }
func stateDir() string    { return filepath.Join(dataDir(), "state") }
func agentHeader() string { return "windows-" + version }

func loadConfig(path string) (config, error) {
	cfg := config{AutoUpdate: true}

	file, err := os.Open(path)
	if err != nil {
		return cfg, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		key, value, found := strings.Cut(strings.TrimSpace(scanner.Text()), "=")
		if !found {
			continue
		}

		value = strings.TrimSpace(value)

		switch strings.TrimSpace(key) {
		case "URL":
			cfg.URL = strings.TrimRight(value, "/")
		case "TOKEN":
			cfg.Token = value
		case "AUTO_UPDATE":
			cfg.AutoUpdate = value != "0"
		}
	}

	return cfg, scanner.Err()
}

// validate checks what the server would reject anyway, so that the message is clear.
func (c config) validate() error {
	if !strings.HasPrefix(c.URL, "https://") {
		return fmt.Errorf("URL must start with https:// (set it in %s)", confPath())
	}

	if !tokenPattern.MatchString(c.Token) {
		return fmt.Errorf("invalid token format (set it in %s)", confPath())
	}

	return nil
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "rackatlas-agent: "+format+"\n", args...)
	os.Exit(1)
}

func main() {
	args := os.Args[1:]
	command := ""

	if len(args) > 0 {
		command = args[0]
	}

	switch command {
	case "--version", "-v", "version":
		fmt.Printf("rackatlas-agent %s (windows)\n", version)
	case "--dry-run", "dry-run":
		os.MkdirAll(stateDir(), 0o700)
		report, _ := buildReport(stateDir(), true)
		fmt.Print(report.text)
	case "once":
		cfg, err := loadConfig(confPath())
		if err != nil {
			fail("%v", err)
		}
		if err := cfg.validate(); err != nil {
			fail("%v", err)
		}
		if err := reportOnce(cfg, stateDir()); err != nil {
			fail("%v", err)
		}
	case "install":
		if err := installCommand(args[1:]); err != nil {
			fail("%v", err)
		}
	case "uninstall":
		if err := uninstallCommand(args[1:]); err != nil {
			fail("%v", err)
		}
	case "run", "":
		if err := runCommand(command == "run"); err != nil {
			fail("%v", err)
		}
	default:
		fmt.Fprintln(os.Stderr, "usage: rackatlas-agent.exe [install|uninstall|run|once|--dry-run|--version]")
		os.Exit(2)
	}
}
