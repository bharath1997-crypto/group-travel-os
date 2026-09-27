# Deploy from a reviewed container image that includes this Scaper code.
# Prerequisites: Cloud Run/Scheduler APIs, job identity Secret Manager access,
# and scheduler identity permission to invoke this Cloud Run job.
param(
    [Parameter(Mandatory = $true)][string]$ProjectId,
    [Parameter(Mandatory = $true)][string]$Image,
    [Parameter(Mandatory = $true)][string]$JobServiceAccount,
    [Parameter(Mandatory = $true)][string]$SchedulerServiceAccount,
    [string]$Region = 'asia-south1',
    [string]$JobName = 'rovvy-scaper-orlando',
    [string]$SchedulerName = 'rovvy-scaper-orlando-hourly'
)

$ErrorActionPreference = 'Stop'
$runUri = "https://run.googleapis.com/v2/projects/$ProjectId/locations/$Region/jobs/${JobName}:run"

$deployArgs = @(
    'run', 'jobs', 'deploy', $JobName,
    "--project=$ProjectId", "--region=$Region", "--image=$Image",
    "--service-account=$JobServiceAccount", '--tasks=1', '--parallelism=1',
    '--max-retries=0', '--task-timeout=30m', '--command=python',
    '--args=-m,scaper,run-due,--city-slug,orlando',
    '--set-secrets=DATABASE_URL=DATABASE_URL:latest,EVENTBRITE_TOKEN=EVENTBRITE_TOKEN:latest,TICKETMASTER_API_KEY=TICKETMASTER_API_KEY:latest'
)
& gcloud @deployArgs
if ($LASTEXITCODE -ne 0) { throw 'Cloud Run job deployment failed' }

& gcloud run jobs add-iam-policy-binding $JobName --project=$ProjectId --region=$Region --member="serviceAccount:$SchedulerServiceAccount" --role='roles/run.invoker'
if ($LASTEXITCODE -ne 0) { throw 'Could not grant scheduler job invocation' }

& gcloud scheduler jobs describe $SchedulerName --project=$ProjectId --location=$Region --format='value(name)' *> $null
if ($LASTEXITCODE -eq 0) {
    & gcloud scheduler jobs update http $SchedulerName --project=$ProjectId --location=$Region --schedule='0 * * * *' --time-zone='Etc/UTC' --uri=$runUri --http-method=POST --oauth-service-account-email=$SchedulerServiceAccount
} else {
    & gcloud scheduler jobs create http $SchedulerName --project=$ProjectId --location=$Region --schedule='0 * * * *' --time-zone='Etc/UTC' --uri=$runUri --http-method=POST --oauth-service-account-email=$SchedulerServiceAccount
}
if ($LASTEXITCODE -ne 0) { throw 'Cloud Scheduler configuration failed' }

Write-Host "Hourly Orlando trigger configured: $SchedulerName -> $JobName"
Write-Host 'Set the two Orlando source intervals to 60 minutes with python -m scaper set-city-interval --city-slug orlando --minutes 60.'
