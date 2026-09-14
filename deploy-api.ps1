# PowerShell 1-Click Deployment Script for Backend API
param(
    [string]$Password = "captain42"
)

Write-Host "📦 Bundling Backend..." -ForegroundColor Cyan
Set-Location backend
tar -cvf ../backend.tar --exclude=".pytest_cache" --exclude="__pycache__" *
Set-Location ..

Write-Host "🚀 Deploying to CapRover (api)..." -ForegroundColor Green
npx caprover deploy -u https://captain.econmasteringbook.com -p $Password -a api -t backend.tar

Remove-Item backend.tar -ErrorAction SilentlyContinue
Write-Host "✅ Backend API Deployment Finished!" -ForegroundColor Green
