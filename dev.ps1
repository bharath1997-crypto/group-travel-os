# From repo root: opens API (new window) and runs the Next.js dev server.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$python = if (Test-Path "$root\.venv\Scripts\python.exe") {
    "$root\.venv\Scripts\python.exe"
} else {
    "py"
}

$apiCmd = "Set-Location -LiteralPath '$root'; & '$python' run.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCmd

& "$root\frontend\dev.ps1"
