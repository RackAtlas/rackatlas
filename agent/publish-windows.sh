#!/bin/sh
#
# Builds the Windows agent and publishes it in public/agent/windows: the programs, and the update manifest signed
# with your private key. The installed agents check that signature before they replace themselves.
#
#   agent/publish-windows.sh
#
# The key pair is made on the first run: agent/windows/update.key is the PRIVATE key (it is ignored by git, keep a
# backup, whoever has it can update every installed agent), agent/windows/update.pub is the public one (committed).
# If you lose the private key the installed agents can no longer be updated and must be installed again.
#
# Run it after raising the version in agent/windows/VERSION, then commit public/agent/windows and deploy.

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/windows"
OUT="$SCRIPT_DIR/../public/agent/windows"
VERSION="$(tr -d ' \n' < "$SRC/VERSION")"

command -v go >/dev/null 2>&1 || { echo "Go is needed to build the Windows agent (https://go.dev/dl)." >&2; exit 1; }

if [ ! -r "$SRC/update.key" ]; then
  if [ -e "$SRC/update.pub" ]; then
    echo "agent/windows/update.pub exists but the private key agent/windows/update.key is missing." >&2
    echo "Restore it from your backup. A new pair would stop the update of the installed agents." >&2
    exit 1
  fi

  (cd "$SRC" && go run ./cmd/sign genkey update.key update.pub)
  echo "A new update key pair was made. BACK UP agent/windows/update.key now (it is not committed)."
fi

mkdir -p "$OUT"
rm -f "$OUT"/rackatlas-agent-*.exe

sh "$SCRIPT_DIR/build-windows.sh" "$OUT"

(cd "$SRC" && go run ./cmd/sign manifest update.key "$VERSION" "$OUT" \
  "amd64=$OUT/rackatlas-agent-amd64.exe" "arm64=$OUT/rackatlas-agent-arm64.exe")

echo "Published Windows agent $VERSION in public/agent/windows. Commit it and deploy."
