#Requires -Version 5.1
<#
  Upload Google OAuth client_secret from the JSON file Google Cloud Console downloads
  into Secret Manager as GOOGLE_CLIENT_SECRET (for Cloud Run).

  The JSON path is NOT committed (see .gitignore: client_secret*.json).

  Usage:
    .\scripts\sync-google-oauth-from-json.ps1 -JsonPath "D:\path\to\client_secret_....json"
    .\scripts\sync-google-oauth-from-json.ps1 -JsonPath "..." -ProjectId "group-travel-os" -DryRun

  After this, run deploy-cloud-run.ps1; GOOGLE_CLIENT_ID is read from .env or pass -GoogleClientId.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $JsonPath,
    [string] $ProjectId = "group-travel-os",
    [string] $SecretName = "GOOGLE_CLIENT_SECRET",
    [switch] $DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $JsonPath)) {
    throw "File not found: $JsonPath"
}

$raw = Get-Content -LiteralPath $JsonPath -Raw -Encoding UTF8
$j = $raw | ConvertFrom-Json
if (-not $j.web) {
    throw "JSON must have a web object (standard Google OAuth client download)."
}
$clientId = $j.web.client_id
$clientSecret = $j.web.client_secret
if (-not $clientId -or -not $clientSecret) {
    throw "JSON missing web.client_id or web.client_secret."
}

Write-Host "client_id (public): $clientId" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "DryRun: would add Secret Manager version to $SecretName and set GOOGLE_CLIENT_ID in .env (append line if missing)." -ForegroundColor Yellow
    exit 0
}

& gcloud config set project $ProjectId --quiet
if ($LASTEXITCODE -ne 0) { throw "gcloud config set project failed: $LASTEXITCODE" }

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& gcloud secrets describe $SecretName --project=$ProjectId --quiet 2>$null | Out-Null
$ErrorActionPreference = $prevEap
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating secret $SecretName ..." -ForegroundColor Cyan
    & gcloud secrets create $SecretName --project=$ProjectId --replication-policy="automatic" --quiet
    if ($LASTEXITCODE -ne 0) { throw "gcloud secrets create failed: $LASTEXITCODE" }
}

$tmp = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tmp, $clientSecret, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Adding new version to $SecretName ..." -ForegroundColor Cyan
    & gcloud secrets versions add $SecretName --project=$ProjectId --data-file=$tmp --quiet
    if ($LASTEXITCODE -ne 0) { throw "gcloud secrets versions add failed: $LASTEXITCODE" }
}
finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $root ".env"
if (Test-Path -LiteralPath $envFile) {
    $content = Get-Content -LiteralPath $envFile -Raw
    if ($content -notmatch "(?m)^GOOGLE_CLIENT_ID\s*=") {
        Add-Content -LiteralPath $envFile -Value "`nGOOGLE_CLIENT_ID=$clientId" -Encoding UTF8
        Write-Host "Appended GOOGLE_CLIENT_ID to .env" -ForegroundColor Green
    }
    else {
        Write-Host ".env already has GOOGLE_CLIENT_ID - update it manually if it changed." -ForegroundColor Yellow
    }
}
else {
    Write-Host "No .env file; add this line to .env or pass -GoogleClientId to deploy:" -ForegroundColor Yellow
    Write-Host "GOOGLE_CLIENT_ID=$clientId"
}

Write-Host "Done. Ensure the Cloud Run service account can access $SecretName (secretAccessor). Then deploy." -ForegroundColor Green
