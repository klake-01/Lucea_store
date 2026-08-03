#!/bin/bash
# scripts/test-full-stack.sh
# Boot the backend services first so the API is reachable during the frontend build.

set -e

echo "Starting backend datastores..."
docker compose -f docker-compose.test.yml up -d postgres redis minio meilisearch

echo "Waiting for datastores to be healthy..."
# A simple wait, Docker compose depends_on will handle the actual wait for api
docker compose -f docker-compose.test.yml up -d api

echo "Waiting for API to be healthy..."
# We wait for API specifically so we can build the frontend with articles if we wanted to
# But for now, we just build the frontend
echo "Building and starting frontend..."
docker compose -f docker-compose.test.yml up -d --build web

echo "Full stack is running. Storefront is at http://localhost:3000"
