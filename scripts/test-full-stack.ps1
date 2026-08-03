# scripts/test-full-stack.ps1
# Boot the backend services first so the API is reachable during the frontend build.

Write-Host "Starting backend datastores..."
docker compose -f docker-compose.test.yml up -d postgres redis minio meilisearch

Write-Host "Starting API..."
docker compose -f docker-compose.test.yml up -d api

Write-Host "Building and starting frontend..."
docker compose -f docker-compose.test.yml up -d --build web

Write-Host "Full stack is running. Storefront is at http://localhost:3000"
