#Requires -Version 5.1
<#
  Store DeepSeek API key in Google Secret Manager for Cloud Run (Wayra compact summaries).

  Usage (paste your sk-... key when prompted):
    .\scripts\sync-deepseek-key.ps1

  Or non-interactive:
    .\scripts\sync-deepseek-key.ps1 -ApiKey "sk-..."
#>
param(
    [string] $ProjectId = "group-travel-os",
    [string] $SecretName = "DEEPSEEK_API_KEY",
    [string] $ApiKey
)

$ErrorActionPreference = "Stop"

if (-not $ApiKey) {
    $secure = Read-Host "DeepSeek API key (sk-...)" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

if (-not $ApiKey) {
    $ApiKey = ""
}
$ApiKey = $ApiKey.Trim()
if (-not $ApiKey) {
    throw "API key is empty."
}

& gcloud config set project $ProjectId --quiet
if ($LASTEXITCODE -ne 0) { throw "gcloud config set project failed: $LASTEXITCODE" }

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& gcloud secrets describe $SecretName --project=$ProjectId --quiet 2>$null | Out-Null
$secretMissing = ($LASTEXITCODE -ne 0)
$ErrorActionPreference = $prevEap

if ($secretMissing) {
    Write-Host "Creating secret $SecretName ..." -ForegroundColor Cyan
    & gcloud secrets create $SecretName --project=$ProjectId --replication-policy="automatic" --quiet
    if ($LASTEXITCODE -ne 0) { throw "gcloud secrets create failed: $LASTEXITCODE" }
}

$tmp = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tmp, $ApiKey, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Adding new version to $SecretName ..." -ForegroundColor Cyan
    & gcloud secrets versions add $SecretName --project=$ProjectId --data-file=$tmp --quiet
    if ($LASTEXITCODE -ne 0) { throw "gcloud secrets versions add failed: $LASTEXITCODE" }
} finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Done. Secret $SecretName updated in project $ProjectId." -ForegroundColor Green
Write-Host "Next: wire Cloud Run (one-time, or wait for next Production-main deploy):" -ForegroundColor Yellow
Write-Host @"

  gcloud run services update group-travel-os-api `
    --region asia-south1 `
    --project $ProjectId `
    --update-secrets DEEPSEEK_API_KEY=DEEPSEEK_API_KEY:latest

"@ -ForegroundColor DarkGray
