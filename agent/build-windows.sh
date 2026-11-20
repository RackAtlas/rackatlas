#!/bin/sh
#
# Builds the Windows agent (Windows 10/11 and Windows Server), one program per architecture.
#
#   agent/build-windows.sh [output directory]      (default: public/agent/windows/dev)
#
# Needs only Go, it cross-compiles from macOS and Linux. The public update key from agent/windows/update.pub is built
# into the program, so the agent accepts only updates signed with the matching private key. Without update.pub
# the program is built without self-update (a build for trying it out).
# The signed update manifest is made by publish-windows.sh, not here.

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${1:-$SCRIPT_DIR/../public/agent/windows/dev}"
SRC="$SCRIPT_DIR/windows"
VERSION="$(tr -d ' \n' < "$SRC/VERSION")"

command -v go >/dev/null 2>&1 || { echo "Go is needed to build the Windows agent (https://go.dev/dl)." >&2; exit 1; }

mkdir -p "$OUT_DIR"

KEY=""
[ -r "$SRC/update.pub" ] && KEY="$(tr -d ' \n' < "$SRC/update.pub")"

for arch in amd64 arm64; do
  (cd "$SRC" && CGO_ENABLED=0 GOOS=windows GOARCH="$arch" \
    go build -trimpath -ldflags "-s -w -X main.version=$VERSION -X main.updateKey=$KEY" \
    -o "$OUT_DIR/rackatlas-agent-$arch.exe" .)
done

echo "Built Windows agent $VERSION in $OUT_DIR$([ -z "$KEY" ] && echo ' (no update key, self-update is off)')"
