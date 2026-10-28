/**
 * ToneGuard — Interactive Presentation Deck Controller (js/pitch-deck.js)
 * Externalized for 100% compliance with ToneGuard's strict Content-Security-Policy (no unsafe-inline scripts).
 */

(function () {
  const slides = document.querySelectorAll('.slide');
  const counter = document.getElementById('slideCounter');
  let current = 0;
  let currentTheme = 'light';
  let currentFontSize = 16;
  let scrollAllMode = false;

  function showSlide(index) {
    if (scrollAllMode || slides.length === 0) return;
    slides[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    if (counter) {
      counter.textContent = `Slide ${current + 1} / ${slides.length}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function nextSlide() {
    showSlide(current + 1);
  }

  function prevSlide() {
    showSlide(current - 1);
  }

  function setTheme(themeName) {
    currentTheme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    ['light', 'dark', 'navy', 'paper'].forEach((t) => {
      const btn = document.getElementById('btn-' + t);
      if (btn) btn.classList.toggle('active-theme', t === themeName);
    });
  }

  function adjustFont(delta) {
    currentFontSize = Math.min(22, Math.max(13, currentFontSize + delta));
    document.body.style.setProperty('--base-font', currentFontSize + 'px');
  }

  function toggleScrollAll() {
    scrollAllMode = !scrollAllMode;
    document.body.classList.toggle('show-all-slides', scrollAllMode);
    const btn = document.getElementById('btn-scroll-mode');
    if (btn && counter) {
      if (scrollAllMode) {
        btn.textContent = '🎯 Kembali ke Mode Per-Slide';
        btn.classList.add('active-theme');
        counter.textContent = `Menampilkan Semua ${slides.length} Slide`;
      } else {
        btn.textContent = '📜 Tampilkan Semua Slide Sekaligus';
        btn.classList.remove('active-theme');
        counter.textContent = `Slide ${current + 1} / ${slides.length}`;
      }
    }
  }

  function exportToPPTX() {
    if (typeof PptxGenJS === 'undefined') {
      alert('Pustaka PptxGenJS sedang dimuat. Pastikan koneksi internet aktif atau gunakan tombol Save as PDF.');
      return;
    }
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'ToneGuard Team';
    pptx.title = 'ToneGuard — Final Presentation Deck';

    const palettes = {
      light: { bg: 'FFFFFF', badge: '4F46E5', title: '0F172A', sub: '3730A3', body: '1E293B' },
      paper: { bg: 'FFFDF9', badge: '0D9488', title: '1C1917', sub: '0F766E', body: '292524' },
      dark:  { bg: '09090B', badge: '818CF8', title: 'FFFFFF', sub: 'A5B4FC', body: 'F4F4F5' },
      navy:  { bg: '0F172A', badge: '38BDF8', title: 'FFFFFF', sub: '7DD3FC', body: 'F1F5F9' }
    };
    const pal = palettes[currentTheme] || palettes.light;

    const slideData = [
      {
        badge: 'EXECUTIVE PRESENTATION DECK (SLIDE 1/6)',
        title: 'ToneGuard (v5.3 Hardened)',
        subtitle: '100% Privacy-First Indonesian AI Tone Checker & Stateless Cloud Run Bot',
        bullets: [
          '• Product Vision: Proactive conflict de-escalation (< 10ms) before hitting Send, with 0% data retention.',
          '• Technical Architecture: On-Device WebAssembly AI (Transformers.js) + Hardened Node.js 24 LTS on Google Cloud Run.',
          '• Market Validation: 212M+ Indonesian messaging users & 24M+ knowledge workers needing UU PDP compliance.',
          '• Business Model: Free B2C Offline PWA + B2B Group Auto-Moderator SaaS + Enterprise CS QA API (>92% Gross Margin).',
          '• Live Cloud Run URL: https://toneguard-service-iuednz6y3a-et.a.run.app'
        ]
      },
      {
        badge: 'PILLAR 01 • PRODUCT VISION (SLIDE 2/6)',
        title: '1. Product Vision: Solving Digital Empathy & Privacy',
        subtitle: 'Shifting digital communication from reactive damage control to proactive empathy',
        bullets: [
          '• The Problem: Text strips away 93% of non-verbal cues. Indonesian particles ("kok", "sih", "dong") & abrupt imperatives cause workplace conflict.',
          '• The Privacy Dilemma: Users refuse to paste confidential corporate chats or PII into third-party Cloud LLMs.',
          '• ToneGuard Vision: Instant <10ms tone risk radar (Safe <30%, Rigid 30-54%, High Conflict >=55%).',
          '• Dual Context-Aware Auto-Rewrite: Provides Warm/Empathetic & Professional/Objective rewrites for Work, Partner, or Family.',
          '• Automatic Outbound PII Scrubber: Masks NIK, Bank Accounts, Cards, OTP, Email, & Phone Numbers into [SENSOR-PRIVASI].'
        ]
      },
      {
        badge: 'PILLAR 02 • TECHNICAL ARCHITECTURE (SLIDE 3/6)',
        title: '2. Technical Architecture: Dual-Layer Zero-Retention',
        subtitle: '100% On-Device Client PWA + Hardened Stateless Google Cloud Run Microservice',
        bullets: [
          '• Client Layer (PWA): Background Web Worker (60 FPS UI) + Indonesian Pragmatic Heuristics + Quantized Transformers.js (ONNX/Wasm).',
          '• Offline-First Service Worker (sw.js): Installable on Android & iOS, works 100% offline.',
          '• Cloud Layer (Google Cloud Run asia-southeast2): Node.js 24 Active LTS (node:24-alpine) with 0 external node_modules.',
          '• Stateless Bot Engine: Processes Telegram, Slack, & REST API requests in < 3ms in volatile RAM (0 Database, 0 Disk Logs).',
          '• Security Hardening (v5.3): Patched against CVE-2026-111497 ("Node2Shell"), V8 --disable-proto=delete, & Zero-PII SHA-256 Rate Limiter.'
        ]
      },
      {
        badge: 'PILLAR 03 • MARKET VALIDATION (SLIDE 4/6)',
        title: '3. Market Validation & Competitive Advantage',
        subtitle: 'Capturing Indonesia’s 24M+ Digital Workforce Under UU PDP Data Protection Mandates',
        bullets: [
          '• TAM: 212M+ active Indonesian messaging users.',
          '• SAM: 24M+ remote/hybrid corporate workers, civil servants, & Customer Support agents on Telegram, Slack, and CRM.',
          '• SOM (Year 1-2): 250,000+ active PWA users & 500+ B2B teams/communities.',
          '• Competitive Edge vs Grammarly/Cloud LLMs: Purpose-built for Indonesian conversational pragmatics, 100x faster (<10ms), 0% data retention.',
          '• Smart Group Moderation (SILENT_PASS): Stays 100% silent on normal group chats and only intervenes when Conflict Risk >= 55%.'
        ]
      },
      {
        badge: 'PILLAR 04 • BUSINESS MODEL (SLIDE 5/6)',
        title: '4. Business Model & Cloud Run Unit Economics',
        subtitle: 'Scalable 3-Tier Monetization with >92% B2B Gross Margin',
        bullets: [
          '• Tier 1 — B2C Individual (FREE Forever): Full access to Offline-First PWA & Keyboard Simulator ($0 server inference cost).',
          '• Tier 2 — B2B Team & Community Auto-Moderator (IDR 149,000 / group / month): Unlimited Telegram & Slack group moderation + custom rules.',
          '• Tier 3 — Enterprise CS Quality Assurance API (Custom SaaS Licensing): Real-time (<3ms) tone & PII guardrails for banking & e-commerce CS.',
          '• Cloud Run Unit Economics: Scale-to-zero (--min-instances 0, 256Mi RAM) costs < IDR 15,000 per 1 Million API requests ($0 when idle).'
        ]
      },
      {
        badge: 'PILLAR 05 • FUTURE ROADMAP (SLIDE 6/6)',
        title: '5. Future Roadmap (2026 – 2027)',
        subtitle: 'From Cloud Run PWA & Bot to Native Mobile Keyboard IME & Enterprise Suite',
        bullets: [
          '• Phase 1 (Q4 2026 — LIVE): Offline PWA, Hardened Cloud Run v5.3 (Jakarta), Telegram/Slack Auto-Moderator Bot & PII Scrubber.',
          '• Phase 2 (Q1 2027): Native Android Input Method Editor (IME) Keyboard via Firebase App Distribution + WhatsApp Business API.',
          '• Phase 3 (Q2–Q3 2027): WebGPU On-Device IndoBERT + Regional Indonesian Dialects (Javanese, Sundanese, Gen-Z Slang) + Browser Extension.',
          '• Phase 4 (Q4 2027): Microsoft Teams & Zendesk Plugins + On-Premise Docker Appliance for Banking & Government.'
        ]
      }
    ];

    slideData.forEach((s) => {
      const slide = pptx.addSlide();
      slide.background = { color: pal.bg };
      slide.addText(s.badge, { x: 0.5, y: 0.4, w: 9.0, h: 0.35, fontSize: 11, bold: true, color: pal.badge });
      slide.addText(s.title, { x: 0.5, y: 0.8, w: 9.0, h: 0.6, fontSize: 22, bold: true, color: pal.title });
      slide.addText(s.subtitle, { x: 0.5, y: 1.4, w: 9.0, h: 0.4, fontSize: 13, bold: true, color: pal.sub });
      slide.addText(s.bullets.join('\n\n'), {
        x: 0.5, y: 1.95, w: 9.0, h: 3.3,
        fontSize: 13, color: pal.body, valign: 'top'
      });
    });

    pptx.writeFile({ fileName: `ToneGuard_Presentation_Deck_${currentTheme}.pptx` });
  }

  // Bind DOM Event Listeners (CSP-safe: no inline onclick attributes required)
  const bindClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  bindClick('btn-light', () => setTheme('light'));
  bindClick('btn-dark', () => setTheme('dark'));
  bindClick('btn-navy', () => setTheme('navy'));
  bindClick('btn-paper', () => setTheme('paper'));
  bindClick('btn-font-dec', () => adjustFont(-1));
  bindClick('btn-font-inc', () => adjustFont(1));
  bindClick('btn-scroll-mode', toggleScrollAll);
  bindClick('btn-prev-slide', prevSlide);
  bindClick('btn-next-slide', nextSlide);
  bindClick('btn-print-pdf', () => window.print());
  bindClick('btn-export-pptx', exportToPPTX);

  document.addEventListener('keydown', (e) => {
    if (scrollAllMode) return;
    if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
  });
})();

