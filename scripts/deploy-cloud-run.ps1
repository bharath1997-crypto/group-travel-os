#Requires -Version 5.1
<#
  Group Travel OS - build image (Cloud Build) and deploy to Cloud Run.

  YOU (once): gcloud auth login, gcloud config set project,
    gcloud auth configure-docker REGION-docker.pkg.dev,
    create Artifact Registry repo, create Secret Manager secrets DATABASE_URL + SECRET_KEY,
    grant secretAccessor to Cloud Run runtime SA.

  Before build: stop local Next.js (npm run dev) so frontend/.next locks do not break upload.

  Usage:
    .\scripts\deploy-cloud-run.ps1
    .\scripts\deploy-cloud-run.ps1 -ApiPublicUrl "https://group-travel-os-api-xxxxx.a.run.app"
    .\scripts\deploy-cloud-run.ps1 -SkipBuild
#>
[CmdletBinding()]
param(
    [string] $ProjectId = "group-travel-os",
    [string] $Region = "asia-south1",
    [string] $ArtifactRepo = "cloud-run",
    [string] $ServiceName = "group-travel-os-api",
    [string] $ImageName = "group-travel-os-api",
    [string] $Tag = "latest",
    [string] $FrontendUrl = "https://group-travel-os.vercel.app",
    [string] $ApiPublicUrl = "",
    [string] $AllowedOrigin = "https://group-travel-os.vercel.app",
    [string] $DatabaseSecret = "DATABASE_URL",
    [string] $SecretKeySecret = "SECRET_KEY",
    [string] $Memory = "512Mi",
    [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$image = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/${ImageName}:$Tag"
$allowedJson = '[{0}{1}{0}]' -f '"', $AllowedOrigin

# gcloud.ps1 forwards Python stderr; with $ErrorActionPreference Stop that becomes a terminating error.
$prevEap = $ErrorActionPreference
Push-Location $Root
try {
    $ErrorActionPreference = "Continue"

    Write-Host "Project root: $Root" -ForegroundColor Cyan

    & gcloud config set project $ProjectId --quiet
    if ($LASTEXITCODE -ne 0) { throw "gcloud config set project failed: $LASTEXITCODE" }

    if (-not $SkipBuild) {
        Write-Host "Building and pushing: $image" -ForegroundColor Cyan
        & gcloud builds submit --tag $image .
        if ($LASTEXITCODE -ne 0) { throw "gcloud builds submit failed: $LASTEXITCODE" }
    }
    else {
        Write-Host "SkipBuild: using existing $image" -ForegroundColor Yellow
    }

    $secretSpec = 'DATABASE_URL={0}:latest,SECRET_KEY={1}:latest' -f $DatabaseSecret, $SecretKeySecret

    $envVars = @(
        'ENVIRONMENT=production',
        'DEBUG=False',
        "FRONTEND_URL=$FrontendUrl",
        "ALLOWED_ORIGINS=$allowedJson"
    )
    if ($ApiPublicUrl) {
        $envVars += "API_PUBLIC_URL=$ApiPublicUrl"
    }
    else {
        Write-Warning 'ApiPublicUrl is empty. Set API_PUBLIC_URL after first deploy for OAuth.'
    }
    $envString = $envVars -join ","

    Write-Host "Deploying Cloud Run service: $ServiceName" -ForegroundColor Cyan
    & gcloud run deploy $ServiceName `
        --image $image `
        --platform managed `
        --region $Region `
        --allow-unauthenticated `
        --port 8080 `
        --memory $Memory `
        --set-secrets $secretSpec `
        --set-env-vars $envString
    if ($LASTEXITCODE -ne 0) { throw "gcloud run deploy failed: $LASTEXITCODE" }

    $fmt = 'value(status.url)'
    & gcloud run services describe $ServiceName --region $Region --format=$fmt
    if ($LASTEXITCODE -ne 0) { throw "gcloud run services describe failed: $LASTEXITCODE" }
}
finally {
    $ErrorActionPreference = $prevEap
    Pop-Location
}
