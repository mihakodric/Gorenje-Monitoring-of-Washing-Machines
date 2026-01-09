$ErrorActionPreference = "Stop"

if (-not (Test-Path .env)) {
    Write-Host "Error: .env file not found. Please copy .env.example to .env and configure it." -ForegroundColor Red
    Pause
    exit
}

$version = Read-Host -Prompt 'Input version tag (e.g. v1.2.3)'
if ([string]::IsNullOrWhiteSpace($version)) {
    Write-Host "Version is required." -ForegroundColor Red
    Pause
    exit
}

Write-Host "Updating APP_VERSION to $version in .env..."
(Get-Content .env) -replace "^APP_VERSION=.*", "APP_VERSION=$version" | Set-Content .env

Write-Host "Pulling images..."
docker compose pull

Write-Host "Starting services..."
docker compose up -d

Write-Host "Cleaning up old images..."
docker image prune -f

Write-Host "Update completed successfully." -ForegroundColor Green
Pause
