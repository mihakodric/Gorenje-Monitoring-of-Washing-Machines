# Helper script to test the release deployment locally without pushing to GHCR
# This builds the images with a test tag and runs the deployment stack.

$ScriptDir = Split-Path $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..\..").Path
Write-Host "Setting working directory to project root: $ProjectRoot"
Set-Location $ProjectRoot

$ErrorActionPreference = "Stop"
$TestVersion = "v-local-test"
$RepoName = "mihakodric/Gorenje-Monitoring-of-Washing-Machines".ToLower()

Write-Host "Building images locally with tag: $TestVersion..." -ForegroundColor Yellow

# Build Frontend
Write-Host "Building Frontend..."
docker build -t ghcr.io/$RepoName-frontend:$TestVersion `
    -f Code/UI/frontend/Dockerfile.prod `
    Code/UI/frontend

# Build Backend
Write-Host "Building Backend..."
docker build -t ghcr.io/$RepoName-backend:$TestVersion `
    Code/UI/backend

# Build MQTT Worker
Write-Host "Building MQTT Worker..."
docker build -t ghcr.io/$RepoName-mqtt-worker:$TestVersion `
    Code/UI/mqtt_worker

Write-Host "Images built successfully." -ForegroundColor Green

# Prepare .env for deployment
if (-not (Test-Path deploy/windows/.env)) {
    Write-Host "Creating temporary .env from example..."
    Copy-Item deploy/windows/.env.example deploy/windows/.env
}

# Update .env to use the test version
Write-Host "Configuring .env to use version $TestVersion..."
(Get-Content deploy/windows/.env) -replace "^APP_VERSION=.*", "APP_VERSION=$TestVersion" | Set-Content deploy/windows/.env
(Get-Content deploy/windows/.env) -replace "^IMAGE_REPO=.*", "IMAGE_REPO=$RepoName" | Set-Content deploy/windows/.env

Write-Host "Stopping any previous test runs..."
docker compose -f deploy/windows/compose.yaml down

# Force cleanup of potentially conflicting development containers
Write-Host "Ensuring clean slate (removing potential dev containers)..."
$OldErrorAction = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
docker rm -f mosquitto timescaledb backend frontend mqtt-worker
$ErrorActionPreference = $OldErrorAction

Write-Host "Starting Deployment Stack..."
docker compose -f deploy/windows/compose.yaml up -d

Write-Host "Stack is running. Verify at http://localhost:3000" -ForegroundColor Green
Write-Host "Backend API is at http://localhost:3000/api"
Write-Host "Configured version: $TestVersion"
Pause
