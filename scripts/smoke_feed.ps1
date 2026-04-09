# Smoke test: login + feed endpoints (Group Travel OS)
# Run from repo root:
#   pwsh -File scripts/smoke_feed.ps1
# Or (Windows PowerShell 5.1):
#   powershell -ExecutionPolicy Bypass -File scripts/smoke_feed.ps1
#
# Optional env vars (defaults for local dev):
#   $env:SMOKE_API_BASE = "http://localhost:8000"
#   $env:SMOKE_EMAIL    = "ram2@example.com"
#   $env:SMOKE_PASSWORD = "testpass123"

param(
    [string] $ApiBase = $(if ($env:SMOKE_API_BASE) { $env:SMOKE_API_BASE } else { "http://localhost:8000" }),
    [string] $Email = $(if ($env:SMOKE_EMAIL) { $env:SMOKE_EMAIL } else { "ram2@example.com" }),
    [string] $Password = $(if ($env:SMOKE_PASSWORD) { $env:SMOKE_PASSWORD } else { "testpass123" })
)

$ErrorActionPreference = "Stop"

function Invoke-ApiJson {
    param(
        [string] $Method = "GET",
        [string] $Uri,
        [hashtable] $Headers = @{},
        [object] $Body = $null,
        [string] $ContentType = $null,
        [switch] $AllowErrorStatus
    )

    $params = @{
        Uri             = $Uri
        Method          = $Method
        Headers         = $Headers
        UseBasicParsing = $true
    }
    if ($null -ne $Body) {
        $params.Body = $Body
    }
    if ($ContentType) {
        $params.ContentType = $ContentType
    }
    if ($AllowErrorStatus -and $PSVersionTable.PSVersion.Major -ge 7) {
        $params.SkipHttpErrorCheck = $true
    }

    try {
        $resp = Invoke-WebRequest @params
        $data = $null
        if ($resp.Content) {
            $data = $resp.Content | ConvertFrom-Json
        }
        return [PSCustomObject]@{
            Success = ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300)
            Status  = [int]$resp.StatusCode
            Data    = $data
        }
    } catch {
        # PS 5.1 path when SkipHttpErrorCheck not available
        $ex = $_.Exception
        $r = $ex.Response
        if ($r -and $AllowErrorStatus) {
            $stream = $r.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $txt = $reader.ReadToEnd()
            $data = $null
            if ($txt) {
                $data = $txt | ConvertFrom-Json
            }
            return [PSCustomObject]@{
                Success = $false
                Status  = [int]$r.StatusCode
                Data    = $data
            }
        }
        throw
    }
}

Write-Host "`n=== 1. Login (JSON body: email + password) ===" -ForegroundColor Cyan
$loginBody = (@{ email = $Email; password = $Password } | ConvertTo-Json)
$login = Invoke-ApiJson -Method POST `
    -Uri "$ApiBase/api/v1/auth/login" `
    -Headers @{} `
    -Body $loginBody `
    -ContentType "application/json"

if (-not $login.Success) {
    Write-Host "Login failed: status $($login.Status)" -ForegroundColor Red
    $login.Data | ConvertTo-Json -Depth 5
    exit 1
}

$token = $login.Data.token.access_token
Write-Host ("OK - token acquired (first 32 chars): {0}..." -f $token.Substring(0, [Math]::Min(32, $token.Length)))

$auth = @{ Authorization = "Bearer $token" }

Write-Host "`n=== 2. GET /feed/trending ===" -ForegroundColor Cyan
$trending = Invoke-ApiJson -Method GET -Uri "$ApiBase/api/v1/feed/trending" -Headers $auth
Write-Host "Status $($trending.Status) | items count: $($trending.Data.items.Count) | total: $($trending.Data.total) | pages: $($trending.Data.pages)"
$trending.Data | ConvertTo-Json -Depth 5

Write-Host "`n=== 3. GET /feed/trending?category=invalid (expect 400) ===" -ForegroundColor Cyan
$badCat = Invoke-ApiJson -Method GET `
    -Uri "$ApiBase/api/v1/feed/trending?category=invalid" `
    -Headers $auth `
    -AllowErrorStatus
Write-Host "Status $($badCat.Status) (expect 400)"
$badCat.Data | ConvertTo-Json -Depth 3

Write-Host "`n=== 4. GET /feed/search?q=a (expect 400) ===" -ForegroundColor Cyan
$shortQ = Invoke-ApiJson -Method GET `
    -Uri "$ApiBase/api/v1/feed/search?q=a" `
    -Headers $auth `
    -AllowErrorStatus
Write-Host "Status $($shortQ.Status) (expect 400)"
$shortQ.Data | ConvertTo-Json -Depth 3

Write-Host "`n=== 5. GET /feed/search?q=au (expect 200) ===" -ForegroundColor Cyan
$search = Invoke-ApiJson -Method GET -Uri "$ApiBase/api/v1/feed/search?q=au" -Headers $auth
Write-Host "Status $($search.Status) | total: $($search.Data.total)"
$search.Data | ConvertTo-Json -Depth 5

$sampleId = $trending.Data.items[0].id
Write-Host "`n=== 6. GET /feed/destinations/{id} (expect 200) ===" -ForegroundColor Cyan
$detail = Invoke-ApiJson -Method GET -Uri "$ApiBase/api/v1/feed/destinations/$sampleId" -Headers $auth
Write-Host "Status $($detail.Status) | name: $($detail.Data.name)"
$detail.Data | ConvertTo-Json -Depth 5

Write-Host "`n=== 7. GET nil UUID (expect 404) ===" -ForegroundColor Cyan
$nil = Invoke-ApiJson -Method GET `
    -Uri "$ApiBase/api/v1/feed/destinations/00000000-0000-0000-0000-000000000000" `
    -Headers $auth `
    -AllowErrorStatus
Write-Host "Status $($nil.Status) (expect 404)"
$nil.Data | ConvertTo-Json -Depth 3

Write-Host ""
Write-Host "Done." -ForegroundColor Green
