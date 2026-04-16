# Next.js dev server — prepends Node.js to PATH when npm is not found (common on Windows).
$nodeDir = "C:\Program Files\nodejs"
if (Test-Path "$nodeDir\node.exe") {
    $env:Path = "$nodeDir;" + $env:Path
}
Set-Location $PSScriptRoot
npm run dev
