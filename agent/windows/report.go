package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"
)

// The platform functions (collectors_windows.go, collectors_other.go) only read the machine. Everything that
// shapes the report is here, so the format stays in one place and matches the shell agent.

type cpuTimes struct {
	User, System, Idle uint64 // milliseconds since boot, System without idle time
}

type memInfo struct {
	Total, Available, SwapTotal, SwapFree uint64 // bytes
}

type diskInfo struct {
	Device, FileSystem, Mount string
	Total, Used, Avail        uint64
}

type procInfo struct {
	PID   uint32
	Start uint64 // creation time, tells a reused pid from the old one
	Ticks uint64 // CPU time in 100 ns units
	Name  string
	RSS   uint64 // bytes
}

type serviceInfo struct {
	Unit, Active, Sub, FileState, Description string
	Failed                                    bool
}

type eventEntry struct {
	Time     time.Time
	Host     string
	Provider string
	ID       int
	Message  string
}

const (
	maxLogLines = 200
	procTop     = 5
	// A reading older than this is not used as the start of an interval (the agent was stopped, the machine slept).
	maxReadingAge = 5 * time.Minute
)

// reportResult is the text and what must be saved only after RackAtlas accepted it.
type reportResult struct {
	text   string
	commit func()
}

func readJSON(path string, into any) bool {
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}

	return json.Unmarshal(data, into) == nil
}

func writeJSON(path string, value any) {
	data, err := json.Marshal(value)
	if err != nil {
		return
	}

	tmp := path + ".tmp"
	if os.WriteFile(tmp, data, 0o600) == nil {
		os.Rename(tmp, path)
	}
}

type cpuReading struct {
	At  time.Time
	CPU cpuTimes
}

type procReading struct {
	At    time.Time
	Total uint64 // the CPU time of the whole machine (all cores), 100 ns units
	Procs map[string][2]uint64
}

type netReading struct {
	At     time.Time
	RX, TX uint64
}

type loadSample struct {
	At   int64   `json:"t"`
	Busy float64 `json:"v"`
}

func cpuLine(c cpuTimes) string {
	// The Linux /proc/stat layout: user nice system idle iowait irq softirq steal.
	return fmt.Sprintf("cpu %d 0 %d %d 0 0 0 0", c.User, c.System, c.Idle)
}

func cpuTotal(c cpuTimes) uint64 { return c.User + c.System + c.Idle }

// buildReport reads the machine and returns the report. With dry set nothing is read from or written to the state,
// except that the one second samples replace the previous readings.
func buildReport(state string, dry bool) (reportResult, error) {
	now := time.Now()
	cores := runtime.NumCPU()

	// CPU: an average over the time since the previous run, a one second sample without one.
	cpuNow, err := readCPU()
	if err != nil {
		return reportResult{}, fmt.Errorf("could not read the CPU times: %w", err)
	}

	cpuFirst := cpuNow
	var prev cpuReading
	havePrev := !dry && readJSON(filepath.Join(state, "cpu-prev.json"), &prev) &&
		now.Sub(prev.At) < maxReadingAge && cpuTotal(prev.CPU) < cpuTotal(cpuNow)

	if havePrev {
		cpuFirst = prev.CPU
	} else {
		time.Sleep(time.Second)
		if cpuNow, err = readCPU(); err != nil {
			return reportResult{}, err
		}
		now = time.Now()
	}

	cpuPercent := 0.0
	if total := cpuTotal(cpuNow) - cpuTotal(cpuFirst); total > 0 && cpuTotal(cpuNow) > cpuTotal(cpuFirst) {
		cpuPercent = float64(total-(cpuNow.Idle-cpuFirst.Idle)) / float64(total) * 100
	}

	mem, err := readMemory()
	if err != nil {
		return reportResult{}, fmt.Errorf("could not read the memory: %w", err)
	}

	var out strings.Builder
	section := func(name string) { fmt.Fprintf(&out, "###%s\n", name) }

	section("CPU1")
	fmt.Fprintln(&out, cpuLine(cpuFirst))
	section("CPU2")
	fmt.Fprintln(&out, cpuLine(cpuNow))

	// Windows has no load average. The number of busy cores (CPU use x cores) averaged over 1, 5 and 15 minutes
	// is the closest thing and keeps the same scale as the Linux one: 1.00 is one fully used core.
	load1, load5, load15 := loadAverages(state, now, cpuPercent/100*float64(cores), dry)
	section("LOAD")
	fmt.Fprintf(&out, "%.2f %.2f %.2f 0/0 0\n", load1, load5, load15)
	section("CORES")
	fmt.Fprintln(&out, cores)

	section("MEM")
	fmt.Fprintf(&out, "MemTotal: %d kB\nMemFree: %d kB\nMemAvailable: %d kB\nBuffers: 0 kB\nCached: 0 kB\nSwapTotal: %d kB\nSwapFree: %d kB\n",
		mem.Total/1024, mem.Available/1024, mem.Available/1024, mem.SwapTotal/1024, mem.SwapFree/1024)

	section("UPTIME")
	fmt.Fprintf(&out, "%.2f\n", uptimeSeconds())

	section("DISK")
	for _, disk := range readDisks() {
		percent := 0
		if disk.Total > 0 {
			percent = int(math.Round(float64(disk.Used) / float64(disk.Total) * 100))
		}
		fmt.Fprintf(&out, "%s %s %d %d %d %d%% %s\n", disk.Device, disk.FileSystem, disk.Total, disk.Used, disk.Avail, percent, disk.Mount)
	}

	procs, procPrev, procSave := processSection(state, now, cores, dry)
	section("PROCESSES")
	out.WriteString(procs)
	_ = procPrev

	section("SYSTEM")
	for _, line := range readSystem() {
		fmt.Fprintln(&out, line)
	}

	netText, netSave := networkSection(state, now, dry)
	section("NETWORK")
	out.WriteString(netText)

	eventCommit := []func(){}
	for _, kind := range []struct{ name, section string }{{"critical", "JOURNAL_CRITICAL"}, {"error", "JOURNAL_ERROR"}} {
		text, commit := eventSection(state, kind.name, now, dry)
		section(kind.section)
		out.WriteString(text)
		eventCommit = append(eventCommit, commit)
	}

	services := readServices()
	if len(services) > 0 {
		section("SERVICES")
		for _, s := range services {
			fmt.Fprintf(&out, "%s|%s|%s|%s|%s\n", s.Unit, s.Active, s.Sub, s.FileState, s.Description)
		}
	}

	section("FAILED_UNITS")
	failed := 0
	for _, s := range services {
		if s.Failed && failed < 30 {
			fmt.Fprintf(&out, "%s loaded failed failed %s\n", s.Unit, s.Description)
			failed++
		}
	}

	commit := func() {
		if dry {
			return
		}
		writeJSON(filepath.Join(state, "cpu-prev.json"), cpuReading{At: now, CPU: cpuNow})
		procSave()
		netSave()
		for _, f := range eventCommit {
			f()
		}
	}

	return reportResult{text: out.String(), commit: commit}, nil
}

// loadAverages keeps the busy-core samples of the last 15 minutes in the state directory.
func loadAverages(state string, now time.Time, busy float64, dry bool) (float64, float64, float64) {
	path := filepath.Join(state, "load.json")
	var samples []loadSample
	readJSON(path, &samples)

	samples = append(samples, loadSample{At: now.Unix(), Busy: busy})

	kept := samples[:0]
	for _, s := range samples {
		if now.Unix()-s.At <= 15*60 {
			kept = append(kept, s)
		}
	}

	if !dry {
		writeJSON(path, kept)
	}

	average := func(seconds int64) float64 {
		sum, count := 0.0, 0
		for _, s := range kept {
			if now.Unix()-s.At <= seconds {
				sum += s.Busy
				count++
			}
		}

		if count == 0 {
			return busy
		}

		return sum / float64(count)
	}

	return average(60), average(300), average(900)
}

var unsafeName = regexp.MustCompile(`[^A-Za-z0-9_.+\-]`)

func cleanName(name string) string {
	name = strings.TrimSuffix(strings.TrimSuffix(name, ".exe"), ".EXE")
	name = unsafeName.ReplaceAllString(name, "_")

	if name == "" {
		return "?"
	}

	if len(name) > 64 {
		name = name[:64]
	}

	return name
}

// processSection groups the processes by program and keeps the five that used the most CPU since the previous run
// and the five that hold the most memory: "name count cpu% memory_kb".
func processSection(state string, now time.Time, cores int, dry bool) (string, procReading, func()) {
	key := func(p procInfo) string { return fmt.Sprintf("%d:%d", p.PID, p.Start) }

	var prev procReading
	have := !dry && readJSON(filepath.Join(state, "proc-prev.json"), &prev) && now.Sub(prev.At) < maxReadingAge

	if !have {
		first := readProcesses()
		prev = procReading{At: time.Now(), Procs: map[string][2]uint64{}}
		for _, p := range first {
			prev.Procs[key(p)] = [2]uint64{p.Ticks, 0}
		}
		time.Sleep(time.Second)
		now = time.Now()
	}

	current := readProcesses()
	elapsed := now.Sub(prev.At).Seconds()

	type group struct {
		count int
		cpu   uint64
		mem   uint64
	}

	groups := map[string]*group{}
	saved := procReading{At: now, Procs: map[string][2]uint64{}}

	for _, p := range current {
		saved.Procs[key(p)] = [2]uint64{p.Ticks, 0}

		delta := p.Ticks
		if before, known := prev.Procs[key(p)]; known {
			if p.Ticks >= before[0] {
				delta = p.Ticks - before[0]
			} else {
				delta = 0
			}
		}

		name := cleanName(p.Name)
		g := groups[name]
		if g == nil {
			g = &group{}
			groups[name] = g
		}

		g.count++
		g.cpu += delta
		g.mem += p.RSS / 1024
	}

	names := make([]string, 0, len(groups))
	for name := range groups {
		names = append(names, name)
	}

	// 100 ns units: one core fully used for one second is 10,000,000.
	capacity := elapsed * 10_000_000 * float64(cores)
	picked := map[string]bool{}
	var order []string

	pick := func(less func(a, b string) bool, needCPU bool) {
		sort.Slice(names, func(i, j int) bool { return less(names[i], names[j]) })
		count := 0
		for _, name := range names {
			if picked[name] || count >= procTop {
				continue
			}
			if needCPU && groups[name].cpu == 0 {
				break
			}
			picked[name] = true
			order = append(order, name)
			count++
		}
	}

	pick(func(a, b string) bool {
		return groups[a].cpu > groups[b].cpu || (groups[a].cpu == groups[b].cpu && a < b)
	}, true)
	pick(func(a, b string) bool {
		return groups[a].mem > groups[b].mem || (groups[a].mem == groups[b].mem && a < b)
	}, false)

	var out strings.Builder
	if capacity > 0 {
		for _, name := range order {
			g := groups[name]
			percent := math.Min(100, float64(g.cpu)*100/capacity)
			fmt.Fprintf(&out, "%s %d %.2f %d\n", name, g.count, percent, g.mem)
		}
	}

	return out.String(), saved, func() { writeJSON(filepath.Join(state, "proc-prev.json"), saved) }
}

// networkSection is the traffic of the physical adapters in bytes per second since the previous run.
// Nothing on the first run, like the shell agent.
func networkSection(state string, now time.Time, dry bool) (string, func()) {
	rx, tx, ok := readNetwork()
	if !ok {
		return "", func() {}
	}

	path := filepath.Join(state, "net-prev.json")
	var prev netReading
	text := ""

	if !dry && readJSON(path, &prev) && now.Sub(prev.At) < maxReadingAge {
		if seconds := now.Sub(prev.At).Seconds(); seconds > 0 && rx >= prev.RX && tx >= prev.TX {
			text = fmt.Sprintf("%.0f %.0f\n", float64(rx-prev.RX)/seconds, float64(tx-prev.TX)/seconds)
		}
	}

	return text, func() { writeJSON(path, netReading{At: now, RX: rx, TX: tx}) }
}

// eventSection is the Event Log entries of one level since the last accepted report, in the journal format the
// server reads: "<iso time> <host> <source>[<id>]: <message>". The cursor moves only after the server accepted it.
func eventSection(state, kind string, now time.Time, dry bool) (string, func()) {
	path := filepath.Join(state, "events-"+kind+".json")
	var cursor struct{ After time.Time }

	since := now.Add(-10 * time.Minute)
	if readJSON(path, &cursor) && !cursor.After.IsZero() && cursor.After.After(now.Add(-24*time.Hour)) {
		since = cursor.After
	}

	events := readEvents(kind == "critical", since, maxLogLines)

	var out strings.Builder
	var newest time.Time

	for _, e := range events {
		if strings.Contains(strings.ToLower(e.Provider), "rackatlas") {
			continue
		}

		out.WriteString(formatEvent(e))

		if e.Time.After(newest) {
			newest = e.Time
		}
	}

	return out.String(), func() {
		if !newest.IsZero() && !dry {
			writeJSON(path, struct{ After time.Time }{newest})
		}
	}
}

var spaces = regexp.MustCompile(`\s+`)

func formatEvent(e eventEntry) string {
	message := strings.TrimSpace(spaces.ReplaceAllString(e.Message, " "))
	if message == "" {
		message = fmt.Sprintf("Event %d", e.ID)
	}

	if len(message) > 500 {
		message = message[:500]
	}

	source := strings.NewReplacer(":", "_", "[", "_", "]", "_").Replace(spaces.ReplaceAllString(e.Provider, "_"))
	host := spaces.ReplaceAllString(e.Host, "_")

	return fmt.Sprintf("%s %s %s[%d]: %s\n", e.Time.Format("2006-01-02T15:04:05-07:00"), host, source, e.ID, message)
}
