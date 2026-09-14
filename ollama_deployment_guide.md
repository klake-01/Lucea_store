# Self-Hosting Ollama on Ubuntu Server with CapRover & Cloudflare Tunnel
## Complete Step-by-Step Production Guide (LLM API & Web UI)

---

## 📑 Table of Contents
1. [Architecture & Cloudflare SSL Rule](#1-architecture--cloudflare-ssl-rule)
2. [Hardware Requirements (CPU vs GPU)](#2-hardware-requirements-cpu-vs-gpu)
3. [Step 1: Create the Ollama App in CapRover](#step-1-create-the-ollama-app-in-caprover)
4. [Step 2: Cloudflare Zero-Trust Tunnel Configuration](#step-2-cloudflare-zero-trust-tunnel-configuration)
5. [Step 3: Connect Custom Domain in CapRover](#step-3-connect-custom-domain-in-caprover)
6. [Step 4: Pulling LLM Models via SSH or Terminal](#step-4-pulling-llm-models-via-ssh-or-terminal)
7. [Step 5: Securing your Ollama Instance (Crucial!)](#step-5-securing-your-ollama-instance-crucial)
8. [Step 6: Optional ChatGPT-Style Interface (Open WebUI)](#step-6-optional-chatgpt-style-interface-open-webui)
9. [Step 7: Testing & Calling your Ollama API](#step-7-testing--calling-your-ollama-api)
10. [Troubleshooting & Maintenance](#10-troubleshooting--maintenance)

---

## 1. Architecture & Cloudflare SSL Rule

```
                               PUBLIC INTERNET / YOUR PC
                                          │
                                          ▼
                             ┌─────────────────────────┐
                             │  Cloudflare Edge (SSL)  │
                             │ https://ai.yourdomain   │
                             └────────────┬────────────┘
                                          │ (Encrypted Tunnel)
                                          ▼
                             ┌─────────────────────────┐
                             │    Cloudflare Tunnel    │
                             │ (Forwards localhost:80) │
                             └────────────┬────────────┘
                                          │
                                          ▼
                    ┌───────────────────────────────────────────┐
                    │        UBUNTU SERVER (CapRover)           │
                    │                                           │
                    │   CapRover Nginx Ingress (Port 80)        │
                    │   Host: ai.yourdomain.com                 │
                    │                    │                      │
                    │                    ▼                      │
                    │         ┌───────────────────────┐         │
                    │         │   Ollama Container    │         │
                    │         │ (srv-captain--ollama) │         │
                    │         │ Internal Port: 11434  │         │
                    │         └──────────┬────────────┘         │
                    │                    │                      │
                    │                    ▼                      │
                    │         ┌───────────────────────┐         │
                    │         │   Persistent Volume   │         │
                    │         │   /root/.ollama/      │         │
                    │         │ (Stores Model Weights)│         │
                    │         └───────────────────────┘         │
                    └───────────────────────────────────────────┘
```

### ⚠️ Critical Cloudflare Rule: Subdomain Depth
Cloudflare's **Free Universal SSL** certificates only cover:
- Root Domain: `yourdomain.com`
- First-Level Subdomain: `*.yourdomain.com` (e.g. `ai.yourdomain.com`, `ollama.yourdomain.com`)

> [!WARNING]
> If you use a **two-level subdomain** like `ollama.ai.yourdomain.com`, browsers will throw:
> `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` because free SSL does not cover second-level wildcards (`*.*.yourdomain.com`).
> **Recommended Subdomain:** Use `ai.econmasteringbook.com` or `ollama.econmasteringbook.com`.

---

## 2. Hardware Requirements (CPU vs GPU)

Ollama can run on either **CPU** or **NVIDIA GPU**:

| Deployment Mode | RAM Required | Storage Required | Recommended Models | Performance |
| :--- | :--- | :--- | :--- | :--- |
| **CPU-Only Mode** | 8 GB - 16 GB | 20 GB - 50 GB SSD | `llama3.2:1b`, `llama3.2:3b`, `qwen2.5:3b`, `mistral:7b` | 5 - 20 tokens/sec |
| **NVIDIA GPU Mode** (CUDA) | 16 GB+ / 8GB VRAM | 50 GB+ NVMe | `llama3.2:8b`, `deepseek-r1:8b`, `qwen2.5-coder:7b` | 30 - 80+ tokens/sec |

*Note: For CPU mode, ensure your server processor supports AVX instructions (standard on all modern Intel/AMD VPS and bare-metal servers).*

---

## 3. Step 1: Create the Ollama App in CapRover

You do **not** need to install complex local drivers; running Ollama in Docker via CapRover ensures automatic restarts and persistent model weights across reboots.

### 3.1 Register the App in CapRover Dashboard
1. Open your CapRover dashboard: `https://captain.econmasteringbook.com`.
2. Go to **Apps** ➔ Click **Create New App**.
3. Configure the app details:
   - **App Name:** `ollama`
   - **Has Persistent Data:** ✅ **CHECK THIS BOX** (Crucial! This creates persistent disk storage for downloaded model weights).
4. Click **Create New App**.

---

### 3.2 Configure HTTP Port & Storage Volume
1. Click on the newly created `ollama` app to enter its configuration page.
2. Under the **HTTP Settings** tab:
   - **Container HTTP Port:** Change from `80` to `11434` (Ollama default port).
3. Under the **App Configs** tab:
   - Scroll down to **Persistent Volumes**.
   - You will see an existing volume mapped to `/data` by default.
   - Click **Add Persistent Volume** (or edit the existing path):
     - **Path in App:** `/root/.ollama`
     - **Label / Name:** `ollama-models`
   - *(This ensures that models downloaded via `ollama pull` persist even when the container restarts or updates).*
4. Under **Environmental Variables**, you can optionally add:
   ```env
   OLLAMA_KEEP_ALIVE=24h
   OLLAMA_ORIGINS=*
   ```
   *(Explanation: `OLLAMA_KEEP_ALIVE=24h` keeps the model loaded in RAM/VRAM so subsequent requests don't experience a cold-start delay).*
5. Click **Save & Update**.

---

### 3.3 Deploy the Official Ollama Image
1. In the `ollama` app page, scroll down to **Deployment**.
2. Under **Deploy Method 3: Official Image**:
   - **Image Name:**
     - For **CPU Mode** (Standard VPS): `ollama/ollama:latest`
     - For **NVIDIA GPU Mode**: `ollama/ollama:latest` *(Requires NVIDIA Container Toolkit on Ubuntu host)*.
3. Click **Deploy Now**.
4. CapRover will pull the image and start `srv-captain--ollama`. Once finished, the status will show green: **1/1 Running**.

---

## 4. Step 2: Cloudflare Zero-Trust Tunnel Configuration

Now route public HTTPS traffic to the server.

1. Open the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Navigate to **Networks** ➔ **Tunnels**.
3. Click on your active tunnel ➔ Click **Configure**.
4. Go to the **Public Hostnames** tab ➔ Click **Add a Public Hostname**.
5. Fill in the hostname details:
   - **Subdomain:** `ai` (or `ollama`)
   - **Domain:** `econmasteringbook.com`
   - **Path:** Leave empty
   - **Service Type:** `HTTP`
   - **URL:** `localhost:80`
6. Click **Save Hostname**.

> [!NOTE]
> Like the store and API, all traffic routes through `localhost:80`. CapRover inspects `ai.econmasteringbook.com` and directs traffic internally to the Ollama container on port 11434.

---

## 5. Step 3: Connect Custom Domain in CapRover

1. Return to your CapRover dashboard ➔ Click on the `ollama` app.
2. Go to **HTTP Settings** ➔ **Connect New Domain**.
3. Enter your domain:
   ```
   ai.econmasteringbook.com
   ```
   *(or `ollama.econmasteringbook.com` depending on what you chose in Cloudflare).*
4. Click **Connect New Domain**.
5. CapRover automatically updates its Nginx routing rules.

---

## 6. Step 4: Pulling LLM Models via SSH or Terminal

Now that the Ollama container is running, you need to download ("pull") an AI model onto the server.

### 6.1 Access the Server via SSH
Open PowerShell or your terminal on your PC:
```powershell
ssh root@YOUR_SERVER_IP
```

### 6.2 Execute the Pull Command Inside the Container
Find the active Ollama container ID:
```bash
docker ps | grep ollama
```

Now download your preferred model using `docker exec`:

#### Option A: Ultra-Fast Lightweight Model (Great for CPU / Low RAM)
```bash
docker exec -it $(docker ps -q -f name=srv-captain--ollama) ollama pull llama3.2:1b
```
*(~1.3 GB download, runs fast on almost any VPS).*

#### Option B: Balanced General Purpose Model (3B Parameters)
```bash
docker exec -it $(docker ps -q -f name=srv-captain--ollama) ollama pull llama3.2:3b
```
*(~2.0 GB download, excellent reasoning and conversation).*

#### Option C: Advanced Coding & Reasoning Model (Qwen 2.5)
```bash
docker exec -it $(docker ps -q -f name=srv-captain--ollama) ollama pull qwen2.5:7b
```
*(~4.7 GB download, requires 8 GB+ RAM).*

#### Option D: DeepSeek Reasoning Model
```bash
docker exec -it $(docker ps -q -f name=srv-captain--ollama) ollama pull deepseek-r1:8b
```
*(~4.9 GB download).*

### 6.3 Verify Downloaded Models
```bash
docker exec -it $(docker ps -q -f name=srv-captain--ollama) ollama list
```
*You will see a list of installed models with their sizes and IDs.*

---

## 7. Step 5: Securing your Ollama Instance (Crucial!)

> [!CAUTION]
> By default, the Ollama API has **NO password or authentication**. If you expose `ai.econmasteringbook.com` publicly without protection, strangers can run expensive prompts, exhaust your server RAM/CPU, or download arbitrary models!

You have two simple, rock-solid options to secure it:

---

### Security Option 1: HTTP Basic Auth inside CapRover (Simplest)
CapRover allows you to password-protect any app with 1 click:
1. In CapRover ➔ Click on `ollama` app ➔ **HTTP Settings**.
2. Scroll down to **HTTP Basic Authentication**.
3. Enter:
   - **Username:** `admin` (or your choice)
   - **Password:** `YourStrongSecretPassword!`
4. Click **Set Basic Auth**.
5. Now, any browser or API call must provide these credentials to access the endpoint.

---

### Security Option 2: Cloudflare Access Zero-Trust Policy (Enterprise-Grade)
You can lock the URL to only your personal Google/email account:
1. In Cloudflare Zero Trust Dashboard ➔ **Access** ➔ **Applications**.
2. Click **Add an Application** ➔ Select **Self-Hosted**.
3. **Application Name:** `Ollama AI API`
4. **Application Domain:** `ai.econmasteringbook.com`
5. Under **Policies**, create a rule:
   - **Rule Name:** `Allow Me Only`
   - **Action:** `Allow`
   - **Include:** `Emails` ➔ Enter your personal email (e.g. `yourname@gmail.com`).
6. Click **Save**.
7. Whenever someone navigates to `https://ai.econmasteringbook.com`, Cloudflare will prompt for a 1-time email code before granting access.

---

## 8. Step 6: Optional ChatGPT-Style Interface (Open WebUI)

If you want a modern, private web interface (identical to ChatGPT) running in your browser:

### 8.1 Create App in CapRover
1. CapRover ➔ **Apps** ➔ **Create New App**.
2. **App Name:** `chat-ui` (Persistent Data: ✅ YES).
3. Under **HTTP Settings**:
   - **Container HTTP Port:** `8080`
   - **Connect New Domain:** `chat.econmasteringbook.com`
4. Under **App Configs** ➔ **Environmental Variables**:
   ```env
   OLLAMA_BASE_URL=http://srv-captain--ollama:11434
   WEBUI_SECRET_KEY=generate_a_random_32_char_key_here
   ```
5. Under **Deployment** ➔ **Method 3: Official Image**:
   - **Image Name:** `ghcr.io/open-webui/open-webui:main`
6. Click **Deploy Now**.

### 8.2 Add Cloudflare Tunnel Route
In Cloudflare Zero Trust ➔ Tunnels ➔ Public Hostnames:
- Hostname: `chat.econmasteringbook.com` ➔ `HTTP://localhost:80`.

Open `https://chat.econmasteringbook.com` in your browser. You now have your own private ChatGPT powered by your self-hosted Ollama server!

---

## 9. Step 7: Testing & Calling your Ollama API

### 9.1 Quick Test via PowerShell (`curl.exe`)
From your local Windows PC:
```powershell
curl.exe -s https://ai.econmasteringbook.com/api/tags
```
*Expected output: JSON list showing your installed models!*

---

### 9.2 Generate a Completion
```powershell
curl.exe -s -X POST https://ai.econmasteringbook.com/api/generate `
  -H "Content-Type: application/json" `
  -d '{"model": "llama3.2:1b", "prompt": "Why is the sky blue? Answer in 1 sentence.", "stream": false}'
```

---

### 9.3 Use with Python / OpenAI SDK
Ollama is 100% compatible with the official OpenAI Python library:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://ai.econmasteringbook.com/v1",
    api_key="ollama", # Required by SDK but unused if no auth
)

response = client.chat.completions.create(
    model="llama3.2:1b",
    messages=[
        {"role": "system", "content": "You are a helpful eCommerce AI assistant for LUCEA store."},
        {"role": "user", "content": "What lamps do you recommend for a baby bedroom?"}
    ]
)

print(response.choices[0].message.content)
```

---

## 10. Troubleshooting & Maintenance

### How to Check Ollama Logs
```bash
docker service logs -f srv-captain--ollama
```

### How to Check RAM Usage While Generating
```bash
docker stats $(docker ps -q -f name=srv-captain--ollama)
```

### Removing Old Models to Free Disk Space
```bash
docker exec -it $(docker ps -q -f name=srv-captain--ollama) ollama rm model_name
```

---
*Manual Version: 1.0.0 — Verified for Ollama + CapRover + Cloudflare Zero-Trust.*
