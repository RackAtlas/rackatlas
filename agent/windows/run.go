package main

import (
	"fmt"
	"os"
	"time"
)

// loop reports once a minute until stop is closed. It returns true when an update was installed and the process
// must exit so that Windows starts the new program.
func loop(stop <-chan struct{}, logf func(string, ...any)) (restart bool) {
	os.MkdirAll(stateDir(), 0o700)

	cfg, err := loadConfig(confPath())
	if err == nil {
		err = cfg.validate()
	}
	if err != nil {
		logf("configuration problem: %v", err)
	}

	proven := false
	lastUpdateCheck = time.Now().Add(-updateInterval + 2*time.Minute)
	next := time.Now()

	for {
		if err == nil {
			if reportErr := reportOnce(cfg, stateDir()); reportErr != nil {
				logf("report failed: %v", reportErr)
			} else if !proven {
				proven = true
				updateProven()
			}

			if cfg.AutoUpdate && time.Since(lastUpdateCheck) >= updateInterval {
				lastUpdateCheck = time.Now()

				path, newVersion, updateErr := checkUpdate(cfg)

				switch {
				case updateErr != nil:
					logf("update check failed: %v", updateErr)
				case path != "":
					if installErr := installUpdate(path, newVersion); installErr != nil {
						logf("update to %s failed: %v", newVersion, installErr)
					} else {
						logf("updated to %s, restarting", newVersion)

						return true
					}
				}
			}
		} else if cfgNew, loadErr := loadConfig(confPath()); loadErr == nil && cfgNew.validate() == nil {
			cfg, err = cfgNew, nil
			continue
		}

		// Fixed slots, so a slow report does not push the next ones back; a missed slot is skipped.
		next = next.Add(reportInterval)
		if now := time.Now(); !next.After(now) {
			next = now.Add(reportInterval)
		}

		wait := time.NewTimer(time.Until(next))

		select {
		case <-stop:
			wait.Stop()

			return false
		case <-wait.C:
		}
	}
}

func consoleLog(format string, args ...any) {
	fmt.Fprintf(os.Stderr, time.Now().Format("2006-01-02 15:04:05")+" "+format+"\n", args...)
}
