$ErrorActionPreference = "Stop"

if (-not (Test-Path .env)) {
    Write-Host "Error: .env file not found. Please copy .env.example to .env and configure it." -ForegroundColor Red
    Pause
    exit
}

Write-Host "Pulling images..."
docker compose pull

Write-Host "Starting services..."
docker compose up -d

Write-Host "Cleaning up old images..."
docker image prune -f

Write-Host "Update completed successfully." -ForegroundColor Green
Pause
