<#
.SYNOPSIS
  Deploy Scaper as a Cloud Run Job (us-west1, next to the Supabase us-west-2 DB)
  and trigger `python -m scaper run-due` hourly with Cloud Scheduler.

.DESCRIPTION
  run-due only runs sources whose interval_minutes has elapsed (default 6 h), so an
  hourly trigger keeps every source on schedule; idle runs exit in seconds.

  Prerequisites (one time):
    - Secret Manager secrets DATABASE_URL, EVENTBRITE_TOKEN, TICKETMASTER_API_KEY.
      TICKETMASTER_API_KEY is not used by the API deploy yet; create it with:
        "<key>" | gcloud secrets create TICKETMASTER_API_KEY --data-file=-
    - APIs: run.googleapis.com, cloudscheduler.googleapis.com, cloudbuild.googleapis.com

.EXAMPLE
  .\scripts\deploy-scaper-job.ps1
  .\scripts\deploy-scaper-job.ps1 -Schedule "15 * * * *"
#>
param(
    [string]$Project = "",
    [string]$Region = "us-west1",
    [string]$JobName = "scaper-run-due",
    [string]$Schedule = "5 * * * *",
    [string]$TimeZone = "Etc/UTC",
    [string]$SchedulerServiceAccount = "scaper-scheduler"
)

$ErrorActionPreference = "Stop"

function Invoke-Gcloud([string[]]$GcloudArgs) {
    & gcloud @GcloudArgs
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed: gcloud $($GcloudArgs -join ' ')" }
}

if (-not $Project) { $Project = (& gcloud config get-value project 2>$null).Trim() }
if (-not $Project) { throw "No GCP project. Pass -Project or run: gcloud config set project <id>" }
Write-Host "Project: $Project  Region: $Region  Job: $JobName  Schedule: '$Schedule' ($TimeZone)"

foreach ($secret in @("DATABASE_URL", "EVENTBRITE_TOKEN", "TICKETMASTER_API_KEY")) {
    & gcloud secrets describe $secret --project $Project *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Missing Secret Manager secret '$secret'. Create it first (see script header)."
    }
}

# 1. Job: same image as the API (Dockerfile copies scaper/), different command.
Invoke-Gcloud @(
    "run", "jobs", "deploy", $JobName,
    "--project", $Project,
    "--region", $Region,
    "--source", ".",
    "--command", "python",
    "--args", "-m,scaper,run-due",
    "--memory", "512Mi",
    "--cpu", "1",
    "--task-timeout", "3600s",
    "--max-retries", "0",
    "--set-secrets", "DATABASE_URL=DATABASE_URL:latest,EVENTBRITE_TOKEN=EVENTBRITE_TOKEN:latest,TICKETMASTER_API_KEY=TICKETMASTER_API_KEY:latest"
)

# 2. Least-privilege identity that may only start this job.
$saEmail = "$SchedulerServiceAccount@$Project.iam.gserviceaccount.com"
& gcloud iam service-accounts describe $saEmail --project $Project *> $null
if ($LASTEXITCODE -ne 0) {
    Invoke-Gcloud @("iam", "service-accounts", "create", $SchedulerServiceAccount,
        "--project", $Project, "--display-name", "Scaper scheduler (runs $JobName)")
}
Invoke-Gcloud @(
    "run", "jobs", "add-iam-policy-binding", $JobName,
    "--project", $Project, "--region", $Region,
    "--member", "serviceAccount:$saEmail",
    "--role", "roles/run.invoker"
)

# 3. Hourly trigger (create, or update if it already exists).
$runUri = "https://run.googleapis.com/v2/projects/$Project/locations/$Region/jobs/${JobName}:run"
$schedulerName = "$JobName-hourly"
$common = @(
    "--project", $Project,
    "--location", $Region,
    "--schedule", $Schedule,
    "--time-zone", $TimeZone,
    "--uri", $runUri,
    "--http-method", "POST",
    "--oauth-service-account-email", $saEmail
)
& gcloud scheduler jobs describe $schedulerName --project $Project --location $Region *> $null
if ($LASTEXITCODE -eq 0) {
    Invoke-Gcloud (@("scheduler", "jobs", "update", "http", $schedulerName) + $common)
} else {
    Invoke-Gcloud (@("scheduler", "jobs", "create", "http", $schedulerName) + $common)
}

Write-Host ""
Write-Host "Done. Run once now and watch it:"
Write-Host "  gcloud run jobs execute $JobName --project $Project --region $Region --wait"
