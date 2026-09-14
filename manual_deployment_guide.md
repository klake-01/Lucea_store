# The Definitive Full-Stack Production Deployment & Operations Manual
## CapRover + Cloudflare Zero-Trust Tunnels + Docker Swarm + CI/CD Workflow
*A Complete, Beginner-to-Expert Master Guide for Any Full-Stack Application*

---

## 📑 Table of Contents
1. [Architecture & The Zero-Port Security Model](#1-architecture--the-zero-port-security-model)
2. [Complete Domain Setup: From Purchase to Cloudflare Edge](#2-complete-domain-setup-from-purchase-to-cloudflare-edge)
3. [Cloudflare Zero-Trust Tunnel Setup (The Magic Bridge)](#3-cloudflare-zero-trust-tunnel-setup-the-magic-bridge)
4. [CapRover Master Setup on Ubuntu Server](#4-caprover-master-setup-on-ubuntu-server)
5. [Real-World Case Study: Lucea Store Post-Mortem (All Errors & Fixes)](#5-real-world-case-study-lucea-store-post-mortem-all-errors--fixes)
6. [Universal Blueprint: Deploying ANY Full-Stack App (Web + API + DB + Cache)](#6-universal-blueprint-deploying-any-full-stack-app-web--api--db--cache)
7. [Custom Domains & Brand Names (Beyond CapRover Subdomains)](#7-custom-domains--brand-names-beyond-caprover-subdomains)
8. [Controlling, Monitoring & Scaling in Production](#8-controlling-monitoring--scaling-in-production)
9. [Local AI-Powered Development, Testing & Instant Redeployment](#9-local-ai-powered-development-testing--instant-redeployment)
10. [Emergency Recovery & Disaster Cheat Sheet](#10-emergency-recovery--disaster-cheat-sheet)

---

## 1. Architecture & The Zero-Port Security Model

### 1.1 The Golden Architecture Diagram

```
                                  PUBLIC INTERNET (Visitors & Shoppers)
                                                   │
                                                   ▼
                                     ┌───────────────────────────┐
                                     │   Cloudflare Edge (DNS)   │
                                     │  • Free Universal SSL     │
                                     │  • DDoS / WAF Protection  │
                                     │  • CDN / Static Caching   │
                                     └─────────────┬─────────────┘
                                                   │
                                                   ▼ (Encrypted Tunnel over outbound HTTPS)
                                     ┌───────────────────────────┐
                                     │ Cloudflare Zero-Trust     │
                                     │ Tunnel Daemon (cloudflared│
                                     └─────────────┬─────────────┘
                                                   │ (Forwards to localhost:80)
                                                   ▼
                        ┌─────────────────────────────────────────────────────┐
                        │             UBUNTU SERVER (Docker Swarm)            │
                        │                                                     │
                        │   CapRover Shared Nginx Ingress (Port 80)           │
                        │   (Routes traffic strictly by Host Header)          │
                        └───────────┬──────────────┬──────────────┬───────────┘
                                    │              │              │
       ┌────────────────────────────┘              │              └───────────────────────────┐
       ▼                                           ▼                                          ▼
┌───────────────────────────┐       ┌───────────────────────────┐       ┌───────────────────────────┐
│     Web Container(s)      │       │     API Container(s)      │       │   Postgres DB Container   │
│   (srv-captain--web)      │       │     (srv-captain--api)    │       │  (srv-captain--postgres)  │
│ • Vite SPA Static Dist    │       │ • FastAPI / Node / Django │       │ • PostgreSQL 16           │
│ • Internal Nginx Proxy    │──────▶│ • Port 8000 (Internal)    │──────▶│ • Port 5432 (Internal)    │
│ • Port 80 (Internal)      │       │ • Stateless               │       │ • Persistent Docker Volume│
└───────────────────────────┘       └──────────────┬────────────┘       └───────────────────────────┘
       ▲                                           │                                  ▲
       │                                           ▼                                  │
https://yourdomain.com              ┌───────────────────────────┐                     │
https://www.yourdomain.com          │   Redis Cache Container   │                     │
                                    │   (srv-captain--redis)    │─────────────────────┘
                                    │ • In-memory Sessions/TTL  │
                                    │ • Port 6379 (Internal)    │
                                    └───────────────────────────┘
```

### 1.2 The "Zero Public Ports" Security Philosophy
Traditional deployment tutorials instruct you to open ports `80`, `443`, `3000`, `8000`, and `5432` in your server's firewall (`ufw`). **This is insecure and outdated.**

With the **Cloudflare Tunnel + CapRover Architecture**:
1. **Zero Open Ports Required on Firewall:** Your server firewall can drop all incoming public connections. The `cloudflared` daemon creates an *outbound-only* connection to Cloudflare's network.
2. **CapRover Internal Reverse Proxy:** All web traffic enters through `cloudflared` into CapRover's Nginx on port `80`. Nginx inspects the HTTP `Host` header (`yourdomain.com`, `api.yourdomain.com`) and proxies internally to Docker Swarm overlay networks (`captain-overlay-network`).
3. **Total Database Isolation:** PostgreSQL and Redis containers do **not** have public URLs or published host ports. They can only be reached by containers on the same Docker overlay network using internal DNS names (e.g., `srv-captain--postgres:5432`).

---

## 2. Complete Domain Setup: From Purchase to Cloudflare Edge

A step-by-step walkthrough for absolute beginners.

### Step 2.1: Buy a Domain Name
You can buy a domain from any reputable ICANN-accredited registrar:
- **Cloudflare Registrar:** (Cheapest wholesale prices, no renewal markup).
- **Namecheap / Porkbun / Hostinger:** (Widely used, accepts multiple payment methods).

*Example domain:* `mycoolstore.com`

### Step 2.2: Add Domain to Cloudflare
1. Create a free account at [cloudflare.com](https://dash.cloudflare.com/).
2. In the Cloudflare Dashboard, click **Add a Domain**.
3. Enter your domain: `mycoolstore.com`.
4. Choose the **Free Plan** ($0/month) and click **Continue**.
5. Cloudflare will scan for existing DNS records. Click **Continue**.

### Step 2.3: Point Nameservers at your Registrar
Cloudflare will provide two custom nameservers, for example:
- `ada.ns.cloudflare.com`
- `drew.ns.cloudflare.com`

1. Log into the registrar where you purchased the domain (e.g. Namecheap, Hostinger).
2. Go to the domain management page -> **Nameservers**.
3. Change from "Default Nameservers" to **Custom DNS**.
4. Paste the two Cloudflare nameservers and click **Save**.
5. *Wait 5 to 30 minutes.* Cloudflare will email you: *"Status: Active"*.

---

## 3. Cloudflare Zero-Trust Tunnel Setup (The Magic Bridge)

The Cloudflare Tunnel allows your server to connect securely to Cloudflare without needing a static public IP or port forwarding.

### Step 3.1: Create the Tunnel in Cloudflare Dashboard
1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Navigate to **Networks** ➔ **Tunnels**.
3. Click **Add a Tunnel** ➔ Select **Cloudflared** ➔ Click **Next**.
4. Give your tunnel a descriptive name (e.g. `production-server`) ➔ Click **Save Tunnel**.
5. Cloudflare will display installation commands for various operating systems. Under **Debian / Ubuntu**, copy the command, which looks like:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb && sudo cloudflared service install eyJhIjoi...TOKEN...
   ```

### Step 3.2: Install Tunnel on Ubuntu Server
1. SSH into your Ubuntu server:
   ```bash
   ssh root@YOUR_SERVER_IP
   ```
2. Paste and run the copied command.
3. Verify that the tunnel service is running:
   ```bash
   sudo systemctl status cloudflared
   ```
   *You should see `Active: active (running)`.*
4. In the Cloudflare dashboard, the status will turn from inactive to **HEALTHY** (Green). Click **Next**.

### Step 3.3: Configure Ingress Routes (Public Hostnames)
In the tunnel configuration, go to the **Public Hostnames** tab and create the following entries. **Notice that every entry points to `HTTP` and `localhost:80`**:

| Public Hostname | Service Type | URL | Description |
| :--- | :--- | :--- | :--- |
| `captain.mycoolstore.com` | `HTTP` | `localhost:80` | CapRover Admin Dashboard |
| `*.captain.mycoolstore.com` | `HTTP` | `localhost:80` | Wildcard for CapRover Apps |
| `mycoolstore.com` | `HTTP` | `localhost:80` | Main Frontend Storefront |
| `www.mycoolstore.com` | `HTTP` | `localhost:80` | WWW Frontend Alias |
| `api.mycoolstore.com` | `HTTP` | `localhost:80` | Backend REST API |

> [!IMPORTANT]
> **Why do all domains point to `localhost:80`?**
> CapRover runs an Nginx reverse proxy listening on port 80. When a request for `api.mycoolstore.com` reaches port 80, CapRover reads the hostname and automatically forwards the traffic to the `api` container.

---

## 4. CapRover Master Setup on Ubuntu Server

### Step 4.1: Install Docker on the Server (if not already installed)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### Step 4.2: Launch CapRover
Run the containerized CapRover manager:
```bash
docker run -p 80:80 -p 443:443 -p 3000:3000 -e ACCEPTED_TERMS=true -v /var/run/docker.sock:/var/run/docker.sock -v /captain:/captain caprover/caprover
```

### Step 4.3: Complete Dashboard Initial Setup
1. Open your browser to `https://captain.mycoolstore.com`.
2. Log in with the default password:
   ```
   captain42
   ```
3. Set your new secure master password immediately.
4. Go to **Settings** ➔ **CapRover Root Domain**.
5. Set Root Domain to: `mycoolstore.com` (or `captain.mycoolstore.com`).
6. Click **Update Domain**.

> [!WARNING]
> **Do NOT enable Let's Encrypt / HTTPS in CapRover for apps behind Cloudflare!**
> Cloudflare already terminates SSL with modern TLS 1.3 certificates at the edge. If you attempt to request Let's Encrypt SSL inside CapRover through a Cloudflare Tunnel, the ACME challenge will fail or cause redirect loops (`ERR_TOO_MANY_REDIRECTS`). Keep CapRover's internal container HTTP port on 80.

---

## 5. Real-World Case Study: Lucea Store Post-Mortem (All Errors & Fixes)

During the real deployment of the `Lucea_store` application, we encountered 7 distinct real-world failure scenarios. Below is the complete diagnosis and permanent solution for each.

---

### Error 1: Monorepo Docker Build Context Collision
* **The Symptom:** When running `caprover deploy` from the root of a monorepo, Docker failed during `COPY requirements.txt .` with `File not found: requirements.txt`.
* **Root Cause:** A monorepo has `/backend` and `/frontend`. If `captain-definition` is placed at the root and points to `./backend/Dockerfile`, Docker sets the build context to the root folder. The backend Dockerfile expected its context to be inside the `./backend` folder.
* **The Fix:** Create separate, dedicated `captain-definition` files directly inside each subproject directory:
  ```json
  // backend/captain-definition
  {
    "schemaVersion": 2,
    "dockerfilePath": "./Dockerfile"
  }
  ```
  ```json
  // frontend/captain-definition
  {
    "schemaVersion": 2,
    "dockerfilePath": "./Dockerfile"
  }
  ```
  Package and deploy each component independently from within its own directory.

---

### Error 2: CapRover CLI Stalling on Non-Interactive Terminals
* **The Symptom:** Running `npx caprover deploy -a api` inside a subfolder immediately exited with code 1 or stalled:
  `You are not in a git root directory: this command will only deploy the current directory.`
* **Root Cause:** In PowerShell or CI/CD pipelines without an interactive TTY prompt, CapRover CLI waits for user confirmation `[Y/n]` and aborts if stdin is closed.
* **The Fix:** Use the native Windows/Linux `tar` command to bundle the directory, and deploy using the non-interactive `--tarFile` (`-t`) flag:
  ```powershell
  # Inside /backend:
  tar -cvf ../backend.tar --exclude=".pytest_cache" --exclude="__pycache__" *
  
  # Deploy non-interactively:
  npx caprover deploy -u https://captain.yourdomain.com -p "YOUR_PASSWORD" -a api -t ../backend.tar
  ```

---

### Error 3: Windows PowerShell `curl` Parameter Failure
* **The Symptom:** Running `curl -Iv https://api.yourdomain.com/health` in Windows PowerShell produced:
  `Invoke-WebRequest : A positional parameter cannot be found that accepts argument...`
* **Root Cause:** In Windows PowerShell, `curl` is an alias for the `Invoke-WebRequest` cmdlet, which does not accept Linux flags like `-I`, `-v`, or `-s`.
* **The Fix:** Always specify the real binary executable `curl.exe` in Windows terminals:
  ```powershell
  curl.exe -s https://api.yourdomain.com/health
  ```

---

### Error 4: Root Domain vs Subdomain Routing Conflict
* **The Symptom:** Navigating to `https://yourdomain.com` displayed CapRover's default splash screen: *"Nothing here yet :/"*, even though the `web` container was deployed.
* **Root Cause:** By default, CapRover maps apps to `<app-name>.<root-domain>` (e.g. `web.yourdomain.com`). The naked root domain `yourdomain.com` was not explicitly assigned to the `web` app.
* **The Fix:** Attach the naked root domain as a Custom Domain on the `web` app using the CapRover Web Dashboard or via the CapRover API:
  - **In Dashboard:** Go to `web` App ➔ **HTTP Settings** ➔ **Connect New Domain** ➔ Enter `yourdomain.com` ➔ Click **Connect**.
  - **Via API:**
    ```bash
    POST /api/v2/user/apps/appDefinitions/customdomain
    Headers: x-captain-auth: <TOKEN>
    Payload: {"appName": "web", "customDomain": "yourdomain.com"}
    ```

---

### Error 5: Backend Login Crash (HTTP 500) Due to Missing Redis Cache
* **The Symptom:** The backend `/health` endpoint returned `{"status":"ok"}`, but logging in via `/api/v1/auth/login` crashed with `HTTP 500 Internal Server Error`.
* **Root Cause:** The authentication service used Redis to store session refresh tokens and manage rate-limiting. Because Redis was not deployed, `redis_client.set()` threw an unhandled connection error. Checking `/ready` revealed: `{"status":"degraded","database":"ok","redis":"unreachable"}`.
* **The Fix:**
  1. Provision a lightweight Redis container on CapRover:
     ```powershell
     npx caprover deploy -u https://captain.yourdomain.com -p "PASSWORD" -a redis -i redis:alpine
     ```
  2. Add `REDIS_URL` to the `api` app environment variables:
     ```env
     REDIS_URL=redis://srv-captain--redis:6379/0
     ```
  3. Verify with `/ready`: Response changed to `{"status":"ready","database":"ok","redis":"ok"}`.

---

### Error 6: Empty Catalog & Missing Database Seeds
* **The Symptom:** The database tables existed, but browsing products returned `{"items":[],"total":0}`.
* **Root Cause:** Database migrations create tables, but do not populate initial catalog data (products, prices, categories, delivery zones).
* **The Fix:** Integrate an idempotent seeder directly into FastAPI's startup event in `backend/app/main.py`:
  ```python
  @app.on_event("startup")
  async def startup_event():
      # 1. Ensure tables exist
      async with engine.begin() as conn:
          await conn.run_sync(Base.metadata.create_all)
      
      # 2. Run idempotent database seeder
      try:
          from seeds.seed import seed_data
          await seed_data()
      except Exception as e:
          print("Seed execution warning:", e)
  ```
  Because the seeder checks `where(Product.slug == spec["slug"])` before inserting, it is completely safe to run on every container restart without duplicating data.

---

### Error 7: Frontend Prerender Build Failures
* **The Symptom:** Vite/React SSG build failed during Docker build:
  `Error: Failed to fetch http://localhost:8000/api/v1/articles`
* **Root Cause:** Prerender scripts (`scripts/prerender.ts`) attempted to query the live backend API while the container image was being compiled on the build server.
* **The Fix:** In `frontend/Dockerfile`, set `ARG BLOG_API_URL=""`. If the variable is empty, the prerenderer gracefully falls back to default route shells, allowing the build to succeed.

---

## 6. Universal Blueprint: Deploying ANY Full-Stack App (Web + API + DB + Cache)

You can apply this exact blueprint to deploy **any** stack (Next.js, React, Vue, Svelte, Django, FastAPI, Express, NestJS, Go, Spring Boot, Laravel).

### Phase A: The 4 Standard Containers to Provision
Always organize your stack into 4 clean containers inside CapRover:

| App Name | Image / Build | Has Persistent Data? | Internal Port | Environment Variables |
| :--- | :--- | :--- | :--- | :--- |
| `postgres` | `postgres:16` | **YES** (Mount `/var/lib/postgresql/data`) | 5432 | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `redis` | `redis:alpine` | **YES** (Mount `/data`) | 6379 | (None required for default) |
| `api` | `Dockerfile` | **NO** (Stateless) | `8000` (or `3000`/`5000`) | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CORS_ORIGINS` |
| `web` | `Dockerfile` (Nginx) | **NO** (Stateless) | `80` | `VITE_API_URL=""` |

---

### Phase B: Frontend Nginx Configuration (`nginx.conf`)
To avoid CORS issues and simplify frontend code, the frontend Nginx should proxy `/api/` calls directly to the internal backend container.

Save this as `frontend/nginx/nginx.conf`:
```nginx
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    server {
        listen 80;
        server_name localhost;

        # Docker internal DNS resolver
        resolver 127.0.0.11 valid=10s;

        # Serve static frontend build
        location / {
            root   /usr/share/nginx/html;
            index  index.html index.htm;
            try_files $uri $uri/ /index.html;
        }

        # Seamless internal API proxying (No CORS!)
        location /api/ {
            set $upstream_api http://srv-captain--api:8000;
            proxy_pass $upstream_api;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

---

## 7. Custom Domains & Brand Names (Beyond CapRover Subdomains)

When deploying client applications or distinct brands, you do **not** want URLs like `web-app.captain.econmasteringbook.com`. You want `clientbrand.com` and `api.clientbrand.com`.

### Step 7.1: Add the New Domain to Cloudflare
Follow [Section 2](#2-complete-domain-setup-from-purchase-to-cloudflare-edge) to register or delegate `clientbrand.com` to Cloudflare.

### Step 7.2: Route the Domain in your Cloudflare Tunnel
In Cloudflare Zero Trust ➔ **Networks** ➔ **Tunnels** ➔ Select your existing Tunnel ➔ **Public Hostnames** ➔ **Add a Hostname**:
- **Hostname:** `clientbrand.com` ➔ Service: `HTTP://localhost:80`
- **Hostname:** `www.clientbrand.com` ➔ Service: `HTTP://localhost:80`
- **Hostname:** `api.clientbrand.com` ➔ Service: `HTTP://localhost:80`

### Step 7.3: Connect the Domain in CapRover
1. Log into your CapRover dashboard.
2. Click on the frontend app (e.g. `client-web`).
3. Under **HTTP Settings** ➔ **Connect New Domain**:
   - Enter `clientbrand.com` ➔ Click **Connect New Domain**.
   - Enter `www.clientbrand.com` ➔ Click **Connect New Domain**.
4. Click on your backend app (e.g. `client-api`).
   - Enter `api.clientbrand.com` ➔ Click **Connect New Domain**.

Traffic is now live on the new branded domains with zero downtime and automatic SSL encryption!

---

## 8. Controlling, Monitoring & Scaling in Production

### 8.1 Viewing Live Logs
#### Method 1: In the CapRover Web Dashboard
1. Go to **Apps** ➔ Select your App (e.g. `api`).
2. Click on the **App Logs** tab to view the live streaming console logs.

#### Method 2: Via Server Terminal (Faster for Debugging)
```bash
# View last 100 lines:
docker service logs srv-captain--api --tail 100

# Stream logs in real-time (follow):
docker service logs -f srv-captain--api
```

### 8.2 Inspecting Real Traffic & Client IPs
Because requests pass through Cloudflare, the real visitor's IP is present in the `CF-Connecting-IP` and `X-Forwarded-For` HTTP headers.

To view live incoming HTTP requests in Nginx:
```bash
docker exec -it $(docker ps -q -f name=srv-captain--web) tail -f /var/log/nginx/access.log
```

### 8.3 Monitoring CPU, Memory & Disk Resources
Check resource consumption across all running containers:
```bash
docker stats --no-stream
```
*Look for containers utilizing high memory (>80%) or CPU spikes.*

### 8.4 Zero-Downtime Scaling & Restarts
If your app experiences high traffic:
1. In CapRover Dashboard ➔ Select App ➔ **HTTP Settings**.
2. Change **Instance Count** from `1` to `3`.
3. Click **Save & Update**.
4. Docker Swarm spins up 3 replicated worker containers and load balances traffic across all 3 automatically.

---

## 9. Local AI-Powered Development, Testing & Instant Redeployment

This section explains how to develop and enhance the code on your personal computer using an AI assistant (Antigravity, Cursor, or Claude Code) and push updates to production in seconds.

### The Fast Inner Loop
```
  [ Local PC ]                   [ AI Assistant ]               [ Production Server ]
Code Modification ─────────────▶ Automated Validation ─────────▶ 1-Command Deployment
(src/ or app/)                    (Tests & Lints)                 (npx caprover deploy)
```

### 9.1 Create Local Automation Scripts
Create two quick deployment scripts in your project root to eliminate repetitive manual steps.

#### Script 1: Deploy Backend (`deploy-api.ps1`)
```powershell
Write-Host "📦 Bundling Backend..." -ForegroundColor Cyan
Set-Location backend
tar -cvf ../backend.tar --exclude=".pytest_cache" --exclude="__pycache__" *
Set-Location ..

Write-Host "🚀 Uploading to CapRover..." -ForegroundColor Green
npx caprover deploy -u https://captain.econmasteringbook.com -p "captain42" -a api -t backend.tar

Remove-Item backend.tar
Write-Host "✅ Backend Deployment Complete!" -ForegroundColor Green
```

#### Script 2: Deploy Frontend (`deploy-web.ps1`)
```powershell
Write-Host "📦 Bundling Frontend..." -ForegroundColor Cyan
Set-Location frontend
tar -cvf ../frontend.tar --exclude="node_modules" --exclude="dist" *
Set-Location ..

Write-Host "🚀 Uploading to CapRover..." -ForegroundColor Green
npx caprover deploy -u https://captain.econmasteringbook.com -p "captain42" -a web -t frontend.tar

Remove-Item frontend.tar
Write-Host "✅ Frontend Deployment Complete!" -ForegroundColor Green
```

### 9.2 The AI Pair-Programming Workflow
1. **Prompt your AI:**
   *"Add a new coupon discount field to the checkout page in `src/pages/CheckoutPage.tsx` and create a corresponding validation rule in `backend/app/commerce/service.py`."*
2. **Review & Test Locally:**
   Run tests or preview locally:
   ```bash
   npm run build # inside frontend
   pytest        # inside backend
   ```
3. **Trigger Deployment:**
   Run the respective script:
   ```powershell
   ./deploy-api.ps1
   ./deploy-web.ps1
   ```
4. **Zero Downtime Guarantee:**
   CapRover and Docker Swarm start the new container, perform a health check, and only switch traffic once the new container is healthy. If the new build fails to start, Docker Swarm automatically rolls back to the previous stable release.

---

## 10. Emergency Recovery & Disaster Cheat Sheet

| Situation | Diagnosis Command | Instant Solution |
| :--- | :--- | :--- |
| **Cloudflare 502 Bad Gateway** | `systemctl status cloudflared` | Cloudflare tunnel daemon stopped. Run `sudo systemctl restart cloudflared`. |
| **CapRover Dashboard Unreachable** | `docker ps \| grep captain` | Restart CapRover: `docker restart captain-captain`. |
| **Database Connection Refused** | `docker service logs srv-captain--postgres` | Check if postgres container is running. Verify password matches `DATABASE_URL`. |
| **Disk Space Full (No space left on device)** | `df -h` | Clean unused Docker build cache: `docker builder prune -f` and `docker image prune -f`. *(Never prune volumes!)* |
| **Rollback to Previous Working Image** | CapRover Dashboard ➔ App ➔ Deployment | Under **Deployment History**, click **Revert to this version** on the previous working build. |

---
*Manual Version: 2.0.0 — Production Verified on CapRover & Cloudflare Tunnels.*
