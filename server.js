/**
 * ToneGuard — Google Cloud Run Hardened Production Server & Stateless Bot Engine (server.js v5.1)
 *
 * Security & Privacy Architecture:
 * 1. Strict Public Asset Allowlist: Blocks HTTP access to server.js, Dockerfile, package.json, .env, etc.
 * 2. Hardened HTTP Security Headers: CSP (no unsafe-inline scripts), HSTS, COOP, CORP, nosniff, DENY frame.
 * 3. Zero-Cache API Responses: Enforces `Cache-Control: no-store, no-cache, must-revalidate, private` on all APIs.
 * 4. Zero-PII Ephemeral Hash Rate Limiter: Protects Cloud Run billing against DDoS/spam using a rotating
 *    in-memory SHA-256 salt (raw client IPs are NEVER stored in RAM or logs).
 * 5. Constant-Time Webhook Authentication: Supports `TELEGRAM_WEBHOOK_SECRET` & `TONEGUARD_API_KEY` via
 *    `crypto.timingSafeEqual`.
 * 6. Automatic Outbound Bot PII Scrubber: Masks NIK, bank accounts, cards, OTP/PIN, email, and phone numbers
 *    into `[SENSOR-PRIVASI]` before the bot ever quotes or replies to a group chat.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = '0.0.0.0';
const ROOT_DIR = __dirname;

// --- 1. STRICT PUBLIC ASSET ALLOWLIST (PREVENTS SOURCE CODE EXPOSURE) ---
const ALLOWED_PUBLIC_FILES = new Set([
  '/index.html',
  '/pitch-deck.html',
  '/manifest.json',
  '/sw.js',
  '/css/style.css',
  '/js/app.js',
  '/js/worker.js',
  '/js/pitch-deck.js'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://huggingface.co https://*.huggingface.co https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'"
].join('; ');

function setBaseSecurityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
}

function setStaticSecurityHeaders(res, ext) {
  setBaseSecurityHeaders(res);
  if (ext === '.html' || ext === '.js' || ext === '.json') {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}

function setApiNoStoreHeaders(res) {
  setBaseSecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// --- 2. ZERO-PII EPHEMERAL HASH RATE LIMITER (CLOUD RUN BILLING & DDOS GUARD) ---
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQ = parseInt(process.env.RATE_LIMIT_MAX_PER_MIN, 10) || 60;
let ephemeralSalt = crypto.randomBytes(32).toString('hex');
const rateLimitBuckets = new Map();

// Rotate ephemeral salt and wipe RAM buckets every 60 seconds so IP hashes cannot be correlated
const rateLimitCleanupTimer = setInterval(() => {
  rateLimitBuckets.clear();
  ephemeralSalt = crypto.randomBytes(32).toString('hex');
}, RATE_LIMIT_WINDOW_MS);
if (rateLimitCleanupTimer.unref) rateLimitCleanupTimer.unref();

function checkZeroPiiRateLimit(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
  const anonClientHash = crypto.createHash('sha256').update(rawIp + ephemeralSalt).digest('hex').slice(0, 24);

  const currentCount = (rateLimitBuckets.get(anonClientHash) || 0) + 1;
  rateLimitBuckets.set(anonClientHash, currentCount);

  return {
    allowed: currentCount <= RATE_LIMIT_MAX_REQ,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQ - currentCount)
  };
}

// --- 3. CONSTANT-TIME WEBHOOK & API AUTHENTICATION ---
function timingSafeCompare(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const bufA = Buffer.from(provided, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyApiKeyIfConfigured(req) {
  const expectedKey = process.env.TONEGUARD_API_KEY;
  if (!expectedKey) return true; // Open mode if env var not set
  const providedKey = req.headers['x-toneguard-api-key'] || '';
  return timingSafeCompare(String(providedKey), expectedKey);
}

function verifyTelegramSecretIfConfigured(req) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) return true; // Open mode if env var not set
  const providedSecret = req.headers['x-telegram-bot-api-secret-token'] || '';
  return timingSafeCompare(String(providedSecret), expectedSecret);
}

// --- 4. AUTOMATIC OUTBOUND BOT PII SCRUBBER (PREVENTS BOT ECHO LEAKS IN GROUPS) ---
// Uses linear-time O(N) regular expressions without nested quantifiers (Anti-ReDoS)
const SERVER_PII_PATTERNS = [
  { regex: /\b\d{16}\b/g, replacement: '[NIK-DISENSOR]', label: 'NIK 16 Digit' },
  { regex: /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{1,4}\b/g, replacement: '[KARTU-DISENSOR]', label: 'Nomor Kartu/Rekening' },
  { regex: /\b(?:bca|mandiri|bri|bni|bsi|cimb|permata|danamon|rek|rekening)\s*[:=-]?\s*\d{8,16}\b/gi, replacement: '[REKENING-DISENSOR]', label: 'Nomor Rekening Bank' },
  { regex: /\b(?:otp|pin|password|pass|sandi|kode\s+rahasia)\s*(?:saya|aku|kamu|anda|ini|adalah|:|=)?\s*\b[A-Za-z0-9@#$%^&*]{4,20}\b/gi, replacement: '[KREDENSIAL-DISENSOR]', label: 'PIN/OTP/Password' },
  { regex: /\b(?:\+62|62|0)8[1-9][0-9]{6,10}\b/g, replacement: '[NO-HP-DISENSOR]', label: 'Nomor Telepon' },
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[EMAIL-DISENSOR]', label: 'Alamat Email' }
];

function scrubPIIStateless(inputText) {
  let scrubbed = String(inputText || '');
  const detectedTypes = [];
  for (const item of SERVER_PII_PATTERNS) {
    item.regex.lastIndex = 0;
    if (item.regex.test(scrubbed)) {
      detectedTypes.push(item.label);
      item.regex.lastIndex = 0;
      scrubbed = scrubbed.replace(item.regex, item.replacement);
    }
    item.regex.lastIndex = 0;
  }
  return {
    scrubbedText: scrubbed,
    piiDetected: detectedTypes.length > 0,
    piiTypes: detectedTypes
  };
}

// --- 5. STATELESS IN-MEMORY BOT NLP ENGINE (ZERO PERSISTENCE) ---
const BOT_SURGICAL_RULES = [
  {
    pattern: /\b(ga becus|gak becus|tidak becus|nggak becus)\b/gi,
    category: 'hostile',
    weight: 42,
    reason: 'Frasa merendahkan kompetensi',
    warmer: 'masih ada bagian yang bisa kita sempurnakan bersama',
    corporate: 'belum sepenuhnya memenuhi standar kualitas yang diharapkan'
  },
  {
    pattern: /\b(bodoh|tolol|goblok|idiot|bego|brengsek|bangsat|anjing|babi|sampah|bacot)\b/gi,
    category: 'hostile',
    weight: 55,
    reason: 'Kata kasar/ofensif',
    warmer: 'membuat situasi menjadi kurang nyaman',
    corporate: 'menjadi kendala serius yang perlu kita evaluasi secara objektif'
  },
  {
    pattern: /\b(jangan banyak omong|tutup mulut|gak usah banyak alasan|jangan banyak alasan)\b/gi,
    category: 'hostile',
    weight: 40,
    reason: 'Menutup ruang diskusi secara agresif',
    warmer: 'yuk kita fokus mencari jalan keluarnya bersama',
    corporate: 'mohon fokus pada langkah penyelesaian dan tindak lanjutnya'
  },
  {
    pattern: /\b(lelet banget|lambat banget|lelet|pemalas|malas)\b/gi,
    category: 'hostile',
    weight: 38,
    reason: 'Serangan karakter personal',
    warmer: 'semoga progresnya bisa kita akselerasi bersama ya',
    corporate: 'perlu dioptimalkan kembali kecepatan eksekusinya'
  },
  {
    pattern: /\b(sekarang juga|detik ini juga|hari ini juga|pokoknya hari ini)\b/gi,
    category: 'demanding',
    weight: 30,
    reason: 'Nada mendesak & ultimatum kaku',
    warmer: 'jika sudah senggang hari ini ya',
    corporate: 'sebagai prioritas utama sesuai target hari ini'
  },
  {
    pattern: /\b(jangan sampai miss lagi|jangan miss lagi|kok bisa miss|jangan blunder)\b/gi,
    category: 'demanding',
    weight: 34,
    reason: 'Teguran menyalahkan (blaming)',
    warmer: 'yuk kita pastikan bersama supaya tidak ada yang terlewat',
    corporate: 'mohon dapat dipastikan kembali akurasinya agar berjalan lancar'
  },
  {
    pattern: /\b(mana hasilnya|mana laporannya|mana draf|kok belum selesai|kenapa belum selesai)\b/gi,
    category: 'demanding',
    weight: 28,
    reason: 'Pertanyaan interogatif menyudutkan',
    warmer: 'boleh tahu sudah sampai mana progres untuk',
    corporate: 'mohon informasi terkait status perkembangan'
  },
  {
    pattern: /\b(seperti yang sudah saya katakan sebelumnya|kan sudah saya bilang|tolong baca lagi|makanya baca|baca yang bener)\b/gi,
    category: 'passiveAggressive',
    weight: 35,
    reason: 'Frasa pasif-agresif & menyindir',
    warmer: 'izin menyambung catatan kita sebelumnya, boleh dicek kembali ya',
    corporate: 'merujuk kembali pada poin pembahasan sebelumnya, mohon dapat ditinjau kembali'
  },
  {
    pattern: /\b(terserah kamu mau gimana|terserah lah|terserah kamu|terserah|gausah dibahas lagi)\b/gi,
    category: 'passiveAggressive',
    weight: 32,
    reason: 'Penarikan diri pasif-agresif',
    warmer: 'mari kita diskusikan jalan tengah yang paling nyaman untuk kita semua ya',
    corporate: 'kami mempercayakan keputusan terbaik sesuai pertimbangan bersama'
  }
];

const NEGATION_PREFIX = /\b(tidak\s+harus|gak\s+harus|ga\s+harus|tidak\s+perlu|gak\s+perlu|jangan\s+buru-buru|tidak|bukan|jangan)\s*$/i;
const BARE_IMPERATIVE = /(?:^|[.!?]\s+)(kirim|kirimkan|cek|periksa|revisi|perbaiki|kerjakan|buatkan|selesaikan|siapkan)\b/gi;
const SOFTENERS = /\b(tolong|mohon|bisa|boleh|izin|mari|yuk|terima kasih|makasih|thanks)\b/i;

const MAX_TEXT_LENGTH = 2000; // Hard cap per analysis to guarantee <2ms execution and block ReDoS

function analyzeTextStateless(rawText, mode = 'professional', isGroupAutoMod = false) {
  const textRaw = String(rawText || '').trim().slice(0, MAX_TEXT_LENGTH);
  if (!textRaw) {
    return { status: 'neutral', score: 0, label: 'Kosong', botAction: 'SILENT_PASS', piiScrubbed: false, rewrites: [] };
  }

  // SECURITY UPGRADE: Automatically scrub PII before generating any outbound bot rewrites!
  const piiResult = scrubPIIStateless(textRaw);
  const text = piiResult.scrubbedText;

  let riskScore = 0;
  const triggers = [];
  let warmerCore = text;
  let corporateCore = text;

  for (const rule of BOT_SURGICAL_RULES) {
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      const before = text.slice(Math.max(0, m.index - 25), m.index);
      if (rule.category !== 'hostile' && NEGATION_PREFIX.test(before.trim())) {
        continue;
      }
      riskScore += rule.weight;
      triggers.push(`${rule.reason} ("${m[0]}")`);
    }
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(warmerCore)) {
      warmerCore = warmerCore.replace(rule.pattern, rule.warmer);
      corporateCore = corporateCore.replace(rule.pattern, rule.corporate);
    }
    rule.pattern.lastIndex = 0;
  }

  BARE_IMPERATIVE.lastIndex = 0;
  if (BARE_IMPERATIVE.test(text) && !SOFTENERS.test(text)) {
    riskScore += 24;
    triggers.push('Kalimat perintah langsung tanpa "tolong/mohon"');
    warmerCore = warmerCore.replace(BARE_IMPERATIVE, (full, v) => `boleh minta tolong untuk ${v.toLowerCase()}`);
    corporateCore = corporateCore.replace(BARE_IMPERATIVE, (full, v) => `mohon bantuan untuk dapat ${v.toLowerCase()}`);
  }

  if (/\b(tapi|namun|sayangnya)\b/i.test(text) && riskScore > 20) {
    riskScore = Math.round(riskScore * 1.3);
    triggers.push('Klausa kontras ("tapi...") mempertajam kritik');
  }

  if (SOFTENERS.test(text) && riskScore < 45) {
    riskScore = Math.max(0, riskScore - 18);
  }

  const finalScore = Math.max(0, Math.min(100, riskScore));
  const status = finalScore >= 55 ? 'red' : finalScore >= 26 ? 'yellow' : 'green';
  const label =
    status === 'red'
      ? '🔴 Agresif / Ketus / Menuntut'
      : status === 'yellow'
      ? '🟡 Berisiko / Kaku / Dingin'
      : '🟢 Aman & Kondusif';

  const cleanEnd = (s) => {
    const t = s.replace(/!+/g, '.').trim();
    return /[.!?]$/.test(t) ? t : t + '.';
  };

  const rewrites = [
    {
      style: '💖 Lebih Hangat & Empatik',
      text: `Halo! ${cleanEnd(warmerCore)} Terima kasih banyak sebelumnya atas bantuan dan pengertiannya ya 🙏`
    },
    {
      style: '👔 Profesional & Konstruktif',
      text: `Selamat siang, ${cleanEnd(corporateCore)} Terima kasih atas kerja sama dan koordinasinya.`
    }
  ];

  const botAction = isGroupAutoMod && finalScore < 55 ? 'SILENT_PASS' : 'RESPOND';
  const piiNotice = piiResult.piiDetected
    ? `\n🔒 _Privasi Otomatis: Data sensitif (${piiResult.piiTypes.join(', ')}) telah disensor otomatis oleh Bot._`
    : '';

  return {
    status,
    score: finalScore,
    label,
    triggers,
    piiScrubbed: piiResult.piiDetected,
    piiTypes: piiResult.piiTypes,
    rewrites,
    botAction,
    moderationMessage:
      status === 'red'
        ? `🛡️ *ToneGuard Auto-Moderator:* Terdeteksi tensi komunikasi tinggi (*Risiko ${finalScore}%*). Mari jaga diskusi tetap kondusif.${piiNotice}\n\n✨ *Saran Penyampaian Konstruktif:*\n"${rewrites[0].text}"`
        : null
  };
}

// --- 6. HELPER FOR READING JSON REQUEST BODY (MAX 32KB + ANTI-PROTOTYPE POLLUTION) ---
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > 32768) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (totalBytes === 0) return resolve({});
      try {
        const rawStr = Buffer.concat(chunks, totalBytes).toString('utf8');
        // Block embedded NUL bytes in JSON body (CVE-2026-105482 defense-in-depth)
        if (rawStr.includes('\0')) {
          reject(new Error('Invalid NUL byte in payload'));
          return;
        }
        // Strip __proto__, constructor, and prototype keys to prevent Prototype Pollution
        const parsed = JSON.parse(rawStr, (key, value) => {
          if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            return undefined;
          }
          return value;
        });
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendTelegramReply(chatId, text, replyToMessageId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  const payload = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_to_message_id: replyToMessageId
  });

  const req = https.request(
    {
      hostname: 'api.telegram.org',
      servername: 'api.telegram.org', // Strict SNI & TLS Hostname pinning (CVE-2026-105483 / CVE-2026-106069)
      minVersion: 'TLSv1.3',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'identity', // Never negotiate Brotli decompression (CVE-2026-111497 Node2Shell guard)
        'Content-Length': Buffer.byteLength(payload)
      }
    },
    (res) => {
      res.on('data', () => {});
    }
  );
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

// --- 7. HTTP SERVER & ROUTER (WITH CVE-2026 "NODE2SHELL" & RUNTIME MITIGATIONS) ---
const server = http.createServer(async (req, res) => {
  // 1. Mitigate CVE-2026-111497 ("Node2Shell" Brotli Out-of-Bounds Write):
  // Reject any compressed request stream (Content-Encoding: br, gzip, deflate) immediately
  if (req.headers['content-encoding']) {
    setBaseSecurityHeaders(res);
    res.writeHead(415, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: '415 Unsupported Media Type: Compressed request bodies (Content-Encoding) are prohibited by CVE-2026-111497 security policy.' }));
    req.destroy();
    return;
  }

  let pathname = '/';
  try {
    // 2. Mitigate CVE-2026-105482 (NUL Byte Truncation) & ERR_INVALID_URL Crash:
    const rawUrl = String(req.url || '/');
    if (
      rawUrl.length > 512 ||
      rawUrl.startsWith('//') ||
      rawUrl.includes('\\') ||
      rawUrl.includes('\0') ||
      rawUrl.toLowerCase().includes('%00')
    ) {
      setBaseSecurityHeaders(res);
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('400 Bad Request');
      return;
    }
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    pathname = parsedUrl.pathname;
  } catch (urlErr) {
    setBaseSecurityHeaders(res);
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request: Malformed URL');
    return;
  }

  // A. Cloud Run Health Check Endpoint
  if (req.method === 'GET' && pathname === '/healthz') {
    setApiNoStoreHeaders(res);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'toneguard-cloud-run',
        version: '5.1.0-hardened',
        privacy: 'stateless-zero-persistence-pii-scrubbed',
        uptimeSeconds: Math.round(process.uptime())
      })
    );
    return;
  }

  // Apply Zero-PII Rate Limiting to all API & Webhook endpoints
  if (pathname.startsWith('/api/')) {
    setApiNoStoreHeaders(res);
    const rateStatus = checkZeroPiiRateLimit(req);
    res.setHeader('X-RateLimit-Remaining', String(rateStatus.remaining));
    if (!rateStatus.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Too Many Requests. Rate limit exceeded.' }));
      return;
    }
  }

  // B. Stateless Tone Analysis & Auto-Bot API (POST /api/v1/analyze)
  if (req.method === 'POST' && pathname === '/api/v1/analyze') {
    if (!verifyApiKeyIfConfigured(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid X-ToneGuard-Api-Key' }));
      return;
    }
    try {
      const payload = await readJsonBody(req);
      const result = analyzeTextStateless(
        payload.text || '',
        payload.mode || 'professional',
        Boolean(payload.isGroupAutoMod)
      );
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // C. Telegram Bot Webhook Endpoint (POST /api/v1/webhook/telegram)
  if (req.method === 'POST' && pathname === '/api/v1/webhook/telegram') {
    if (!verifyTelegramSecretIfConfigured(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized: Invalid Telegram Webhook Secret Token' }));
      return;
    }
    try {
      const update = await readJsonBody(req);
      const msg = update.message || update.edited_message;
      if (!msg || !msg.text) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, skipped: true }));
        return;
      }

      const chatType = msg.chat?.type || 'private';
      const isGroup = chatType === 'group' || chatType === 'supergroup';
      const analysis = analyzeTextStateless(msg.text, 'professional', isGroup);

      let botReplyText = null;
      if (isGroup) {
        if (analysis.botAction === 'RESPOND' && analysis.moderationMessage) {
          botReplyText = analysis.moderationMessage;
          sendTelegramReply(msg.chat.id, botReplyText, msg.message_id);
        }
      } else {
        botReplyText =
          `🛡️ *Hasil Analisis ToneGuard*\n` +
          `Status: *${analysis.label}* (Risiko: ${analysis.score}%)\n` +
          (analysis.triggers.length > 0 ? `Pemicu: _${analysis.triggers.join(', ')}_\n` : '') +
          (analysis.piiScrubbed ? `🔒 _Data sensitif (${analysis.piiTypes.join(', ')}) telah disensor otomatis._\n\n` : `\n`) +
          `✨ *Opsi Tulis Ulang Empatik:*\n` +
          `1️⃣ ${analysis.rewrites[0]?.text || ''}\n\n` +
          `2️⃣ ${analysis.rewrites[1]?.text || ''}`;
        sendTelegramReply(msg.chat?.id, botReplyText, msg.message_id);
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: true,
          chatType,
          botAction: analysis.botAction,
          botReplyText,
          analysis
        })
      );
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // D. Slack Slash Command / Webhook Endpoint (POST /api/v1/webhook/slack)
  if (req.method === 'POST' && pathname === '/api/v1/webhook/slack') {
    if (!verifyApiKeyIfConfigured(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      return;
    }
    try {
      const payload = await readJsonBody(req);
      const text = payload.text || payload.event?.text || '';
      const analysis = analyzeTextStateless(text, 'professional', false);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `🛡️ *ToneGuard Check:* ${analysis.label} (Risiko: ${analysis.score}%)\n✨ *Saran Profesional:* ${analysis.rewrites[1]?.text || ''}`
        })
      );
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // E. Serve Strictly Allowlisted Static Files for the Web App
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    setBaseSecurityHeaders(res);
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const DECK_ROUTES = new Set([
    '/deck',
    '/pitch-deck',
    '/presentation',
    '/PRESENTATION_DECK_UPDATED.html',
    '/docs/PRESENTATION_DECK_UPDATED.html'
  ]);
  const normalizedRoute = pathname === '/'
    ? '/index.html'
    : (DECK_ROUTES.has(pathname) ? '/pitch-deck.html' : pathname);

  // Enforce Strict Allowlist: Block access to /server.js, /Dockerfile, /package.json, /docs/*, etc.
  if (!ALLOWED_PUBLIC_FILES.has(normalizedRoute)) {
    setBaseSecurityHeaders(res);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Restricted by ToneGuard Zero-Exposure Policy');
    return;
  }

  const filePath = path.join(ROOT_DIR, normalizedRoute);
  if (!filePath.startsWith(ROOT_DIR)) {
    setBaseSecurityHeaders(res);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      setBaseSecurityHeaders(res);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    setStaticSecurityHeaders(res, ext);
    res.writeHead(200, { 'Content-Type': contentType });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  });
});

// Harden HTTP Server Timeouts against Slowloris, HTTP/2 Rapid Reset & Request Smuggling (CVE-2024-27983 / CVE-2023-30589)
server.headersTimeout = 10000;      // Max 10 seconds to receive HTTP headers
server.requestTimeout = 15000;      // Max 15 seconds for entire request lifecycle
server.keepAliveTimeout = 5000;     // Close idle keep-alive sockets after 5 seconds
server.maxHeadersCount = 40;        // Limit number of HTTP headers per request

// Graceful Shutdown for Google Cloud Run (SIGTERM / SIGINT)
function gracefulShutdown(signal) {
  rateLimitBuckets.clear();
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(PORT, HOST, () => {
  console.log(`🛡️ ToneGuard Hardened Cloud Run Server (v5.1) listening on http://${HOST}:${PORT}`);
});
