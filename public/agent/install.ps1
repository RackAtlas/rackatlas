# Installs the RackAtlas agent on Windows 10/11 and Windows Server (2016 or newer).
#
# Run it in an elevated PowerShell (Run as administrator):
#
#   $env:RACKATLAS_URL='https://your-rackatlas'; $env:RACKATLAS_TOKEN='ra_...'; irm "$env:RACKATLAS_URL/agent/install.ps1" | iex
#
# It downloads the agent from RackAtlas, checks it against the published checksum, installs it as the Windows
# service "RackAtlasAgent" (starts with Windows, restarts itself after a failure) and starts it. The agent
# updates itself from then on: every update is signed with the RackAtlas key and checked before it is used.
#
# Remove it with:  & "$env:ProgramFiles\RackAtlas\rackatlas-agent.exe" uninstall [--purge]

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Fail($message) {
    Write-Host "Error: $message" -ForegroundColor Red
    throw $message
}

$url = "$env:RACKATLAS_URL".TrimEnd('/')
$token = "$env:RACKATLAS_TOKEN"

if ($url -notmatch '^https://') { Fail 'RACKATLAS_URL must be the https:// address of RackAtlas.' }
if ($token -notmatch '^ra_[A-Za-z0-9]{40}$') { Fail 'RACKATLAS_TOKEN is missing or has a wrong format.' }

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail 'Run PowerShell as administrator.'
}

# Older Windows PowerShell does not offer TLS 1.2 by default.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$arch = switch ($env:PROCESSOR_ARCHITEW6432, $env:PROCESSOR_ARCHITECTURE | Where-Object { $_ } | Select-Object -First 1) {
    'ARM64' { 'arm64' }
    'AMD64' { 'amd64' }
    default { Fail 'Only 64-bit Windows (x64 and ARM64) is supported.' }
}

$work = Join-Path ([IO.Path]::GetTempPath()) ('rackatlas-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null

try {
    $file = Join-Path $work 'rackatlas-agent.exe'

    Write-Host "Downloading the agent ($arch)..."
    Invoke-WebRequest -UseBasicParsing -Uri "$url/agent/windows/rackatlas-agent-$arch.exe" -OutFile $file

    $manifest = Invoke-RestMethod -UseBasicParsing -Uri "$url/agent/windows/manifest.json"
    $expected = $manifest.files.$arch.sha256

    if ($expected) {
        $actual = (Get-FileHash -Algorithm SHA256 -Path $file).Hash
        if ($actual -ne $expected) { Fail 'The downloaded file does not match the published checksum.' }
    }

    & $file install --url $url --token $token
    if ($LASTEXITCODE -ne 0) { Fail 'The installation failed.' }
}
finally {
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
    Remove-Item Env:RACKATLAS_TOKEN -ErrorAction SilentlyContinue
}
