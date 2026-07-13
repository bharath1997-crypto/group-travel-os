# Sync Production-main -> main so Vercel deploys rovvy.app
# Run whenever YOU want the live site updated (daily cron also runs at 2 AM UTC).
#
# Usage (from repo root):
#   .\scripts\sync-to-main.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$returnBranch = git branch --show-current

Write-Host "Fetching origin/main and origin/Production-main..."
git fetch origin main Production-main

Write-Host "Merging Production-main into main..."
git checkout main
git pull origin main
git merge origin/Production-main -m "chore: sync Production-main to main for Vercel deploy"
git push origin main

if ($returnBranch -and $returnBranch -ne "main") {
  git checkout $returnBranch
}

Write-Host ""
Write-Host "Done. Vercel will build and deploy from main shortly."
Write-Host "Check: https://vercel.com/dashboard (Production deployment -> Ready)"
