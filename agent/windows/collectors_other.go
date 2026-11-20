//go:build !windows

package main

import (
	"errors"
	"time"
)

// The agent is Windows only. These stubs let the report code build and be checked on other systems
// (go vet, go build on a Mac or Linux developer machine), nothing here runs in production.

var errNotWindows = errors.New("the Windows agent runs only on Windows")

func readCPU() (cpuTimes, error)                   { return cpuTimes{}, errNotWindows }
func readMemory() (memInfo, error)                 { return memInfo{}, errNotWindows }
func uptimeSeconds() float64                       { return 0 }
func readDisks() []diskInfo                        { return nil }
func readProcesses() []procInfo                    { return nil }
func readSystem() []string                         { return nil }
func readNetwork() (rx, tx uint64, ok bool)        { return 0, 0, false }
func readServices() []serviceInfo                  { return nil }
func readEvents(bool, time.Time, int) []eventEntry { return nil }
func readServiceLog(name string, lines int) string { return "" }

func installCommand(args []string) error   { return errNotWindows }
func uninstallCommand(args []string) error { return errNotWindows }
func runCommand(service bool) error        { return errNotWindows }
