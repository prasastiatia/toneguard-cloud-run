# 🛡️ ToneGuard — Alarm Anti-Salah Paham & AI Tone Checker

- **Tagline:** 100% Privacy-First Indonesian AI Tone & Empathy Checker with On-Device PWA Keyboard Simulator and Stateless Cloud Run Auto-Moderator Bot.
- **Live URL:** [https://toneguard-service-iuednz6y3a-et.a.run.app](https://toneguard-service-iuednz6y3a-et.a.run.app) *(Google Cloud Run `asia-southeast2` & Offline-First Mobile PWA)*
- **Landing Page URL:** [https://toneguard-service-iuednz6y3a-et.a.run.app](https://toneguard-service-iuednz6y3a-et.a.run.app)
- **Repository:** [https://github.com/prasastiatia/toneguard-cloud-run](https://github.com/prasastiatia/toneguard-cloud-run)
- **Short Demo Video (<= 3 min):** [https://youtu.be/SfygDvmnfVU](https://youtu.be/SfygDvmnfVU) *(1080p Real Website Walkthrough: End-User Experience, Primary Features & Operational UX Flow)*
- **Technical Deep-Dive Video (<= 15 min):** [https://youtu.be/Qlco0cUIFMs](https://youtu.be/Qlco0cUIFMs) *(1080p Technical Walkthrough: Architecture, Guardrails, Token Optimization & Live Demo)*
- **Presentation Deck:** [https://toneguard-service-iuednz6y3a-et.a.run.app/pitch-deck.html](https://toneguard-service-iuednz6y3a-et.a.run.app/pitch-deck.html) *(Live Interactive Presentation Deck + 1-Click PDF & `.pptx` Export)* | [Short URL (`/deck`)](https://toneguard-service-iuednz6y3a-et.a.run.app/deck)

---

## 1. Problem Statement
<!-- What pain point does this solve? Who is affected? -->
Digital text communication strips away 93% of non-verbal cues—such as vocal intonation, facial expressions, and body language—that are essential for conveying empathy and true intent. In Indonesian digital culture (workplace teams, remote organizations, customer service, and personal messaging), subtle pragmatic markers like emphatic particles (*"kok"*, *"sih"*, *"dong"*), abrupt imperatives, capitalization (*ALL CAPS*), or punctuation clusters (`!!`, `?!`) frequently trigger unintended friction. Concise messages are easily misread as passive-aggressive, demanding, or hostile, leading to workplace conflict, psychological stress, and damaged relationships.

**Who is affected & why existing tools fail:**
1. **Remote Workers, Teams & Communities:** Suffer from daily chat misunderstandings and group friction because conventional grammar checkers only fix formal spelling rather than detecting Indonesian conversational micro-aggressions.
2. **Privacy-Conscious Users & Enterprises:** Refuse to paste confidential corporate messages, financial details, or personal chats into third-party cloud LLM tools due to the risk of leaking Personally Identifiable Information (**PII**) and violating Indonesia's Personal Data Protection Law (**UU PDP**).

---

## 2. Solution & Core Features
<!-- Describe the MVP and how it addresses the problem -->
**ToneGuard (v5.3 Hardened)** solves both the empathy gap and the privacy dilemma by providing a **100% Zero-Retention AI Tone & Empathy Checker** that works as an **Offline-First Progressive Web App (PWA) & Mobile Keyboard Simulator**, alongside a **Stateless Auto-Moderator Bot** on Google Cloud Run.

### Core Features:
1. **🚦 Real-Time Tone Risk Radar (< 10ms):**
   Analyzes Indonesian text as the user types and categorizes misunderstanding risk into three actionable levels:
   - 🟢 **Safe / Friendly (`< 30%`):** Positive or neutral tone, safe to send.
   - 🟡 **Rigid / Prone to Misunderstanding (`30% – 54%`):** Sounds cold, abrupt, or slightly tense.
   - 🔴 **Aggressive / High Conflict Risk (`≥ 55%`):** Triggers an active pre-send warning and highlights the exact offending phrases/particles.
2. **✍️ Context-Aware Dual Empathetic Auto-Rewrite:**
   Instantly generates **2 constructive rewrite options**—**Option A (Warm & Empathetic)** and **Option B (Professional & Objective)**—tailored to the selected relationship context (**Professional/Work**, **Romantic Partner**, or **Family/Friends**).
3. **🤖 Smart Stateless Group Auto-Moderator Bot (Telegram, Slack & REST API):**
   - **Personal DM Mode:** Acts as a private drafting assistant that evaluates tone and offers polite rewrites before the user messages a boss or client.
   - **Group Auto-Moderator Mode (`isGroupAutoMod`):** Employs a smart **`SILENT_PASS`** mechanism—staying completely silent during normal group chats (`Risk < 55%`) to avoid spam, and **automatically intervening** with constructive de-escalation suggestions only when high-risk/aggressive messages (`Risk ≥ 55%`) are detected.
4. **🛡️ Automatic Outbound PII Scrubber:**
   Automatically masks sensitive Indonesian PII—including **NIK (16-digit National ID)**, **Bank Account Numbers**, **Credit/Debit Cards**, **OTP/PIN codes**, **Email Addresses**, and **Phone Numbers**—into `[SENSOR-PRIVASI]` in volatile RAM before any bot response is generated.

---

## 3. Architecture & Tech Stack
- **Frontend / Client:** Vanilla HTML5, CSS3 (Responsive Glassmorphism UI & Mobile Keyboard Simulator), ES6+ JavaScript, **Web Workers API** (`js/worker.js` for non-blocking 60 FPS background inference), and **Progressive Web App (PWA)** with Offline-First **Service Worker** (`sw.js` & `manifest.json`).
- **Backend / Microservices:** Zero-dependency **Node.js 24 Active LTS (`v24.22.1+` on `node:24-alpine`)** stateless HTTP & Webhook microservice (`server.js`) running on **Google Cloud Run** (`/api/v1/analyze`, `/api/v1/webhook/telegram`, `/api/v1/webhook/slack`, `/healthz`).
- **AI / LLM Integration:** Hybrid NLP Engine combining a custom **Indonesian Pragmatic & Micro-Aggression Heuristic Engine** with **On-Device WebAssembly AI** via **`@xenova/transformers` (`Transformers.js` v2.17.2)** running quantized `Xenova/distilbert-base-uncased-finetuned-sst-2-english` (ONNX/Wasm) directly inside the client's browser Web Worker.
- **Security & Guardrails:**
  - **Zero Data Retention:** 0 databases, 0 disk writes, and 0 chat payload logging (`Cache-Control: no-store, no-cache, must-revalidate, private`).
  - **Automatic PII Masking:** Regex-based scrubbing of NIK, bank accounts, cards, OTP, phone numbers, and emails prior to processing or group quoting.
  - **CVE-2026-111497 ("Node2Shell") Mitigation:** Patched Node.js 24 LTS runtime + strict HTTP `Content-Encoding` gate (`415 Unsupported Media Type` for compressed exploit payloads) + 32 KB max body limit (`413 Payload Too Large`).
  - **Runtime & Network Hardening:** V8 flags `--disable-proto=delete` (Prototype Pollution immunity) and `--disallow-code-generation-from-strings`, Strict Public Asset Allowlist (`403 Forbidden` on backend files), Constant-Time authentication (`crypto.timingSafeEqual`), and a **Zero-PII Ephemeral SHA-256 Rate Limiter** with 60-second rotating salt.
- **Deployment & Ops:** **Google Cloud Run** (Serverless managed container in `asia-southeast2` Jakarta, scale-to-zero `--min-instances 0`, `--max-instances 5`, `--memory 256Mi`), **Google Cloud Build & Artifact Registry**, and **PWA / Firebase App Distribution (via Android TWA Bubblewrap)** for mobile testers.

---

## 4. Local Setup & Reproduction Steps
```bash
# 1. Clone the repo
git clone https://github.com/prasastiatia/toneguard-cloud-run.git
cd toneguard-cloud-run

# 2. Verify syntax integrity (Zero external npm dependencies required)
npm run check

# 3. Setup optional environment variables for Bot & API authentication
# On Linux / macOS:
export PORT=8080
export NODE_ENV=production
export RATE_LIMIT_MAX_PER_MIN=60
export TELEGRAM_BOT_TOKEN="your_botfather_token_here"
export TELEGRAM_WEBHOOK_SECRET="your_webhook_secret_here"
export TONEGUARD_API_KEY="your_api_key_here"

# On Windows PowerShell:
# $env:PORT="8080"; $env:TONEGUARD_API_KEY="your_api_key_here"

# 4. Run locally with hardened V8 flags
npm start
# Open http://localhost:8080 in your browser
```

### Deploy to Google Cloud Run (Optional Reproduction)
```bash
gcloud run deploy toneguard-service \
  --source . \
  --region asia-southeast2 \
  --platform managed \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 80 \
  --timeout 30s \
  --set-env-vars "NODE_ENV=production,RATE_LIMIT_MAX_PER_MIN=60,TELEGRAM_BOT_TOKEN=YOUR_TOKEN,TELEGRAM_WEBHOOK_SECRET=YOUR_SECRET,TONEGUARD_API_KEY=YOUR_API_KEY"
```

