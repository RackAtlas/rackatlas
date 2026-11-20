//go:build windows

package main

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

var (
	kernel32             = windows.NewLazySystemDLL("kernel32.dll")
	psapi                = windows.NewLazySystemDLL("psapi.dll")
	iphlpapi             = windows.NewLazySystemDLL("iphlpapi.dll")
	procGetSystemTimes   = kernel32.NewProc("GetSystemTimes")
	procGlobalMemory     = kernel32.NewProc("GlobalMemoryStatusEx")
	procGetTickCount64   = kernel32.NewProc("GetTickCount64")
	procGetProcessTimes  = kernel32.NewProc("GetProcessTimes")
	procGetProcessMemory = psapi.NewProc("GetProcessMemoryInfo")
	procGetIfTable2      = iphlpapi.NewProc("GetIfTable2")
	procFreeMibTable     = iphlpapi.NewProc("FreeMibTable")
	procGetNativeSystem  = kernel32.NewProc("GetNativeSystemInfo")
)

func filetime(t windows.Filetime) uint64 { return uint64(t.HighDateTime)<<32 | uint64(t.LowDateTime) }

func readCPU() (cpuTimes, error) {
	var idle, kernel, user windows.Filetime

	r, _, err := procGetSystemTimes.Call(uintptr(unsafe.Pointer(&idle)), uintptr(unsafe.Pointer(&kernel)), uintptr(unsafe.Pointer(&user)))
	if r == 0 {
		return cpuTimes{}, err
	}

	// The kernel time contains the idle time. 100 ns units to milliseconds.
	return cpuTimes{
		User:   filetime(user) / 10000,
		System: (filetime(kernel) - filetime(idle)) / 10000,
		Idle:   filetime(idle) / 10000,
	}, nil
}

type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys, AvailPhys uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

func readMemory() (memInfo, error) {
	status := memoryStatusEx{Length: uint32(unsafe.Sizeof(memoryStatusEx{}))}

	r, _, err := procGlobalMemory.Call(uintptr(unsafe.Pointer(&status)))
	if r == 0 {
		return memInfo{}, err
	}

	info := memInfo{Total: status.TotalPhys, Available: status.AvailPhys}

	// The commit limit is RAM plus the page file, so the difference is the page file ("swap").
	if status.TotalPageFile > status.TotalPhys {
		info.SwapTotal = status.TotalPageFile - status.TotalPhys
		if status.AvailPageFile > status.AvailPhys {
			info.SwapFree = status.AvailPageFile - status.AvailPhys
		}
		if info.SwapFree > info.SwapTotal {
			info.SwapFree = info.SwapTotal
		}
	}

	return info, nil
}

func uptimeSeconds() float64 {
	r, _, _ := procGetTickCount64.Call()

	return float64(r) / 1000
}

func readDisks() []diskInfo {
	mask, err := windows.GetLogicalDrives()
	if err != nil {
		return nil
	}

	var disks []diskInfo

	for i := 0; i < 26; i++ {
		if mask&(1<<uint(i)) == 0 {
			continue
		}

		root := string(rune('A'+i)) + `:\`
		rootPtr, _ := windows.UTF16PtrFromString(root)

		if windows.GetDriveType(rootPtr) != windows.DRIVE_FIXED {
			continue
		}

		var avail, total, free uint64
		if windows.GetDiskFreeSpaceEx(rootPtr, &avail, &total, &free) != nil || total == 0 {
			continue
		}

		fsName := "NTFS"
		buf := make([]uint16, 32)
		if windows.GetVolumeInformation(rootPtr, nil, 0, nil, nil, nil, &buf[0], uint32(len(buf))) == nil {
			if name := windows.UTF16ToString(buf); name != "" {
				fsName = name
			}
		}

		disks = append(disks, diskInfo{
			Device:     root[:2],
			FileSystem: fsName,
			Mount:      root,
			Total:      total,
			Used:       total - free,
			Avail:      avail,
		})
	}

	return disks
}

type processMemoryCounters struct {
	Cb                         uint32
	PageFaultCount             uint32
	PeakWorkingSetSize         uintptr
	WorkingSetSize             uintptr
	QuotaPeakPagedPoolUsage    uintptr
	QuotaPagedPoolUsage        uintptr
	QuotaPeakNonPagedPoolUsage uintptr
	QuotaNonPagedPoolUsage     uintptr
	PagefileUsage              uintptr
	PeakPagefileUsage          uintptr
}

func readProcesses() []procInfo {
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil
	}
	defer windows.CloseHandle(snapshot)

	var entry windows.ProcessEntry32
	entry.Size = uint32(unsafe.Sizeof(entry))

	var procs []procInfo

	for err = windows.Process32First(snapshot, &entry); err == nil; err = windows.Process32Next(snapshot, &entry) {
		if entry.ProcessID == 0 {
			continue
		}

		p := procInfo{PID: entry.ProcessID, Name: windows.UTF16ToString(entry.ExeFile[:])}

		handle, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, entry.ProcessID)
		if err == nil {
			var created, exited, kernel, user windows.Filetime
			if r, _, _ := procGetProcessTimes.Call(uintptr(handle), uintptr(unsafe.Pointer(&created)), uintptr(unsafe.Pointer(&exited)),
				uintptr(unsafe.Pointer(&kernel)), uintptr(unsafe.Pointer(&user))); r != 0 {
				p.Start = filetime(created)
				p.Ticks = filetime(kernel) + filetime(user)
			}

			counters := processMemoryCounters{Cb: uint32(unsafe.Sizeof(processMemoryCounters{}))}
			if r, _, _ := procGetProcessMemory.Call(uintptr(handle), uintptr(unsafe.Pointer(&counters)), uintptr(counters.Cb)); r != 0 {
				p.RSS = uint64(counters.WorkingSetSize)
			}

			windows.CloseHandle(handle)
		}

		procs = append(procs, p)
	}

	return procs
}

func registryString(root registry.Key, path, name string) string {
	key, err := registry.OpenKey(root, path, registry.QUERY_VALUE|registry.WOW64_64KEY)
	if err != nil {
		return ""
	}
	defer key.Close()

	value, _, err := key.GetStringValue(name)
	if err != nil {
		return ""
	}

	return strings.TrimSpace(value)
}

func registryInt(root registry.Key, path, name string) uint64 {
	key, err := registry.OpenKey(root, path, registry.QUERY_VALUE|registry.WOW64_64KEY)
	if err != nil {
		return 0
	}
	defer key.Close()

	value, _, err := key.GetIntegerValue(name)
	if err != nil {
		return 0
	}

	return value
}

func runHidden(timeout time.Duration, name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	var out bytes.Buffer
	cmd.Stdout = &out

	err := cmd.Run()

	return out.String(), err
}

func readSystem() []string {
	const current = `SOFTWARE\Microsoft\Windows NT\CurrentVersion`

	var lines []string
	add := func(key, value string) {
		value = strings.TrimSpace(strings.NewReplacer("\r", " ", "\n", " ").Replace(value))
		if value != "" {
			lines = append(lines, key+"="+value)
		}
	}

	host, _ := os.Hostname()
	add("hostname", host)

	product := registryString(registry.LOCAL_MACHINE, current, "ProductName")
	// Windows 11 still reports "Windows 10" in ProductName; the build number tells them apart.
	build := registryString(registry.LOCAL_MACHINE, current, "CurrentBuildNumber")
	buildNumber := 0
	if _, err := fmt.Sscan(build, &buildNumber); err == nil && buildNumber >= 22000 {
		product = strings.Replace(product, "Windows 10", "Windows 11", 1)
	}
	if display := registryString(registry.LOCAL_MACHINE, current, "DisplayVersion"); display != "" {
		product += " " + display
	}
	add("os", product)

	if ubr := registryInt(registry.LOCAL_MACHINE, current, "UBR"); build != "" {
		add("kernel", fmt.Sprintf("10.0.%s.%d", build, ubr))
	}

	var native struct {
		Arch     uint16
		Reserved uint16
		_        [44]byte
	}
	procGetNativeSystem.Call(uintptr(unsafe.Pointer(&native)))
	switch native.Arch {
	case 9:
		add("arch", "x86_64")
	case 12:
		add("arch", "aarch64")
	case 0:
		add("arch", "x86")
	}

	add("cpu_model", registryString(registry.LOCAL_MACHINE, `HARDWARE\DESCRIPTION\System\CentralProcessor\0`, "ProcessorNameString"))

	manufacturer := strings.ToLower(registryString(registry.LOCAL_MACHINE, `HARDWARE\DESCRIPTION\System\BIOS`, "SystemManufacturer") + " " +
		registryString(registry.LOCAL_MACHINE, `HARDWARE\DESCRIPTION\System\BIOS`, "SystemProductName"))
	for needle, name := range map[string]string{"vmware": "vmware", "virtualbox": "oracle", "kvm": "kvm", "qemu": "qemu", "xen": "xen", "virtual machine": "microsoft", "amazon ec2": "amazon", "google compute": "google"} {
		if strings.Contains(manufacturer, needle) {
			add("virtualization", name)
			break
		}
	}

	// A restart is waiting when Windows Update or a component installation says so.
	reboot := "0"
	for _, path := range []string{
		`SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired`,
		`SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending`,
	} {
		if key, err := registry.OpenKey(registry.LOCAL_MACHINE, path, registry.QUERY_VALUE|registry.WOW64_64KEY); err == nil {
			key.Close()
			reboot = "1"
		}
	}
	add("reboot_required", reboot)

	return lines
}

type ifRow2 struct {
	InterfaceLuid               uint64
	InterfaceIndex              uint32
	InterfaceGuid               [16]byte
	Alias                       [257]uint16
	Description                 [257]uint16
	PhysicalAddressLen          uint32
	PhysicalAddress             [32]byte
	PermanentAddress            [32]byte
	Mtu                         uint32
	Type                        uint32
	TunnelType                  uint32
	MediaType                   uint32
	PhysicalMediumType          uint32
	AccessType                  uint32
	DirectionType               uint32
	InterfaceAndOperStatusFlags uint8
	OperStatus                  uint32
	AdminStatus                 uint32
	MediaConnectState           uint32
	NetworkGuid                 [16]byte
	ConnectionType              uint32
	_                           uint32
	TransmitLinkSpeed           uint64
	ReceiveLinkSpeed            uint64
	InOctets                    uint64
	InUcastPkts                 uint64
	InNUcastPkts                uint64
	InDiscards                  uint64
	InErrors                    uint64
	InUnknownProtos             uint64
	InUcastOctets               uint64
	InMulticastOctets           uint64
	InBroadcastOctets           uint64
	OutOctets                   uint64
	OutUcastPkts                uint64
	OutNUcastPkts               uint64
	OutDiscards                 uint64
	OutErrors                   uint64
	OutUcastOctets              uint64
	OutMulticastOctets          uint64
	OutBroadcastOctets          uint64
	OutQLen                     uint64
}

// readNetwork sums the counters of the real adapters: Ethernet and Wi-Fi that are connected, not the loopback
// and not the tunnels and virtual switches.
func readNetwork() (rx, tx uint64, ok bool) {
	var table unsafe.Pointer
	if r, _, _ := procGetIfTable2.Call(uintptr(unsafe.Pointer(&table))); r != 0 || table == nil {
		return 0, 0, false
	}
	defer procFreeMibTable.Call(uintptr(table))

	count := *(*uint32)(table)
	rowSize := unsafe.Sizeof(ifRow2{})
	first := unsafe.Add(table, 8)

	for i := uint32(0); i < count; i++ {
		row := (*ifRow2)(unsafe.Add(first, uintptr(i)*rowSize))

		// 6 Ethernet, 71 IEEE 802.11. OperStatus 1 is up.
		if (row.Type != 6 && row.Type != 71) || row.OperStatus != 1 || row.InterfaceAndOperStatusFlags&1 == 0 {
			continue
		}

		description := strings.ToLower(windows.UTF16ToString(row.Description[:]))
		if strings.Contains(description, "virtual") || strings.Contains(description, "vethernet") || strings.Contains(description, "loopback") {
			continue
		}

		rx += row.InOctets
		tx += row.OutOctets
		ok = true
	}

	return rx, tx, ok
}

// readServices lists the Windows services in the form of the systemd ones, so that RackAtlas shows them in the
// same list: "Spooler.service". A service that should start on its own but is not running is "failed".
func readServices() []serviceInfo {
	manager, err := mgr.Connect()
	if err != nil {
		return nil
	}
	defer manager.Disconnect()

	names, err := manager.ListServices()
	if err != nil {
		return nil
	}

	sort.Strings(names)

	var services []serviceInfo

	for _, name := range names {
		if len(services) >= 400 {
			break
		}

		if !validUnit(name+".service") || name == serviceName {
			continue
		}

		handle, err := manager.OpenService(name)
		if err != nil {
			continue
		}

		status, statusErr := handle.Query()
		config, configErr := handle.Config()
		handle.Close()

		if statusErr != nil || configErr != nil {
			continue
		}

		// Drivers are not services in the sense of an admin.
		if config.ServiceType&windows.SERVICE_WIN32 == 0 {
			continue
		}

		automatic := config.StartType == mgr.StartAutomatic
		s := serviceInfo{Unit: name + ".service", Description: config.DisplayName}

		switch config.StartType {
		case mgr.StartAutomatic:
			s.FileState = "enabled"
		case mgr.StartDisabled:
			s.FileState = "disabled"
		default:
			s.FileState = "static"
		}

		switch status.State {
		case svc.Running:
			s.Active, s.Sub = "active", "running"
		case svc.StartPending, svc.ContinuePending:
			s.Active, s.Sub = "activating", "start"
		case svc.StopPending, svc.PausePending:
			s.Active, s.Sub = "deactivating", "stop"
		case svc.Paused:
			s.Active, s.Sub = "active", "paused"
		default:
			s.Active, s.Sub = "inactive", "dead"
			// Stopped by itself with an error, or an automatic service that is not running (delayed starts
			// and triggered services excluded, they stop on purpose).
			if status.Win32ExitCode != 0 && status.Win32ExitCode != uint32(windows.ERROR_SERVICE_NEVER_STARTED) && automatic && !config.DelayedAutoStart {
				s.Active, s.Sub, s.Failed = "failed", "failed", true
			}
		}

		s.Description = strings.NewReplacer("|", "/", "\r", " ", "\n", " ").Replace(s.Description)
		services = append(services, s)
	}

	return services
}

type eventXML struct {
	System struct {
		Provider struct {
			Name string `xml:"Name,attr"`
		} `xml:"Provider"`
		EventID struct {
			Value int `xml:",chardata"`
		} `xml:"EventID"`
		TimeCreated struct {
			SystemTime string `xml:"SystemTime,attr"`
		} `xml:"TimeCreated"`
		Computer string `xml:"Computer"`
	} `xml:"System"`
	EventData struct {
		Data []string `xml:"Data"`
	} `xml:"EventData"`
	UserData struct {
		Inner string `xml:",innerxml"`
	} `xml:"UserData"`
	RenderingInfo struct {
		Message string `xml:"Message"`
	} `xml:"RenderingInfo"`
}

// readEvents reads the System and Application logs with wevtutil (it is on every Windows and renders the message
// text), Critical (level 1) or Error (level 2) since the given time, the oldest first.
func readEvents(critical bool, since time.Time, limit int) []eventEntry {
	level := 2
	if critical {
		level = 1
	}

	millis := time.Since(since).Milliseconds()
	if millis < 1000 {
		millis = 1000
	}

	var events []eventEntry

	for _, channel := range []string{"System", "Application"} {
		query := fmt.Sprintf("*[System[(Level=%d) and TimeCreated[timediff(@SystemTime) <= %d]]]", level, millis)

		out, err := runHidden(20*time.Second, "wevtutil.exe", "qe", channel, "/q:"+query, "/f:RenderedXml", "/rd:false", fmt.Sprintf("/c:%d", limit))
		if err != nil && out == "" {
			continue
		}

		decoder := xml.NewDecoder(strings.NewReader("<Events>" + stripXMLHeaders(out) + "</Events>"))
		decoder.Strict = false

		var wrapper struct {
			Events []eventXML `xml:"Event"`
		}
		if decoder.Decode(&wrapper) != nil {
			continue
		}

		for _, e := range wrapper.Events {
			at, err := time.Parse(time.RFC3339Nano, e.System.TimeCreated.SystemTime)
			if err != nil || !at.After(since) {
				continue
			}

			message := strings.TrimSpace(e.RenderingInfo.Message)
			if message == "" {
				message = strings.Join(e.EventData.Data, " ")
			}

			events = append(events, eventEntry{
				Time:     at.Local(),
				Host:     e.System.Computer,
				Provider: e.System.Provider.Name,
				ID:       e.System.EventID.Value,
				Message:  message,
			})
		}
	}

	sort.Slice(events, func(i, j int) bool { return events[i].Time.Before(events[j].Time) })

	if len(events) > limit {
		events = events[len(events)-limit:]
	}

	return events
}

func stripXMLHeaders(s string) string {
	return strings.ReplaceAll(s, `<?xml version="1.0" encoding="utf-8"?>`, "")
}

// readServiceLog is the Event Log of one service, for the "show the log" button: the last events whose source is
// the service's name or display name.
func readServiceLog(name string, lines int) string {
	query := fmt.Sprintf("*[System[Provider[@Name='%s']]]", strings.ReplaceAll(name, "'", ""))

	var out strings.Builder

	for _, channel := range []string{"System", "Application"} {
		text, _ := runHidden(20*time.Second, "wevtutil.exe", "qe", channel, "/q:"+query, "/f:RenderedXml", "/rd:true", fmt.Sprintf("/c:%d", lines))

		decoder := xml.NewDecoder(strings.NewReader("<Events>" + stripXMLHeaders(text) + "</Events>"))
		decoder.Strict = false

		var wrapper struct {
			Events []eventXML `xml:"Event"`
		}
		if decoder.Decode(&wrapper) != nil {
			continue
		}

		for _, e := range wrapper.Events {
			at, err := time.Parse(time.RFC3339Nano, e.System.TimeCreated.SystemTime)
			if err != nil {
				continue
			}

			message := strings.TrimSpace(e.RenderingInfo.Message)
			if message == "" {
				message = strings.Join(e.EventData.Data, " ")
			}

			out.WriteString(formatEvent(eventEntry{Time: at.Local(), Host: e.System.Computer, Provider: e.System.Provider.Name, ID: e.System.EventID.Value, Message: message}))
		}
	}

	return out.String()
}
