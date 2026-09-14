# Complete Production Guide: Self-Hosting Ollama + Open WebUI
## Private ChatGPT Alternative on Ubuntu Server with CapRover & Cloudflare Tunnel
**Production URL:** `https://chat.econmasteringbook.com`

---

## 📑 Table of Contents
1. [Architecture & Cloudflare Network Flow](#1-architecture--cloudflare-network-flow)
2. [Hardware Requirements (CPU vs GPU)](#2-hardware-requirements-cpu-vs-gpu)
3. [Step 1: Deploy the Ollama Engine in CapRover](#step-1-deploy-the-ollama-engine-in-caprover)
4. [Step 2: Deploy Open WebUI in CapRover](#step-2-deploy-open-webui-in-caprover)
5. [Step 3: Route `chat.econmasteringbook.com` in Cloudflare Tunnel](#step-3-route-chateconmasteringbookcom-in-cloudflare-tunnel)
6. [Step 4: Downloading AI Models (In-Browser & SSH)](#step-4-downloading-ai-models-in-browser--ssh)
7. [Step 5: Admin Setup & Security Hardening (Crucial)](#step-5-admin-setup--security-hardening-crucial)
8. [Step 6: Direct API Access & Developer Integration](#step-6-direct-api-access--developer-integration)
9. [Troubleshooting & Maintenance Commands](#9-troubleshooting--maintenance-commands)

---

## 1. Architecture & Cloudflare Network Flow

```
                               PUBLIC INTERNET (Your PC / Phone / Visitors)
                                                    │
                                                    ▼
                                    https://chat.econmasteringbook.com
                                                    │
                                                    ▼
                                    ┌───────────────────────────────┐
                                    │     Cloudflare Edge (SSL)     │
                                    │    Automatic Free TLS 1.3     │
                                    └───────────────┬───────────────┘
                                                    │ (Encrypted Tunnel over outbound HTTPS)
                                                    ▼
                                    ┌───────────────────────────────┐
                                    │   Cloudflare Tunnel Daemon    │
                                    │   (Forwards to localhost:80)  │
                                    └───────────────┬───────────────┘
                                                    │
                                                    ▼
                       ┌────────────────────────────────────────────────────────┐
                       │              UBUNTU SERVER (Docker Swarm)              │
                       │                                                        │
                       │   CapRover Shared Nginx Ingress (Port 80)              │
                       │   Host Header: chat.econmasteringbook.com              │
                       │                        │                               │
                       │                        ▼                               │
                       │   ┌────────────────────────────────────────┐           │
                       │   │     Open WebUI Frontend & Backend      │           │
                       │   │       (srv-captain--open-webui)        │           │
                       │   │         Internal Port: 8080            │           │
                       │   └────────────────────┬───────────────────┘           │
                       │                        │                               │
                       │                        ▼ (Internal Docker Network)     │
                       │             http://srv-captain--ollama:11434           │
                       │                        │                               │
                       │   ┌────────────────────┴───────────────────┐           │
                       │   │           Ollama LLM Engine            │           │
                       │   │         (srv-captain--ollama)          │           │
                       │   │         Internal Port: 11434           │           │
                       │   │    (No Public Internet Exposure!)      │           │
                       │   └────────────────────┬───────────────────┘           │
                       │                        │                               │
                       │                        ▼                               │
                       │   ┌────────────────────────────────────────┐           │
                       │   │           Persistent Volumes           │           │
                       │   │ • /app/backend/data (Chats & Users)    │           │
                       │   │ • /root/.ollama     (AI Model Weights) │           │
                       │   └────────────────────────────────────────┘           │
                       └────────────────────────────────────────────────────────┘
```

### Key Security Benefits of this Setup
1. **Isolated LLM Engine:** Ollama has no built-in password authentication. By connecting Open WebUI to Ollama internally (`http://srv-captain--ollama:11434`), Ollama is **never exposed directly to the public internet**.
2. **Modern Web UI:** Open WebUI gives you a responsive, feature-packed interface identical to ChatGPT (model switching, conversation history, file uploads, document RAG, and prompt templates).
3. **No New Server Ports:** Everything connects through the existing Cloudflare Tunnel on `localhost:80`.

---

## 2. Hardware Requirements (CPU vs GPU)

Ollama runs efficiently on both **CPU** and **NVIDIA GPU**:

| Deployment Mode | RAM Required | Storage Required | Recommended Models | Performance |
| :--- | :--- | :--- | :--- | :--- |
| **CPU-Only Mode** (Standard VPS) | 8 GB - 16 GB | 20 GB - 50 GB SSD | `llama3.2:1b`, `llama3.2:3b`, `qwen2.5:3b`, `mistral:7b` | 8 - 25 tokens/sec |
| **NVIDIA GPU Mode** (CUDA) | 16 GB+ / 8GB VRAM | 50 GB+ NVMe | `llama3.2:8b`, `deepseek-r1:8b`, `qwen2.5-coder:7b` | 35 - 90+ tokens/sec |

---

## 3. Step 1: Deploy the Ollama Engine in CapRover

The Ollama container executes the AI neural networks in the background.

### 3.1 Register the App
1. Open your CapRover dashboard:  
   👉 **`https://captain.econmasteringbook.com`**
2. Go to **Apps** ➔ Click **Create New App**.
3. Fill in:
   * **App Name:** `ollama`
   * **Has Persistent Data:** ✅ **CHECK THIS BOX** *(Mandatory to persist model weights across restarts)*
4. Click **Create New App**.

---

### 3.2 Configure HTTP Port, Volume & Env Vars
1. Click on `ollama` in the list to open its configuration.
2. Under **HTTP Settings**:
   * Change **Container HTTP Port** from `80` to **`11434`**.
3. Under **App Configs**:
   * Scroll down to **Persistent Volumes**.
   * Ensure the mount path is configured as:
     * **Path in App:** `/root/.ollama`
     * **Label / Volume Name:** `ollama-models`
   * Under **Environmental Variables**, add:
     ```env
     OLLAMA_KEEP_ALIVE=24h
     OLLAMA_ORIGINS=*
     ```
     *(Explanation: `OLLAMA_KEEP_ALIVE=24h` prevents Ollama from unloading the model from RAM after 5 minutes of inactivity).*
4. Click **Save & Update**.

---

### 3.3 Deploy the Image
1. Under **Deployment**, scroll down to **Method 3: Official Image or Existing Image**.
2. **Image Name:**
   ```
   ollama/ollama:latest
   ```
3. Click **Deploy Now**.
4. In ~30 seconds, the status will show green: **1/1 Running**.

---

## 4. Step 2: Deploy Open WebUI in CapRover

Now deploy the web interface that speaks directly to the Ollama container over the internal Docker network.

### 4.1 Register the App
1. In CapRover, go to **Apps** ➔ Click **Create New App**.
2. Fill in:
   * **App Name:** `open-webui`
   * **Has Persistent Data:** ✅ **CHECK THIS BOX** *(Mandatory to save chat history and user accounts)*
3. Click **Create New App**.

---

### 4.2 Configure HTTP Port, Custom Domain & Env Vars
1. Click on `open-webui` in the list.
2. Under **HTTP Settings**:
   * Change **Container HTTP Port** from `80` to **`8080`** *(Open WebUI listens on port 8080)*.
   * Under **Connect New Domain**, enter:
     ```
     chat.econmasteringbook.com
     ```
   * Click **Connect New Domain**.
3. Under **App Configs**:
   * Under **Persistent Volumes**, ensure the mount path is:
     * **Path in App:** `/app/backend/data`
     * **Label / Volume Name:** `webui-data`
   * Under **Environmental Variables**, add:
     ```env
     OLLAMA_BASE_URL=http://srv-captain--ollama:11434
     WEBUI_SECRET_KEY=lucea_ai_master_secret_key_2026!
     ENABLE_SIGNUP=true
     ```
4. Click **Save & Update**.

---

### 4.3 Deploy the Image
1. Under **Deployment**, scroll to **Method 3: Official Image or Existing Image**.
2. **Image Name:**
   ```
   ghcr.io/open-webui/open-webui:main
   ```
3. Click **Deploy Now**.
4. CapRover will pull the image and initialize the container (~1 to 2 minutes).

---

## 5. Step 3: Route `chat.econmasteringbook.com` in Cloudflare Tunnel

1. Open the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Navigate to **Networks** ➔ **Tunnels**.
3. Click on your active tunnel ➔ Click **Configure**.
4. Go to the **Public Hostnames** tab ➔ Click **Add a Public Hostname**.
5. Configure the route:
   * **Subdomain:** `chat`
   * **Domain:** `econmasteringbook.com`
   * **Path:** *(Leave empty)*
   * **Service Type:** `HTTP`
   * **URL:** `localhost:80`
6. Click **Save Hostname**.

---

## 6. Step 4: Downloading AI Models (In-Browser & SSH)

### Method A: Directly inside Open WebUI (Recommended)
1. Open your browser to:  
   👉 **`https://chat.econmasteringbook.com`**
2. Complete the initial registration (the first account created becomes the **Super Admin**).
3. Click on your profile name (bottom-left corner) ➔ Select **Admin Panel**.
4. Go to the **Settings** tab ➔ Click **Models**.
5. Under **Pull a model from Ollama.com**, enter any model tag:
   * `llama3.2:1b` *(Lightweight, ~1.3 GB, extremely fast on standard CPUs)*
   * `llama3.2:3b` *(Smart, versatile conversational model, ~2.0 GB)*
   * `qwen2.5:7b` *(Exceptional reasoning and coding skills, ~4.7 GB)*
   * `deepseek-r1:8b` *(DeepSeek reasoning model, ~4.9 GB)*
6. Click the **Download (Pull)** icon. You can watch the real-time download progress bar directly inside your browser.

---

### Method B: Via Server SSH Terminal
If you prefer downloading models from the command line:
```bash
# SSH into your server:
ssh root@YOUR_SERVER_IP

# Pull the model inside the running Ollama container:
docker exec -it $(docker ps -q -f name=srv-captain--ollama) ollama pull llama3.2:1b

# Verify installed models:
docker exec -it $(docker ps -q -f name=srv-captain--ollama) ollama list
```

---

## 7. Step 5: Admin Setup & Security Hardening (Crucial)

Once you have created your admin account, close public registration so strangers cannot access your server's computing resources.

1. In Open WebUI, navigate to **Admin Panel** ➔ **Settings** ➔ **General**.
2. Find the toggle **Enable New Signups**.
3. Switch it **OFF**.
4. Click **Save**.

Now, only you can log in. If you want to invite friends or teammates, you can manually create accounts for them from the **Admin Panel ➔ Users** tab.

---

## 8. Step 6: Direct API Access & Developer Integration

Open WebUI provides an OpenAI-compatible API endpoint that allows you to connect IDE extensions, scripts, and applications to your self-hosted model.

### 8.1 Generate an API Key
1. In Open WebUI, click your profile icon ➔ **Settings** ➔ **Account**.
2. Under **API Keys**, click **Create New Key**.
3. Copy your key (starts with `sk-...`).

### 8.2 Using the API in Python
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://chat.econmasteringbook.com/api",
    api_key="YOUR_OPEN_WEBUI_API_KEY",
)

response = client.chat.completions.create(
    model="llama3.2:1b",
    messages=[
        {"role": "system", "content": "You are a professional assistant."},
        {"role": "user", "content": "Explain how Docker Swarm works in simple terms."}
    ]
)

print(response.choices[0].message.content)
```

---

## 9. Troubleshooting & Maintenance Commands

### Check Open WebUI Logs
```bash
docker service logs -f srv-captain--open-webui
```

### Check Ollama Engine Logs
```bash
docker service logs -f srv-captain--ollama
```

### Monitor Real-Time CPU & RAM Consumption
```bash
docker stats $(docker ps -q -f name=srv-captain--ollama) $(docker ps -q -f name=srv-captain--open-webui)
```

### Remove a Model to Free Up Disk Space
```bash
docker exec -it $(docker ps -q -f name=srv-captain--ollama) ollama rm model_name
```

---
*Verified Production Setup: Ollama + Open WebUI on CapRover + Cloudflare Zero-Trust Tunnels.*
