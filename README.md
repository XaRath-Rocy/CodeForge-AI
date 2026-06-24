# CodeForge AI — Setup & Deployment Guide

CodeForge AI is a high-performance Chrome Extension that allows you to forge clean, production-ready code directly into web-based code editors (like StackBlitz, Replit, Monaco, JSFiddle, and more) using free NVIDIA NIM models.

---

## Architecture Overview

1. **Chrome Extension (Frontend):** Located in the root directory. Populates the popup interface, captures selection/instructions, and handles insertion into the webpage's editor.
2. **Express Server (Backend Gateway):** Located in the `/server` directory. Safely routes requests to the NVIDIA NIM API using your private API Key, preventing key leakage in the client extension.

---

## 🔑 Step 1: Get a Free NVIDIA NIM API Key

NVIDIA offers free credits to developers to query foundation models on [build.nvidia.com](https://build.nvidia.com).

1. Go to [build.nvidia.com/models](https://build.nvidia.com/models).
2. Choose any model (e.g., `llama-3.3-70b-instruct`) and click **Get API Key** or sign in/register for a developer account.
3. Generate your API Key. It will look like `nvapi-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`.
4. Copy the key and keep it safe.

---

## ⚡ Step 2: Deploy the Backend Server (Free Hosting)

You can run the backend server locally for development or deploy it to a free hosting provider so it is accessible from anywhere.

### Option A: Local Development Setup
To run the server on your local machine:
1. Open terminal and navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your API key:
   - Open the `.env` file inside the `server/` directory.
   - Replace `nvapi-YOUR_NVIDIA_API_KEY_HERE` with your actual NVIDIA NIM API key.
4. Start the server:
   ```bash
   npm run dev
   ```
   *The server will automatically load your `.env` file and run at `http://localhost:3000`.*

---

### Option B: Deploy to Koyeb (Recommended - Always Active)
Koyeb offers a very generous free tier with fast response times and does not automatically spin down (hibernate) your services due to inactivity.

1. Create a free account at [Koyeb.com](https://www.koyeb.com/).
2. Push your project folder to your private **GitHub** repository.
3. In the Koyeb console, click **Create App**.
4. Select **GitHub** as the deployment source and select your repository.
5. In the **Builder** settings:
   - Set the connection path / directory to `/server`.
   - Koyeb will automatically detect `package.json` and configure build/run scripts.
6. In **Environment Variables**, add:
   - `NVIDIA_API_KEY` = `your-nvapi-key`
7. Click **Deploy**. Koyeb will build the app and give you a public URL (e.g., `https://your-app-slug.koyeb.app`).

---

### Option C: Deploy to Render (Easy - Zero-Config)
Render offers a simple free tier for web services.

1. Sign up for a free account at [Render.com](https://render.com/).
2. Push your project folder to **GitHub**.
3. In Render, click **New +** > **Web Service**.
4. Connect your GitHub repository.
5. In the configuration settings:
   - Set **Root Directory** to `server`.
   - Set **Build Command** to `npm install`.
   - Set **Start Command** to `npm start`.
6. Click **Advanced** and add the environment variable:
   - Key: `NVIDIA_API_KEY`
   - Value: `your-nvapi-key`
7. Click **Create Web Service**. Once deployed, copy your service's URL (e.g., `https://your-service.onrender.com`).
   *Note: Render's free tier services spin down after 15 minutes of inactivity. When you send a request after it hibernates, it may take 30-50 seconds to spin back up.*

---

## 🧩 Step 3: Configure and Load the Chrome Extension

Once your backend is deployed, you must configure the extension to send requests to it.

### 1. Update Server URL in `config.js`
Open the root file `config.js` and change the `SERVER_API_URL` to point to your deployed server endpoint:
- For local dev: `http://localhost:3000/v1/forge`
- For Render: `https://your-service.onrender.com/v1/forge`
- For Koyeb: `https://your-app-slug.koyeb.app/v1/forge`

Example:
```javascript
const CONFIG = Object.freeze({
  SERVER_API_URL: 'https://codeforge-api.onrender.com/v1/forge',
  // ...
```

### 2. Update Host Permissions in `manifest.json`
To allow the extension to send network requests to your hosted domain, update the `"host_permissions"` block in the root `manifest.json` file. Replace `"https://api.yourdomain.com/*"` with your deployed endpoint.

Example:
```json
  "host_permissions": [
    "https://your-app-slug.koyeb.app/*",
    "https://your-service.onrender.com/*",
    "http://localhost/*",
    // ...
  ]
```

### 3. Load the Extension in Google Chrome
1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle switch in the top right corner).
3. Click the **Load unpacked** button in the top left.
4. Select the root folder of this project (which contains the `manifest.json` file).
5. CodeForge AI is now loaded and available in your extensions toolbar!

---

## 🤖 Supported NVIDIA NIM Models

The extension comes pre-configured with 8 premium free models from the NVIDIA catalog:

1. **Llama 3.3 70B** (`meta/llama-3.3-70b-instruct`) — Flagship general reasoning model
2. **Llama 3.1 70B** (`meta/llama-3.1-70b-instruct`) — Exceptional contextual understanding
3. **Llama 3.1 8B** (`meta/llama-3.1-8b-instruct`) — Quick, lightweight chat
4. **Llama 3.2 3B** (`meta/llama-3.2-3b-instruct`) — Small and efficient edge model
5. **Llama 3.2 1B** (`meta/llama-3.2-1b-instruct`) — Ultra-fast, lightweight responses
6. **Phi 4 Mini** (`microsoft/phi-4-mini-instruct`) — Microsoft's latency-optimized model
7. **Gemma 2 2B IT** (`google/gemma-2-2b-it`) — Google's high-performance edge chat model
8. **Mixtral 8x7B** (`mistralai/mixtral-8x7b-instruct-v0.1`) — Premium Mixture-of-Experts (MoE)

---

## 🛠️ Troubleshooting

- **Server returns 502 Upstream AI Provider Error:** Check your server console logs. This usually means the model ID has changed in the NVIDIA Catalog or your `NVIDIA_API_KEY` is invalid or expired.
- **Connection Dot is Red (Error):** Make sure the server is actively running and that the URL in `config.js` is correct. If running on Render, remember that it takes up to a minute to wake up from hibernation.
- **CORS Errors:** The server has a built-in CORS lock. By default, it accepts requests from any origin (`['*']`). If you want to lock it down for security, set the `ALLOWED_ORIGINS` environment variable to your Chrome extension's ID (e.g., `chrome-extension://your-extension-id`).
