#Requires -Version 5.1
<#
  Group Travel OS - build image (Cloud Build) and deploy to Cloud Run.

  YOU (once): gcloud auth login, gcloud config set project,
    gcloud auth configure-docker REGION-docker.pkg.dev,
    create Artifact Registry repo, create Secret Manager secrets DATABASE_URL + SECRET_KEY,
    grant secretAccessor to Cloud Run runtime SA.

  OAuth (optional): store client secrets in Secret Manager (not plain env).
  From the JSON file Google downloads (client_secret_*.json):
    .\scripts\sync-google-oauth-from-json.ps1 -JsonPath "D:\path\to\client_secret....json"
  Or: echo -n YOUR_SECRET | gcloud secrets versions add GOOGLE_CLIENT_SECRET --data-file=-
  If secret GOOGLE_CLIENT_SECRET exists, deploy wires it automatically. GOOGLE_CLIENT_ID is read from
  -GoogleClientId or from .env when not passed.

  Before build: stop local Next.js (npm run dev) so frontend/.next locks do not break upload.

  Usage:
    .\scripts\deploy-cloud-run.ps1
    .\scripts\deploy-cloud-run.ps1 -ApiPublicUrl "https://group-travel-os-api-xxxxx.a.run.app"
    .\scripts\deploy-cloud-run.ps1 -SkipBuild
    .\scripts\deploy-cloud-run.ps1 -GoogleClientId "xxx.apps.googleusercontent.com" -GoogleClientSecretSecret "GOOGLE_CLIENT_SECRET"
#>

# Script directory (PSScriptRoot is not reliable inside nested functions).
$DeployScriptDir = $PSScriptRoot

function Get-DotEnvValue {
    param([string] $FilePath, [string] $Name)
    if (-not (Test-Path -LiteralPath $FilePath)) { return $null }
    foreach ($line in Get-Content -LiteralPath $FilePath) {
        if ($line -match '^\s*#' -or $line -notmatch '\S') { continue }
        if ($line -match ('^' + [regex]::Escape($Name) + '\s*=\s*(.*)$')) {
            $v = $Matches[1].Trim()
            if ($v.Length -ge 2 -and $v.StartsWith('"') -and $v.EndsWith('"')) {
                $v = $v.Substring(1, $v.Length - 2)
            }
            return $v
        }
    }
    return $null
}

function Test-GcloudSecretExists {
    param([string] $Project, [string] $SecretName)
    if (-not $SecretName) { return $false }
    & gcloud @('secrets', 'describe', $SecretName, '--project', $Project, '--quiet') 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Invoke-DeployCloudRun {
    [CmdletBinding()]
    param(
        [string] $ProjectId = "group-travel-os",
        [string] $Region = "asia-south1",
        [string] $ArtifactRepo = "cloud-run",
        [string] $ServiceName = "group-travel-os-api",
        [string] $ImageName = "group-travel-os-api",
        [string] $Tag = "latest",
        [string] $FrontendUrl = "https://group-travel-os.vercel.app",
        [string] $ApiPublicUrl,
        [string] $AllowedOrigin = "https://group-travel-os.vercel.app",
        [string] $DatabaseSecret = "DATABASE_URL",
        [string] $SecretKeySecret = "SECRET_KEY",
        [string] $GoogleClientId,
        [string] $GoogleClientSecretSecret = "GOOGLE_CLIENT_SECRET",
        [string] $FacebookAppId,
        [string] $FacebookAppSecretSecret,
        [string] $Memory = "512Mi",
        [switch] $SkipBuild
    )

    $ErrorActionPreference = "Stop"

    $Root = Resolve-Path (Join-Path $DeployScriptDir "..")
    # Use ${Region} so -docker is not parsed as subtraction; image ref is region-docker.pkg.dev/...
    $image = "${Region}-docker.pkg.dev/${ProjectId}/${ArtifactRepo}/${ImageName}:${Tag}"
    # Single origin URL - do NOT use JSON here: gcloud --set-env-vars splits on commas and breaks ["..."].

    # gcloud.ps1 forwards Python stderr; with $ErrorActionPreference Stop that becomes a terminating error.
    $prevEap = $ErrorActionPreference
    Push-Location $Root
    try {
        $ErrorActionPreference = "Continue"

        Write-Host "Project root: $Root" -ForegroundColor Cyan

        & gcloud @('config', 'set', 'project', $ProjectId, '--quiet')
        if ($LASTEXITCODE -ne 0) { throw "gcloud config set project failed: $LASTEXITCODE" }

        if (-not $SkipBuild) {
            Write-Host "Building and pushing: $image" -ForegroundColor Cyan
            & gcloud @('builds', 'submit', '--tag', $image, '.')
            if ($LASTEXITCODE -ne 0) { throw "gcloud builds submit failed: $LASTEXITCODE" }
        }
        else {
            Write-Host ('SkipBuild: reusing existing image {0}' -f $image) -ForegroundColor Yellow
        }

        $secretPairs = @(
            "DATABASE_URL=$($DatabaseSecret):latest",
            "SECRET_KEY=$($SecretKeySecret):latest"
        )
        if ($GoogleClientSecretSecret -and (Test-GcloudSecretExists -Project $ProjectId -SecretName $GoogleClientSecretSecret)) {
            $secretPairs += "GOOGLE_CLIENT_SECRET=$($GoogleClientSecretSecret):latest"
            Write-Host "Including Secret Manager: GOOGLE_CLIENT_SECRET -> $($GoogleClientSecretSecret)" -ForegroundColor DarkGray
        }
        elseif ($GoogleClientSecretSecret) {
            Write-Warning "Secret '$GoogleClientSecretSecret' not found in Secret Manager - Google OAuth secret will not be set. Create the secret or pass -GoogleClientSecretSecret '' to silence."
        }
        if ($FacebookAppSecretSecret -and (Test-GcloudSecretExists -Project $ProjectId -SecretName $FacebookAppSecretSecret)) {
            $secretPairs += "FACEBOOK_APP_SECRET=$($FacebookAppSecretSecret):latest"
            Write-Host "Including Secret Manager: FACEBOOK_APP_SECRET -> $($FacebookAppSecretSecret)" -ForegroundColor DarkGray
        }
        elseif ($FacebookAppSecretSecret) {
            Write-Warning "Secret '$FacebookAppSecretSecret' not found - Facebook OAuth secret will not be set."
        }
        $secretSpec = $secretPairs -join ","

        if (-not $GoogleClientId) {
            $dotEnvPath = Join-Path $Root ".env"
            $GoogleClientId = Get-DotEnvValue -FilePath $dotEnvPath -Name "GOOGLE_CLIENT_ID"
        }
        if (-not $FacebookAppId) {
            $dotEnvPath = Join-Path $Root ".env"
            $FacebookAppId = Get-DotEnvValue -FilePath $dotEnvPath -Name "FACEBOOK_APP_ID"
        }

        $envVars = @(
            'ENVIRONMENT=production',
            'DEBUG=False',
            "FRONTEND_URL=$FrontendUrl",
            "ALLOWED_ORIGINS=$AllowedOrigin"
        )
        if ($ApiPublicUrl) {
            $envVars += "API_PUBLIC_URL=$ApiPublicUrl"
        }
        else {
            Write-Warning 'ApiPublicUrl is empty. Set API_PUBLIC_URL after first deploy for OAuth.'
        }
        if ($GoogleClientId) {
            $envVars += "GOOGLE_CLIENT_ID=$GoogleClientId"
            Write-Host "GOOGLE_CLIENT_ID set from parameter or .env" -ForegroundColor DarkGray
        }
        if ($FacebookAppId) {
            $envVars += "FACEBOOK_APP_ID=$FacebookAppId"
        }
        $envString = $envVars -join ","

        Write-Host "Deploying Cloud Run service: $ServiceName" -ForegroundColor Cyan
        # Pass gcloud flags as separate arguments so PowerShell does not parse -- as an operator.
        & gcloud @(
            'run', 'deploy', $ServiceName,
            '--image', $image,
            '--platform', 'managed',
            '--region', $Region,
            '--allow-unauthenticated',
            '--port', '8080',
            '--memory', $Memory,
            '--set-secrets', $secretSpec,
            '--set-env-vars', $envString
        )
        if ($LASTEXITCODE -ne 0) { throw "gcloud run deploy failed: $LASTEXITCODE" }

        $fmt = 'value(status.url)'
        & gcloud @('run', 'services', 'describe', $ServiceName, '--region', $Region, '--format', $fmt)
        if ($LASTEXITCODE -ne 0) { throw "gcloud run services describe failed: $LASTEXITCODE" }
    }
    finally {
        $ErrorActionPreference = $prevEap
        Pop-Location
    }
}

Invoke-DeployCloudRun @PSBoundParameters
