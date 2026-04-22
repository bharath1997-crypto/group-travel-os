# Same Resend "Hello World" request as resend-hello-curl.sh — works in Windows PowerShell.
# Do not put your real API key in this file; set env vars in the current session.
#
#   $env:RESEND_API_KEY = "re_..."   # replace re_xxxxxxxxx with your key from https://resend.com/api-keys
#   $env:TEST_RESEND_TO = "you@example.com"
#   .\scripts\resend-hello-curl.ps1
#
# If you see "running scripts is disabled", run: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
# Or use Python (reads .env):  py -3 scripts\test_resend_hello.py

$ErrorActionPreference = "Stop"

$key = if ($env:RESEND_API_KEY) { $env:RESEND_API_KEY.Trim() } else { "" }
if ([string]::IsNullOrEmpty($key) -or $key -eq "re_xxxxxxxxx") {
    Write-Host "Set `$env:RESEND_API_KEY to your real key (not the placeholder re_xxxxxxxxx)." -ForegroundColor Red
    exit 1
}

$to = if ($env:TEST_RESEND_TO) { $env:TEST_RESEND_TO.Trim() } else { "" }
if ([string]::IsNullOrEmpty($to)) {
    Write-Host "Set `$env:TEST_RESEND_TO to the recipient email address." -ForegroundColor Red
    exit 1
}

$bodyObj = [ordered]@{
    from    = "onboarding@resend.dev"
    to      = $to
    subject = "Hello World"
    html    = "<p>Congrats on sending your <strong>first email</strong>!</p>"
}
$json = $bodyObj | ConvertTo-Json -Compress

$headers = @{ Authorization = "Bearer $key" }

try {
    $response = Invoke-RestMethod -Uri "https://api.resend.com/emails" -Method Post `
        -Headers $headers -Body $json -ContentType "application/json; charset=utf-8" -ErrorAction Stop
    $response | ConvertTo-Json -Depth 5
} catch {
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    throw
}
