package main

import (
	"strings"
	"testing"
	"time"
)

func TestNewerVersion(t *testing.T) {
	cases := []struct {
		candidate, current string
		want               bool
	}{
		{"1.10.0", "1.9.0", true},
		{"1.0.1", "1.0.0", true},
		{"1.0.0", "1.0.0", false},
		{"0.9.9", "1.0.0", false},
	}

	for _, c := range cases {
		if got := newerVersion(c.candidate, c.current); got != c.want {
			t.Errorf("newerVersion(%q, %q) = %v", c.candidate, c.current, got)
		}
	}
}

func TestValidUnit(t *testing.T) {
	if !validUnit("Spooler.service") || !validUnit("W3SVC.service") {
		t.Error("a valid unit name was rejected")
	}

	if validUnit("MSSQL$SQLEXPRESS.service") || validUnit("bad name.service") || validUnit("../x.service") {
		t.Error("an invalid unit name was accepted")
	}
}

func TestFormatEventIsOneLineInJournalFormat(t *testing.T) {
	line := formatEvent(eventEntry{
		Time:     time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC),
		Host:     "SRV 01",
		Provider: "Service Control Manager",
		ID:       7034,
		Message:  "The service\r\nterminated unexpectedly.",
	})

	want := "2026-01-02T03:04:05+00:00 SRV_01 Service_Control_Manager[7034]: The service terminated unexpectedly.\n"
	if line != want {
		t.Errorf("got %q want %q", line, want)
	}
}

func TestCleanName(t *testing.T) {
	if got := cleanName("My App (x86).exe"); got != "My_App__x86_" {
		t.Errorf("got %q", got)
	}

	if got := cleanName(strings.Repeat("a", 100)); len(got) != 64 {
		t.Errorf("the name was not cut: %d", len(got))
	}
}

func TestConfigValidation(t *testing.T) {
	good := config{URL: "https://rackatlas.dev", Token: "ra_" + strings.Repeat("a", 40)}
	if err := good.validate(); err != nil {
		t.Error(err)
	}

	if (config{URL: "http://x", Token: good.Token}).validate() == nil {
		t.Error("http was accepted")
	}

	if (config{URL: good.URL, Token: "ra_short"}).validate() == nil {
		t.Error("a short token was accepted")
	}
}
