# PowerShell 1-Click Deployment Script for Frontend Web App
param(
    [string]$Password = "captain42"
)

Write-Host "📦 Bundling Frontend..." -ForegroundColor Cyan
Set-Location frontend
tar -cvf ../frontend.tar --exclude="node_modules" --exclude="dist" *
Set-Location ..

Write-Host "🚀 Deploying to CapRover (web)..." -ForegroundColor Green
npx caprover deploy -u https://captain.econmasteringbook.com -p $Password -a web -t frontend.tar

Remove-Item frontend.tar -ErrorAction SilentlyContinue
Write-Host "✅ Frontend Web Deployment Finished!" -ForegroundColor Green
