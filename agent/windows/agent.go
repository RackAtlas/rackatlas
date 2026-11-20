package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

const (
	reportInterval = time.Minute
	updateInterval = 6 * time.Hour
	journalBytes   = 64 * 1024
	journalLines   = 100
)

var unitPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9:_.@\\-]*\.service$`)

func validUnit(unit string) bool { return unitPattern.MatchString(unit) }

var httpClient = &http.Client{Timeout: 30 * time.Second}

func post(cfg config, path string, body []byte, headers map[string]string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodPost, cfg.URL+path, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}

	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	req.Header.Set("X-Agent-Version", agentHeader())
	req.Header.Set("Content-Type", "text/plain")
	req.Header.Set("User-Agent", "rackatlas-agent/"+version)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	res, err := httpClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()

	answer, _ := io.ReadAll(io.LimitReader(res.Body, 64*1024))

	return res.StatusCode, answer, nil
}

// reportOnce builds one report and sends it. The cursors (CPU, Event Log, ...) move only when RackAtlas accepted it.
func reportOnce(cfg config, state string) error {
	report, err := buildReport(state, false)
	if err != nil {
		return err
	}

	status, answer, err := post(cfg, "/api/agent/ingest", []byte(report.text), nil)

	// One more try, like curl --retry.
	if err != nil {
		time.Sleep(2 * time.Second)
		status, answer, err = post(cfg, "/api/agent/ingest", []byte(report.text), nil)
	}

	if err != nil {
		return fmt.Errorf("could not reach %s: %w", cfg.URL, err)
	}

	switch {
	case status >= 200 && status < 300:
		report.commit()
		sendRequestedJournals(cfg, answer)

		return nil
	case status == 401:
		return fmt.Errorf("the token was rejected: install the agent again with a new token")
	default:
		return fmt.Errorf("RackAtlas answered %d: %s", status, truncate(string(answer), 300))
	}
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max]
	}

	return s
}

// sendRequestedJournals answers the "show the log of this service" requests: at most two per run, plain names only.
func sendRequestedJournals(cfg config, answer []byte) {
	var response struct {
		Journal []string `json:"journal"`
	}

	if json.Unmarshal(answer, &response) != nil {
		return
	}

	sent := 0

	for _, unit := range response.Journal {
		if sent >= 2 {
			break
		}

		if !validUnit(unit) {
			continue
		}

		text := readServiceLog(strings.TrimSuffix(unit, ".service"), journalLines)
		if len(text) > journalBytes {
			text = text[len(text)-journalBytes:]
		}
		if strings.TrimSpace(text) == "" {
			text = "No Event Log entries for this service.\n"
		}

		post(cfg, "/api/agent/journal", []byte(text), map[string]string{"X-Unit": unit})
		sent++
	}
}
