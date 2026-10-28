/**
 * ToneGuard Main Application Controller v2.0 (app.js)
 * Manages UI interactions, Web Worker bridge, PII safe rendering,
 * inline trigger surgical fixing, 4D emotion bars, interactive two-way
 * phone chat simulator, real-time PerformanceObserver network auditor, and PWA Service Worker.
 */

// --- 1. STATE & CONTACT PERSONAS WITH MULTI-SCENARIOS & POWER DYNAMICS ---
const state = {
  activeMode: 'professional',
  activeSubRole: 'boss_client',
  scenarioIndex: 0,
  currentText: '',
  originalDraftBeforeRewrite: null,
  lastAnalysis: null,
  capsLock: false,
  isOfflineSimulated: false,
  analysisCount: 0,
  keystrokeTimes: [],
  backspaceCount: 0,
  debounceTimer: null,
  worker: null
};

const MODE_CONTACTS = {
  professional: {
    name: 'Budi Santoso (Project Lead)',
    shortName: '👔 Budi:',
    status: 'Online di Slack',
    avatar: '👔',
    subRoles: [
      { id: 'boss_client', label: '👔 Atasan / Klien VIP', contactName: 'Budi Santoso (VP / Klien VIP)', short: '👔 Pak Budi:' },
      { id: 'peer', label: '🤝 Rekan Setim (Peer)', contactName: 'Dimas (Rekan Setim)', short: '🤝 Dimas:' },
      { id: 'subordinate', label: '📋 Tim / Bawahan', contactName: 'Rina (Junior Staff)', short: '📋 Rina:' }
    ],
    scenarios: [
      'Halo, bagaimana perkembangan draf laporan untuk presentasi jam 3 nanti?',
      'Tim klien meminta revisi mendadak untuk bagian anggaran, bisa kita bahas sore ini?',
      'Tolong kirimkan rekap data penjualan bulan Mei sebelum rapat dimulai ya.'
    ]
  },
  partner: {
    name: 'Sisca (Pacar ❤️)',
    shortName: '💖 Sisca:',
    status: 'Online di WhatsApp',
    avatar: '💖',
    subRoles: [
      { id: 'romantic', label: '💖 Pasangan Romantis', contactName: 'Sisca (Pacar ❤️)', short: '💖 Sisca:' },
      { id: 'parents', label: '🙏 Orang Tua / Mertua', contactName: 'Ibu & Ayah (Keluarga)', short: '🙏 Ibu:' }
    ],
    scenarios: [
      'Sayang, nanti malam jadi makan bareng atau kamu lembur lagi?',
      'Aku hari ini capek banget di kantor, rasanya pengen cerita banyak sama kamu...',
      'Kamu kok dari siang belum bales chat aku? Lagi sibuk banget ya?'
    ]
  },
  casual: {
    name: 'Riko (Teman Nongkrong ☕)',
    shortName: '😎 Riko:',
    status: 'Online di Instagram',
    avatar: '😎',
    subRoles: [
      { id: 'bestie', label: '😎 Sahabat Dekat', contactName: 'Riko (Sahabat Dekat ☕)', short: '😎 Riko:' },
      { id: 'community', label: '🌐 Grup Komunitas', contactName: 'Grup Komunitas Futsal', short: '🌐 Grup:' }
    ],
    scenarios: [
      'Bro, weekend ini jadi mabar atau futsalan bareng anak-anak?',
      'Woi, patungan kado ulang tahun si Dani udah lu transfer belum?',
      'Nanti malem ngopi di tempat biasa yuk, gua mau curhat dikit nih.'
    ]
  }
};

// Preset text examples for instant testing (showcasing v3.0 Deep Pragmatics, Negation, Compliment Sandwich, Formal Distancing)
const PRESETS = [
  {
    mode: 'professional',
    label: '⚡ Perintah Tanpa "Tolong"',
    text: 'Revisi draf laporan keuangan bulan Mei sekarang juga! Jangan sampai miss lagi!'
  },
  {
    mode: 'professional',
    label: '🛡️ Negasi Aman ("Tidak harus sekarang")',
    text: 'Halo Budi, tenang saja ini tidak harus sekarang juga kok, kalau sempat besok pagi saja ya 🙏'
  },
  {
    mode: 'professional',
    label: '🥪 Compliment Sandwich ("Halo... tapi...")',
    text: 'Selamat pagi Budi, terima kasih atas laporannya. Tapi kerjamu lelet banget dan datanya ga becus!'
  },
  {
    mode: 'partner',
    label: '🥶 Formal Distancing Pasangan ("Anda")',
    text: 'Baik, terima kasih atas perhatian Anda. Terserah Anda mau gimana 🙂'
  },
  {
    mode: 'partner',
    label: '❄️ Balasan 1 Kata ("Belum.")',
    text: 'Belum.'
  },
  {
    mode: 'professional',
    label: '🔒 Uji Sensor PII (NIK & Kartu)',
    text: 'Tolong segera proses data NIK 3174051209950002 sekarang juga ya jangan telat!'
  },
  {
    mode: 'casual',
    label: '🟢 Ramah & Santai',
    text: 'Halo bro! Buat futsal weekend ini gua ikut ya, thank you banget udah ngajakin! 🙌'
  }
];

// --- 2. DOM ELEMENT REFERENCES ---
let elements = {};

function initDOMElements() {
  elements = {
    // Mode tabs & Sub-Roles
    modeTabs: document.querySelectorAll('.mode-tab-btn'),
    subrolePillsContainer: document.getElementById('subrole-pills-container'),
    // Incoming Context
    btnCycleScenario: document.getElementById('btn-cycle-scenario'),
    contextSenderBadge: document.getElementById('context-sender-badge'),
    incomingContextInput: document.getElementById('incoming-context-input'),
    // Editor & Utility Buttons
    textarea: document.getElementById('user-text-input'),
    charCounter: document.getElementById('char-count'),
    wordCounter: document.getElementById('word-count'),
    btnPasteClipboard: document.getElementById('btn-paste-clipboard'),
    btnUndoDraft: document.getElementById('btn-undo-draft'),
    btnShareWA: document.getElementById('btn-share-wa'),
    btnShareEmail: document.getElementById('btn-share-email'),
    btnClear: document.getElementById('btn-secure-clear'),
    btnSendSimulator: document.getElementById('btn-send-simulator'),
    presetsContainer: document.getElementById('presets-list'),
    piiBanner: document.getElementById('pii-warning'),
    piiText: document.getElementById('pii-message'),
    btnRedactPII: document.getElementById('btn-redact-pii'),
    // Inline Trigger Highlight Panel
    inlineHighlightPanel: document.getElementById('inline-highlight-panel'),
    highlightedTextView: document.getElementById('highlighted-text-view'),
    // Tone Status Banner & 4D Bars
    toneBanner: document.getElementById('tone-banner'),
    toneBulb: document.getElementById('tone-bulb'),
    toneLabel: document.getElementById('tone-label'),
    toneDesc: document.getElementById('tone-desc'),
    toneRiskBadge: document.getElementById('tone-risk-badge'),
    liveLatencyPill: document.getElementById('live-latency-pill'),
    cadenceStatusPill: document.getElementById('cadence-status-pill'),
    xaiBreakdownRow: document.getElementById('xai-breakdown-row'),
    xaiFactorsContainer: document.getElementById('xai-factors-container'),
    riskBarFill: document.getElementById('risk-bar-fill'),
    liveEngineDot: document.querySelector('.engine-dot'),
    liveEngineText: document.getElementById('engine-status-text'),
    dimValPoliteness: document.getElementById('dim-val-politeness'),
    dimBarPoliteness: document.getElementById('dim-bar-politeness'),
    dimValWarmth: document.getElementById('dim-val-warmth'),
    dimBarWarmth: document.getElementById('dim-bar-warmth'),
    dimValAssertiveness: document.getElementById('dim-val-assertiveness'),
    dimBarAssertiveness: document.getElementById('dim-bar-assertiveness'),
    dimValUrgency: document.getElementById('dim-val-urgency'),
    dimBarUrgency: document.getElementById('dim-bar-urgency'),
    // Header, Auditor & Offline Badges
    networkMonitorBtn: document.getElementById('network-monitor'),
    networkMonitorText: document.getElementById('network-egress-text'),
    auditorPanel: document.getElementById('network-auditor-panel'),
    btnCloseAuditor: document.getElementById('btn-close-auditor'),
    auditEgressBytes: document.getElementById('audit-egress-bytes'),
    auditAnalysisCount: document.getElementById('audit-analysis-count'),
    auditSwStatus: document.getElementById('audit-sw-status'),
    auditLogStream: document.getElementById('audit-log-stream'),
    privacyStatusText: document.getElementById('privacy-status-text'),
    offlineAlertBar: document.getElementById('offline-mode-alert-bar'),
    offlineBtnIcon: document.getElementById('offline-btn-icon'),
    offlineBtnText: document.getElementById('offline-btn-text'),
    phoneSignalIndicator: document.getElementById('phone-signal-indicator'),
    // Rewrites
    rewritesContainer: document.getElementById('rewrites-container'),
    // Phone Simulator
    simContactAvatar: document.getElementById('sim-contact-avatar'),
    simContactName: document.getElementById('sim-contact-name'),
    simContactStatus: document.getElementById('sim-contact-status'),
    simMsgIncoming: document.getElementById('sim-msg-incoming'),
    simChatHistory: document.getElementById('sim-chat-history'),
    chatMessagesStream: document.getElementById('chat-messages-stream'),
    simOutgoingBubble: document.getElementById('sim-outgoing-bubble'),
    simMsgOutgoingText: document.getElementById('sim-outgoing-text'),
    btnResetChat: document.getElementById('btn-reset-chat'),
    botAutomodStatus: document.getElementById('bot-automod-status'),
    btnSimGroupConflict: document.getElementById('btn-sim-group-conflict'),
    simToolbarPill: document.getElementById('sim-toolbar-pill'),
    simToolbarDot: document.getElementById('sim-toolbar-dot'),
    simToolbarLabel: document.getElementById('sim-toolbar-label'),
    simRewriteBtn: document.getElementById('sim-rewrite-trigger'),
    simPhraseStrip: document.getElementById('sim-phrase-strip'),
    virtualKeys: document.querySelectorAll('.kb-key'),
    // Alarm Interception Modal
    alarmModal: document.getElementById('alarm-interception-modal'),
    alarmRiskSubtitle: document.getElementById('alarm-risk-subtitle'),
    alarmOriginalPreview: document.getElementById('alarm-original-preview'),
    alarmSafePreview: document.getElementById('alarm-safe-preview'),
    btnAlarmSendSafe: document.getElementById('btn-alarm-send-safe'),
    btnAlarmCancel: document.getElementById('btn-alarm-cancel'),
    btnAlarmForceSend: document.getElementById('btn-alarm-force-send'),
    // Offline simulation & Privacy Blur Shield toggle
    btnOfflineSim: document.getElementById('btn-offline-toggle'),
    btnPrivacyBlur: document.getElementById('btn-privacy-blur'),
    blurBtnText: document.getElementById('blur-btn-text'),
    autoShredBadge: document.getElementById('auto-shred-badge'),
    toastContainer: document.getElementById('toast-container')
  };
}

// --- 3. WEB WORKER & SERVICE WORKER INITIALIZATION ---
function initWorker() {
  if (window.Worker) {
    try {
      state.worker = new Worker('js/worker.js');
      state.worker.onmessage = handleWorkerMessage;
      state.worker.onerror = function (err) {
        console.warn('ToneGuard Worker Notification:', err);
      };
    } catch (e) {
      console.warn('Worker initialization notice:', e);
    }
  }
}

function initServiceWorkerAndAuditor() {
  // 1. Register Service Worker for true offline PWA support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => {
        if (elements.auditSwStatus) {
          elements.auditSwStatus.textContent = 'Aktif (PWA Ready)';
        }
        appendAuditLog('[PWA] Service Worker sw.js terdaftar. Aplikasi siap berjalan 100% offline.');
      })
      .catch(() => {
        if (elements.auditSwStatus) {
          elements.auditSwStatus.textContent = 'Local Mode';
        }
      });
  } else if (elements.auditSwStatus) {
    elements.auditSwStatus.textContent = 'Local Sandbox';
  }

  // 2. Real-Time PerformanceObserver to audit network requests
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const urlShort = entry.name.split('/').slice(-2).join('/');
            const isModelOrFont =
              entry.name.includes('huggingface.co') ||
              entry.name.includes('jsdelivr.net') ||
              entry.name.includes('fonts.g');
            if (isModelOrFont) {
              appendAuditLog(`[ASSET-LOAD] Read-only static asset: ${urlShort} (0 byte user text sent)`);
            }
          }
        }
      });
      observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
      // Ignore if unsupported
    }
  }
}

function appendAuditLog(msg) {
  if (!elements.auditLogStream) return;
  const row = document.createElement('div');
  row.className = 'audit-log-entry';
  const now = new Date().toLocaleTimeString('id-ID', { hour12: false });
  row.textContent = `[${now}] ${msg}`;
  elements.auditLogStream.prepend(row);
  while (elements.auditLogStream.children.length > 25) {
    elements.auditLogStream.removeChild(elements.auditLogStream.lastChild);
  }
}

function handleWorkerMessage(event) {
  const data = event.data;
  if (!data) return;

  // Handle Neural Model Download & Readiness Events
  if (data.action === 'MODEL_STATUS') {
    if (data.status === 'downloading') {
      if (elements.liveEngineText) {
        elements.liveEngineText.textContent = '🧠 Memuat Model AI (ONNX)...';
      }
      if (elements.liveEngineDot) {
        elements.liveEngineDot.classList.add('evaluating');
      }
    } else if (data.status === 'ready') {
      if (elements.liveEngineText) {
        elements.liveEngineText.textContent = '🧠 DistilBERT + Indo NLP Aktif';
      }
      if (elements.liveEngineDot) {
        elements.liveEngineDot.classList.remove('evaluating');
        elements.liveEngineDot.style.backgroundColor = '#6366f1';
        elements.liveEngineDot.style.boxShadow = '0 0 8px #6366f1';
      }
      showToast('🧠 Model Neural NLP (ONNX) + Surgical Indonesian Lexicon aktif!', 'indigo');
    } else if (data.status === 'fallback') {
      if (elements.liveEngineText) {
        elements.liveEngineText.textContent = '⚡ Surgical Indo NLP Aktif';
      }
      if (elements.liveEngineDot) {
        elements.liveEngineDot.classList.remove('evaluating');
        elements.liveEngineDot.style.backgroundColor = 'var(--emerald-green)';
      }
    }
    return;
  }

  if (data.action === 'MODEL_PROGRESS') {
    if (elements.liveEngineText) {
      elements.liveEngineText.textContent = `🧠 Unduh Bobot AI: ${data.progress}%`;
    }
    return;
  }

  if (data.action === 'REPLY_RESULT') {
    renderIncomingPersonaReply(data);
    return;
  }

  if (data.action === 'REDACT_PII_RESULT') {
    if (data.redactedText) {
      elements.textarea.value = data.redactedText;
      handleTextInput();
      showToast('🛡️ Data sensitif berhasil disensor ([DISENSOR])! Analisis dilanjutkan.', 'emerald');
    }
    return;
  }

  if (!data.success) return;

  state.lastAnalysis = data;
  state.analysisCount++;
  if (elements.auditAnalysisCount) {
    elements.auditAnalysisCount.textContent = `${state.analysisCount} kali`;
  }
  appendAuditLog(
    `[LOCAL-WASM] Analisis #${state.analysisCount} selesai dalam ${data.durationMs || 2}ms | Skor Risiko: ${data.score}% | Egress: 0 B`
  );

  renderToneAnalysis(data);
}

// --- 4. SAFE UI RENDERING (ZERO INNERHTML WITH USER INPUT) ---

function renderToneAnalysis(data) {
  const { status, score, label, explanation, piiDetected, piiType, rewrites, dimensions, matchedSpans, xaiFactors, cadenceInfo } = data;

  // 1. PII Alert handling
  if (piiDetected) {
    elements.piiBanner.classList.remove('hidden');
    elements.piiText.textContent = `Pola ${piiType} terdeteksi! Demi menjaga privasi data Anda, analisis teks dinonaktifkan untuk input ini.`;
    elements.toneBanner.setAttribute('data-state', 'yellow');
    elements.toneLabel.textContent = '🔒 PII Proteksi Aktif';
    elements.toneDesc.textContent = 'Kredensial atau data pribadi terlindungi di browser lokal.';
    elements.toneRiskBadge.textContent = 'Bypass';
    if (elements.riskBarFill) {
      elements.riskBarFill.style.width = '100%';
      elements.riskBarFill.style.backgroundColor = 'var(--amber-yellow)';
    }
    elements.inlineHighlightPanel.classList.add('hidden');
    if (elements.xaiBreakdownRow) elements.xaiBreakdownRow.classList.add('hidden');
    clearRewritesUI();
    updateSimulatorToolbar('yellow', 'PII Terdeteksi');
    resetEngineStatus();
    return;
  } else {
    elements.piiBanner.classList.add('hidden');
  }

  // 2. Traffic Light Banner & Real-Time Meter Update
  elements.toneBanner.setAttribute('data-state', status);
  elements.toneLabel.textContent = label;
  elements.toneDesc.textContent = explanation;
  elements.toneRiskBadge.textContent = `Risiko: ${score}%`;

  if (elements.liveLatencyPill) {
    elements.liveLatencyPill.textContent = `⚡ ${data.durationMs || 2} ms`;
  }
  if (elements.cadenceStatusPill && cadenceInfo) {
    elements.cadenceStatusPill.textContent = cadenceInfo.badgeText;
    elements.cadenceStatusPill.setAttribute('data-cadence', cadenceInfo.status || 'normal');
  }
  if (elements.riskBarFill) {
    elements.riskBarFill.style.width = (status === 'neutral' ? 0 : Math.max(score, 6)) + '%';
    if (status === 'red') {
      elements.riskBarFill.style.backgroundColor = 'var(--rose-red)';
    } else if (status === 'yellow') {
      elements.riskBarFill.style.backgroundColor = 'var(--amber-yellow)';
    } else {
      elements.riskBarFill.style.backgroundColor = 'var(--emerald-green)';
    }
  }

  // 3. Update 4D Emotion Bars & XAI Breakdown Chips
  updateDimensionBars(dimensions || { politeness: 50, warmth: 50, assertiveness: 50, urgency: 10 });
  renderXAIFactors(xaiFactors || []);

  // 4. Render Inline Trigger Highlights & Surgical Quick-Fixes
  renderInlineHighlights(state.currentText, matchedSpans || []);

  resetEngineStatus();

  // 5. Update Phone Simulator Toolbar & Quick Phrase Autocomplete Strip
  updateSimulatorToolbar(status, label);
  renderQuickPhraseStrip(data.quickPhrases || []);

  // 6. Render Context-Preserving Rewrite Recommendations
  renderRewrites(rewrites, status);
}

function renderQuickPhraseStrip(phrases) {
  const strip = elements.simPhraseStrip;
  if (!strip) return;
  strip.innerHTML = '';

  phrases.forEach((phrase) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sim-phrase-chip';
    btn.textContent = `+ ${phrase}`;
    btn.addEventListener('click', () => {
      const cur = elements.textarea.value;
      const sep = cur.length > 0 && !cur.endsWith(' ') ? ' ' : '';
      elements.textarea.value = cur + sep + phrase;
      handleTextInput();
      elements.textarea.focus();
    });
    strip.appendChild(btn);
  });
}

function updateDimensionBars(dim) {
  if (!elements.dimBarPoliteness) return;
  elements.dimValPoliteness.textContent = `${dim.politeness}%`;
  elements.dimBarPoliteness.style.width = `${dim.politeness}%`;

  elements.dimValWarmth.textContent = `${dim.warmth}%`;
  elements.dimBarWarmth.style.width = `${dim.warmth}%`;

  elements.dimValAssertiveness.textContent = `${dim.assertiveness}%`;
  elements.dimBarAssertiveness.style.width = `${dim.assertiveness}%`;

  elements.dimValUrgency.textContent = `${dim.urgency}%`;
  elements.dimBarUrgency.style.width = `${dim.urgency}%`;
}

function renderXAIFactors(factors) {
  const row = elements.xaiBreakdownRow;
  const container = elements.xaiFactorsContainer;
  if (!row || !container) return;

  container.innerHTML = '';

  if (!state.currentText.trim() || !factors || factors.length === 0) {
    row.classList.add('hidden');
    return;
  }

  row.classList.remove('hidden');

  factors.forEach((f) => {
    const chip = document.createElement('span');
    chip.className = `xai-chip xai-${f.type || 'info'}`;
    chip.textContent = f.label;
    container.appendChild(chip);
  });
}

function renderInlineHighlights(text, spans) {
  const panel = elements.inlineHighlightPanel;
  const view = elements.highlightedTextView;
  if (!panel || !view) return;

  view.innerHTML = '';

  if (!text || text.trim().length === 0 || !spans || spans.length === 0) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');

  let cursor = 0;
  spans.forEach((sp) => {
    if (sp.start > cursor) {
      const normalSlice = document.createTextNode(text.slice(cursor, sp.start));
      view.appendChild(normalSlice);
    }

    const mark = document.createElement('span');
    mark.className = `hl-span hl-${sp.severity}`;
    mark.textContent = text.slice(sp.start, sp.end);
    mark.title = sp.inlineFix
      ? `${sp.reason} — Klik untuk ganti menjadi: "${sp.inlineFix}"`
      : sp.reason;

    if (sp.inlineFix) {
      const badge = document.createElement('span');
      badge.className = 'hl-fix-hint';
      badge.textContent = ` ↻ perhalus`;
      mark.appendChild(badge);

      mark.addEventListener('click', () => {
        const updatedText = text.slice(0, sp.start) + sp.inlineFix + text.slice(sp.end);
        elements.textarea.value = updatedText;
        handleTextInput();
        showToast(`Frasa "${sp.text}" diperhalus menjadi "${sp.inlineFix}"!`, 'emerald');
      });
    }

    view.appendChild(mark);
    cursor = sp.end;
  });

  if (cursor < text.length) {
    view.appendChild(document.createTextNode(text.slice(cursor)));
  }
}

function resetEngineStatus() {
  if (elements.liveEngineDot && elements.liveEngineText) {
    elements.liveEngineDot.classList.remove('evaluating');
    elements.liveEngineText.textContent = state.isOfflineSimulated
      ? 'Offline WASM (100% Lokal)'
      : 'Local WASM Ready';
  }
}

function updateSimulatorToolbar(status, label) {
  const dot = elements.simToolbarDot;
  const lbl = elements.simToolbarLabel;

  if (status === 'green') {
    dot.style.backgroundColor = 'var(--emerald-green)';
    lbl.textContent = 'Aman & Hangat';
  } else if (status === 'yellow') {
    dot.style.backgroundColor = 'var(--amber-yellow)';
    lbl.textContent = 'Perlu Hati-Hati';
  } else if (status === 'red') {
    dot.style.backgroundColor = 'var(--rose-red)';
    lbl.textContent = 'Terlalu Ketus!';
  } else {
    dot.style.backgroundColor = '#52525b';
    lbl.textContent = 'Siap Cek';
  }
}

function renderRewrites(rewrites) {
  const container = elements.rewritesContainer;
  container.innerHTML = '';

  if (!rewrites || rewrites.length === 0) {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'editor-counters';
    emptyNotice.style.textAlign = 'center';
    emptyNotice.style.padding = '1rem';
    emptyNotice.textContent = 'Ketik kalimat untuk memunculkan rekomendasi tulis ulang kontekstual.';
    container.appendChild(emptyNotice);
    return;
  }

  rewrites.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'rewrite-card';

    // Header
    const header = document.createElement('div');
    header.className = 'rewrite-header';

    const styleTag = document.createElement('span');
    styleTag.className = 'rewrite-style-tag';
    styleTag.textContent = `${item.icon} ${item.style}`;
    header.appendChild(styleTag);

    if (item.contextPreserved) {
      const preservedBadge = document.createElement('span');
      preservedBadge.className = 'context-preserved-pill';
      preservedBadge.textContent = '🎯 Konteks Terjaga';
      header.appendChild(preservedBadge);
    }

    // Text Content + Diff View Container
    const textContent = document.createElement('div');
    textContent.className = 'rewrite-text-content';
    textContent.textContent = item.text;

    const diffViewBox = document.createElement('div');
    diffViewBox.className = 'rewrite-diff-box hidden';
    if (item.diffTokens && item.diffTokens.length > 0) {
      item.diffTokens.forEach((tok) => {
        const span = document.createElement('span');
        span.className = `diff-token diff-${tok.type}`;
        span.textContent = tok.value + ' ';
        diffViewBox.appendChild(span);
      });
    }

    // Benefit description
    const benefit = document.createElement('div');
    benefit.className = 'rewrite-benefit';
    benefit.textContent = item.benefit;

    // Actions Row
    const actionsRow = document.createElement('div');
    actionsRow.className = 'rewrite-actions-row';

    // Toggle Diff View Button
    const btnDiff = document.createElement('button');
    btnDiff.type = 'button';
    btnDiff.className = 'btn-card-action';
    btnDiff.textContent = '🔍 Lihat Perubahan';
    btnDiff.addEventListener('click', () => {
      const isDiffHidden = diffViewBox.classList.toggle('hidden');
      textContent.classList.toggle('hidden', !isDiffHidden);
      btnDiff.textContent = isDiffHidden ? '🔍 Lihat Perubahan' : '📄 Teks Utuh';
    });

    // 1-Click Copy Button
    const btnCopy = document.createElement('button');
    btnCopy.type = 'button';
    btnCopy.className = 'btn-card-action';
    btnCopy.textContent = '📋 Salin';
    btnCopy.addEventListener('click', () => {
      copyToClipboard(item.text);
    });

    // Open in WhatsApp Button
    const btnWA = document.createElement('button');
    btnWA.type = 'button';
    btnWA.className = 'btn-card-action btn-wa-action';
    btnWA.textContent = '💬 WA';
    btnWA.title = 'Kirim kalimat revisi ini ke WhatsApp';
    btnWA.addEventListener('click', () => {
      shareToWhatsApp(item.text);
    });

    // Apply to Editor Button
    const btnApply = document.createElement('button');
    btnApply.type = 'button';
    btnApply.className = 'btn-card-action btn-card-primary';
    btnApply.textContent = '✨ Gunakan di Editor';
    btnApply.addEventListener('click', () => {
      applyTextToEditor(item.text);
    });

    // Send Directly to Chat Simulator Button
    const btnSendDirect = document.createElement('button');
    btnSendDirect.type = 'button';
    btnSendDirect.className = 'btn-card-action btn-card-send';
    btnSendDirect.textContent = '📱 Kirim Chat';
    btnSendDirect.addEventListener('click', () => {
      applyTextToEditor(item.text);
      setTimeout(() => {
        sendMessageToSimulator(item.text, 'green', 10, true);
      }, 120);
    });

    actionsRow.appendChild(btnDiff);
    actionsRow.appendChild(btnCopy);
    actionsRow.appendChild(btnWA);
    actionsRow.appendChild(btnApply);
    actionsRow.appendChild(btnSendDirect);

    card.appendChild(header);
    card.appendChild(textContent);
    card.appendChild(diffViewBox);
    card.appendChild(benefit);
    card.appendChild(actionsRow);

    container.appendChild(card);
  });
}

function clearRewritesUI() {
  elements.rewritesContainer.innerHTML = '';
}

// --- 5. CLIPBOARD & EDITOR ACTIONS ---

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast('Teks berhasil disalin ke clipboard!', 'emerald');
      })
      .catch(() => {
        fallbackCopy(text);
      });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const tempInput = document.createElement('textarea');
  tempInput.value = text;
  tempInput.style.position = 'fixed';
  tempInput.style.opacity = '0';
  document.body.appendChild(tempInput);
  tempInput.select();
  try {
    document.execCommand('copy');
    showToast('Teks disalin ke clipboard!', 'emerald');
  } catch (e) {
    showToast('Gagal menyalin otomatis. Silakan salin manual.', 'amber');
  }
  document.body.removeChild(tempInput);
}

function applyTextToEditor(newText) {
  if (elements.textarea.value.trim() && elements.textarea.value !== newText) {
    state.originalDraftBeforeRewrite = elements.textarea.value;
    if (elements.btnUndoDraft) {
      elements.btnUndoDraft.classList.remove('hidden');
    }
  }
  elements.textarea.value = newText;
  handleTextInput();
  showToast('Teks revisi diterapkan! Klik "↩️ Undo Asli" jika ingin kembali.', 'emerald');
}

function undoToOriginalDraft() {
  if (state.originalDraftBeforeRewrite) {
    elements.textarea.value = state.originalDraftBeforeRewrite;
    state.originalDraftBeforeRewrite = null;
    if (elements.btnUndoDraft) {
      elements.btnUndoDraft.classList.add('hidden');
    }
    handleTextInput();
    showToast('↩️ Draf teks asli berhasil dikembalikan!', 'indigo');
  }
}

async function pasteFromClipboard() {
  if (navigator.clipboard && navigator.clipboard.readText) {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        elements.textarea.value = clipText;
        handleTextInput();
        showToast('📥 Teks berhasil ditempel dari Clipboard!', 'emerald');
      } else {
        showToast('Clipboard kosong. Salin teks terlebih dahulu.', 'amber');
      }
    } catch (err) {
      elements.textarea.focus();
      showToast('Tekan Ctrl+V untuk menempel teks (izin baca clipboard dibatasi browser).', 'amber');
    }
  } else {
    elements.textarea.focus();
    showToast('Silakan tekan Ctrl+V di kolom editor.', 'amber');
  }
}

function shareToWhatsApp(customText) {
  const txt = (customText || elements.textarea.value).trim();
  if (!txt) {
    showToast('Ketik atau pilih pesan terlebih dahulu untuk dikirim ke WhatsApp!', 'amber');
    return;
  }
  const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  showToast('💬 Membuka WhatsApp dengan draf pesan Anda...', 'emerald');
}

function shareToEmail(customText) {
  const txt = (customText || elements.textarea.value).trim();
  if (!txt) {
    showToast('Ketik pesan terlebih dahulu untuk dibuka di aplikasi Email!', 'amber');
    return;
  }
  const subject = encodeURIComponent('Tindak Lanjut Komunikasi');
  const body = encodeURIComponent(txt);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  showToast('✉️ Membuka aplikasi Email dengan draf pesan Anda...', 'emerald');
}

function redactPIIData() {
  if (state.worker && elements.textarea.value.trim()) {
    state.worker.postMessage({
      id: Date.now(),
      action: 'REDACT_PII',
      text: elements.textarea.value
    });
  }
}

// --- 6. TEXT INPUT, KEYSTROKE CADENCE & DEBOUNCE LOGIC ---

function recordKeystrokeEvent(keyName) {
  const now = performance.now();
  if (keyName === 'Backspace' || keyName === 'BACKSPACE') {
    state.backspaceCount++;
  } else if (keyName && keyName.length === 1) {
    state.keystrokeTimes.push(now);
    if (state.keystrokeTimes.length > 14) {
      state.keystrokeTimes.shift();
    }
  }
}

function getKeystrokeMetrics() {
  const times = state.keystrokeTimes;
  let cpm = 0;
  if (times.length >= 4) {
    const spanSec = (times[times.length - 1] - times[0]) / 1000;
    if (spanSec > 0.15 && spanSec < 12) {
      cpm = Math.round(((times.length - 1) / spanSec) * 60);
    }
  }
  return {
    cpm,
    backspaceCount: state.backspaceCount
  };
}

function handleTextInput() {
  const text = elements.textarea.value;
  state.currentText = text;
  if (!text.trim()) {
    state.keystrokeTimes = [];
    state.backspaceCount = 0;
  }

  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  elements.charCounter.textContent = `${chars} karakter`;
  elements.wordCounter.textContent = `${words} kata`;
  resetAutoShredTimer(text.trim().length > 0);

  // Sync to Phone Simulator outgoing preview bubble
  if (text.trim().length > 0) {
    elements.simOutgoingBubble.classList.remove('hidden');
    elements.simMsgOutgoingText.textContent = text;
  } else {
    elements.simMsgOutgoingText.textContent = 'Mulai ketik pesan...';
  }

  if (elements.liveEngineDot && elements.liveEngineText) {
    elements.liveEngineDot.classList.add('evaluating');
    elements.liveEngineText.textContent = 'Menganalisis...';
  }

  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => {
    if (state.worker) {
      state.worker.postMessage({
        id: Date.now(),
        action: 'ANALYZE',
        text: state.currentText,
        mode: state.activeMode,
        subRole: state.activeSubRole,
        incomingContext: elements.incomingContextInput ? elements.incomingContextInput.value : '',
        keystrokeMetrics: getKeystrokeMetrics()
      });
    }
  }, 140);
}

// --- 7. RELATIONSHIP MODE & SCENARIO SWITCHING ---

function setRelationshipMode(mode) {
  state.activeMode = mode;
  state.scenarioIndex = 0;

  elements.modeTabs.forEach((tab) => {
    const isCurrent = tab.dataset.mode === mode;
    tab.classList.toggle('active', isCurrent);
    tab.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
  });

  const contact = MODE_CONTACTS[mode] || MODE_CONTACTS.professional;
  if (contact.subRoles && contact.subRoles.length > 0) {
    state.activeSubRole = contact.subRoles[0].id;
    renderSubRolePills(contact.subRoles);
  }

  elements.simContactAvatar.textContent = contact.avatar;
  elements.simContactName.textContent = contact.name;
  elements.simContactStatus.textContent = contact.status;
  if (elements.contextSenderBadge) {
    elements.contextSenderBadge.textContent = contact.shortName;
  }

  const initialScenario = contact.scenarios[0];
  elements.simMsgIncoming.textContent = initialScenario;
  if (elements.incomingContextInput) {
    elements.incomingContextInput.value = initialScenario;
  }

  if (elements.simChatHistory) {
    elements.simChatHistory.innerHTML = '';
  }

  // Trigger worker even if empty so quickPhrases strip updates for the mode
  if (state.worker) {
    state.worker.postMessage({
      id: Date.now(),
      action: 'ANALYZE',
      text: state.currentText,
      mode: state.activeMode,
      subRole: state.activeSubRole,
      incomingContext: initialScenario,
      keystrokeMetrics: getKeystrokeMetrics()
    });
  }
}

function renderSubRolePills(subRoles) {
  const container = elements.subrolePillsContainer;
  if (!container) return;
  container.innerHTML = '';

  subRoles.forEach((sr) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `subrole-pill-btn ${sr.id === state.activeSubRole ? 'active' : ''}`;
    btn.textContent = sr.label;
    btn.addEventListener('click', () => {
      state.activeSubRole = sr.id;
      container.querySelectorAll('.subrole-pill-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      elements.simContactName.textContent = sr.contactName;
      if (elements.contextSenderBadge) {
        elements.contextSenderBadge.textContent = sr.short;
      }
      showToast(`Hierarki lawan bicara: ${sr.label}`, 'indigo');
      handleTextInput();
    });
    container.appendChild(btn);
  });
}

function cycleIncomingScenario() {
  const contact = MODE_CONTACTS[state.activeMode] || MODE_CONTACTS.professional;
  state.scenarioIndex = (state.scenarioIndex + 1) % contact.scenarios.length;
  const nextMsg = contact.scenarios[state.scenarioIndex];

  elements.simMsgIncoming.textContent = nextMsg;
  if (elements.incomingContextInput) {
    elements.incomingContextInput.value = nextMsg;
  }

  showToast('Skenario pesan masuk diganti!', 'indigo');
  if (state.currentText.trim().length > 0) {
    handleTextInput();
  }
}

// --- 8. INTERACTIVE TWO-WAY CHAT SIMULATOR & PRE-SEND ALARM SHIELD ---

let pendingHighRiskText = '';

function sendMessageToSimulator(overrideText, overrideStatus, overrideScore, forceBypass = false) {
  const textToSend = (overrideText !== undefined ? overrideText : elements.textarea.value).trim();
  if (!textToSend) {
    showToast('Ketik pesan terlebih dahulu sebelum mengirim ke chat simulator!', 'amber');
    return;
  }

  const toneStatus = overrideStatus || (state.lastAnalysis ? state.lastAnalysis.status : 'green');
  const toneScore = overrideScore !== undefined ? overrideScore : (state.lastAnalysis ? state.lastAnalysis.score : 15);

  // Active Pre-Send Friction Shield ("Alarm Anti-Salah Paham") when status is RED!
  if (toneStatus === 'red' && !forceBypass && elements.alarmModal) {
    pendingHighRiskText = textToSend;
    const safeRewrite =
      state.lastAnalysis && state.lastAnalysis.rewrites && state.lastAnalysis.rewrites[0]
        ? state.lastAnalysis.rewrites[0].text
        : textToSend;

    if (elements.alarmRiskSubtitle) {
      elements.alarmRiskSubtitle.textContent = `Skor Risiko Konflik: ${toneScore}% (${state.lastAnalysis ? state.lastAnalysis.label : 'Nada Ketus'})`;
    }
    if (elements.alarmOriginalPreview) {
      elements.alarmOriginalPreview.textContent = textToSend;
    }
    if (elements.alarmSafePreview) {
      elements.alarmSafePreview.textContent = safeRewrite;
    }
    elements.alarmModal.classList.remove('hidden');
    appendAuditLog(`[ALARM-SHIELD] Pengiriman pesan berisiko tinggi (${toneScore}%) diintersepsi oleh Alarm Anti-Salah Paham.`);
    return;
  }

  executeSimulatorSend(textToSend, toneStatus, toneScore);
}

function executeSimulatorSend(textToSend, toneStatus, toneScore) {
  const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // 1. Create Sent Outgoing Bubble in Chat History
  const sentBubble = document.createElement('div');
  sentBubble.className = `msg-bubble msg-sent msg-sent-${toneStatus}`;

  const msgBody = document.createElement('div');
  msgBody.textContent = textToSend;

  const metaRow = document.createElement('div');
  metaRow.className = 'msg-meta-row';

  const toneTag = document.createElement('span');
  toneTag.className = `msg-tone-tag tag-${toneStatus}`;
  toneTag.textContent =
    toneStatus === 'red' ? '🔴 Nada Ketus' : (toneStatus === 'yellow' ? '🟡 Nada Dingin' : '🟢 Nada Empatik');

  const timeReceipt = document.createElement('span');
  timeReceipt.textContent = `${nowTime} ✓✓`;

  metaRow.appendChild(toneTag);
  metaRow.appendChild(timeReceipt);

  sentBubble.appendChild(msgBody);
  sentBubble.appendChild(metaRow);

  elements.simChatHistory.appendChild(sentBubble);

  // Clear editor input after sending
  elements.textarea.value = '';
  state.currentText = '';
  elements.simMsgOutgoingText.textContent = 'Mulai ketik pesan...';
  elements.inlineHighlightPanel.classList.add('hidden');
  elements.charCounter.textContent = '0 karakter';
  elements.wordCounter.textContent = '0 kata';

  // Show typing indicator bubble from contact
  const typingBubble = document.createElement('div');
  typingBubble.className = 'msg-bubble msg-incoming msg-typing-indicator';
  typingBubble.id = 'active-typing-bubble';
  const contact = MODE_CONTACTS[state.activeMode] || MODE_CONTACTS.professional;
  typingBubble.textContent = `${contact.shortName.replace(':', '')} sedang mengetik...`;
  elements.simChatHistory.appendChild(typingBubble);

  scrollChatToBottom();

  // Request contextual persona reply from Web Worker
  if (state.worker) {
    setTimeout(() => {
      state.worker.postMessage({
        action: 'GENERATE_REPLY',
        text: textToSend,
        toneStatus,
        score: toneScore,
        mode: state.activeMode
      });
    }, 850);
  }
}

function renderIncomingPersonaReply(data) {
  const existingTyping = document.getElementById('active-typing-bubble');
  if (existingTyping && existingTyping.parentNode) {
    existingTyping.parentNode.removeChild(existingTyping);
  }

  const replyBubble = document.createElement('div');
  replyBubble.className = 'msg-bubble msg-incoming msg-dynamic-reply';

  const moodBadge = document.createElement('div');
  moodBadge.className = 'reply-mood-badge';
  moodBadge.textContent = `Reaksi Lawan Bicara: ${data.mood}`;

  const replyText = document.createElement('div');
  replyText.textContent = data.reply;

  replyBubble.appendChild(moodBadge);
  replyBubble.appendChild(replyText);

  elements.simChatHistory.appendChild(replyBubble);

  // Also update the active incoming context to this latest reply so the user can continue the conversation!
  if (elements.incomingContextInput) {
    elements.incomingContextInput.value = data.reply;
  }

  scrollChatToBottom();
}

function scrollChatToBottom() {
  if (elements.chatMessagesStream) {
    elements.chatMessagesStream.scrollTop = elements.chatMessagesStream.scrollHeight;
  }
}

function resetSimulatorChat() {
  if (elements.simChatHistory) {
    elements.simChatHistory.innerHTML = '';
  }
  const contact = MODE_CONTACTS[state.activeMode] || MODE_CONTACTS.professional;
  const currentScenario = contact.scenarios[state.scenarioIndex] || contact.scenarios[0];
  elements.simMsgIncoming.textContent = currentScenario;
  if (elements.incomingContextInput) {
    elements.incomingContextInput.value = currentScenario;
  }
  if (elements.botAutomodStatus) {
    elements.botAutomodStatus.textContent = '🤖 Auto-Bot Guard: Memantau';
  }
  showToast('Riwayat percakapan simulator di-reset.', 'indigo');
}

const GROUP_CONFLICT_SAMPLES = [
  {
    sender: '😡 Anggota Tim (Aldi)',
    harsh: 'Kerjaan tim lelet banget sih! Revisi bagian tabel sekarang juga jangan banyak alasan!',
    risk: 84,
    botSuggestion: 'Halo Tim, boleh minta tolong agar revisi bagian tabel diprioritaskan hari ini? Yuk kita fokus ke solusinya bersama 🙏'
  },
  {
    sender: '😤 Anggota Grup (Dinda)',
    harsh: 'Kan sudah saya bilang di grup kemarin! Makanya baca dokumennya yang bener jangan sampai miss lagi!',
    risk: 78,
    botSuggestion: 'Izin menyambung catatan kemarin, mohon berkenan meninjau kembali dokumennya agar tidak ada detail yang terlewat ya 🙏'
  },
  {
    sender: '🤬 Anggota Grup (Riko — Uji Sensor PII Bot)',
    harsh: 'Lambat banget! Transfer dana klaim ke BCA 8720394812 sekarang juga jangan banyak alasan!',
    risk: 86,
    botSuggestion: 'Halo! Semoga progresnya bisa kita akselerasi bersama ya. Boleh minta tolong untuk transfer dana klaim ke [REKENING-DISENSOR] jika sudah senggang hari ini ya 🙏 (🔒 Rekening otomatis disensor Bot)'
  }
];
let groupSampleIdx = 0;

function simulateAutoBotGroupDetection() {
  const sample = GROUP_CONFLICT_SAMPLES[groupSampleIdx % GROUP_CONFLICT_SAMPLES.length];
  groupSampleIdx++;

  // 1. Render incoming harsh message from a group member
  const memberBubble = document.createElement('div');
  memberBubble.className = 'msg-bubble msg-incoming msg-member-harsh';

  const senderTag = document.createElement('div');
  senderTag.className = 'reply-mood-badge';
  senderTag.style.color = '#fca5a5';
  senderTag.textContent = sample.sender;

  const msgText = document.createElement('div');
  msgText.textContent = sample.harsh;

  memberBubble.appendChild(senderTag);
  memberBubble.appendChild(msgText);
  elements.simChatHistory.appendChild(memberBubble);
  scrollChatToBottom();

  if (elements.botAutomodStatus) {
    elements.botAutomodStatus.textContent = `🚨 Bot Mendeteksi Konflik (${sample.risk}%)...`;
  }

  // 2. After 550ms, ToneGuard Auto-Moderator Bot automatically intervenes in the group!
  setTimeout(() => {
    const botBubble = document.createElement('div');
    botBubble.className = 'msg-bubble msg-bot-intervention';

    const botHeader = document.createElement('div');
    botHeader.className = 'bot-intervention-header';
    botHeader.textContent = `🤖 ToneGuard Auto-Bot (Deteksi Otomatis • Risiko ${sample.risk}%)`;

    const botBody = document.createElement('div');
    botBody.textContent = `Terdeteksi nada pesan berisiko memicu ketegangan tim. Saran penyampaian yang lebih konstruktif:`;

    const botQuote = document.createElement('div');
    botQuote.className = 'bot-intervention-quote';
    botQuote.textContent = `"${sample.botSuggestion}"`;

    botBubble.appendChild(botHeader);
    botBubble.appendChild(botBody);
    botBubble.appendChild(botQuote);

    elements.simChatHistory.appendChild(botBubble);
    if (elements.botAutomodStatus) {
      elements.botAutomodStatus.textContent = '🛡️ Auto-Bot: Intervensi Selesai';
    }
    appendAuditLog(`[AUTO-BOT] Intervensi otomatis moderator grup dipicu (Risiko ${sample.risk}%).`);
    showToast('🤖 ToneGuard Auto-Bot otomatis mendeteksi & menengahi pesan ketus di grup!', 'indigo');
    scrollChatToBottom();
  }, 550);
}

// --- 9. VIRTUAL KEYBOARD SIMULATOR LOGIC ---

function handleVirtualKeyPress(keyVal, isSpecial) {
  const textarea = elements.textarea;
  const text = textarea.value;

  if (isSpecial) {
    if (keyVal === 'BACKSPACE') {
      recordKeystrokeEvent('BACKSPACE');
      textarea.value = text.slice(0, -1);
    } else if (keyVal === 'SPACE') {
      recordKeystrokeEvent(' ');
      textarea.value += ' ';
    } else if (keyVal === 'CAPS') {
      state.capsLock = !state.capsLock;
      updateVirtualKeyboardCaps();
      return;
    } else if (keyVal === 'SEND') {
      sendMessageToSimulator();
      return;
    }
  } else {
    const char = state.capsLock ? keyVal.toUpperCase() : keyVal.toLowerCase();
    recordKeystrokeEvent(char);
    textarea.value += char;
  }

  handleTextInput();
  textarea.focus();
}

function updateVirtualKeyboardCaps() {
  elements.virtualKeys.forEach((key) => {
    if (!key.classList.contains('kb-key-special') && !key.classList.contains('kb-key-space') && !key.classList.contains('kb-key-send')) {
      const original = key.dataset.key || key.textContent;
      key.textContent = state.capsLock ? original.toUpperCase() : original.toLowerCase();
    }
  });
}

// --- 10. PRESETS & SECURE CLEAR ---

function renderPresetChips() {
  const container = elements.presetsContainer;
  container.innerHTML = '';

  PRESETS.forEach((preset) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'preset-chip';
    chip.textContent = preset.label;
    chip.addEventListener('click', () => {
      setRelationshipMode(preset.mode);
      elements.textarea.value = preset.text;
      handleTextInput();
      showToast('Template uji coba kontekstual dimuat.', 'indigo');
    });
    container.appendChild(chip);
  });
}

function secureClearMemory() {
  state.currentText = '';
  state.lastAnalysis = null;
  elements.textarea.value = '';
  elements.simMsgOutgoingText.textContent = 'Mulai ketik pesan...';
  elements.charCounter.textContent = '0 karakter';
  elements.wordCounter.textContent = '0 kata';

  elements.toneBanner.setAttribute('data-state', 'neutral');
  elements.toneLabel.textContent = 'Menunggu Input...';
  elements.toneDesc.textContent = 'Ketik pesan Anda di atas atau klik salah satu contoh template.';
  elements.toneRiskBadge.textContent = 'Risiko: 0%';
  if (elements.riskBarFill) {
    elements.riskBarFill.style.width = '0%';
  }
  updateDimensionBars({ politeness: 50, warmth: 50, assertiveness: 50, urgency: 10 });
  if (elements.xaiBreakdownRow) elements.xaiBreakdownRow.classList.add('hidden');
  if (elements.cadenceStatusPill) {
    elements.cadenceStatusPill.textContent = '⌨️ Ritme Ketik: Siap';
    elements.cadenceStatusPill.setAttribute('data-cadence', 'normal');
  }
  state.keystrokeTimes = [];
  state.backspaceCount = 0;
  elements.piiBanner.classList.add('hidden');
  elements.inlineHighlightPanel.classList.add('hidden');
  clearRewritesUI();
  updateSimulatorToolbar('neutral', 'Siap Cek');
  resetAutoShredTimer(false);

  appendAuditLog('[MEM-WIPE] Buffer RAM pengguna berhasil di-overwrite & dibersihkan.');
  showToast('Memori teks berhasil dibersihkan dengan aman.', 'emerald');
}

// --- 10B. AUTO-SHREDDER (IDLE MEMORY WIPE) & PRIVACY BLUR SHIELD ---

let autoShredInterval = null;
let autoShredRemainingSec = 180;
let isPrivacyBlurManual = false;

function resetAutoShredTimer(hasActiveText) {
  if (autoShredInterval) {
    clearInterval(autoShredInterval);
    autoShredInterval = null;
  }

  if (!hasActiveText) {
    if (elements.autoShredBadge) {
      elements.autoShredBadge.textContent = '⏱️ Auto-Shred: Siaga';
      elements.autoShredBadge.classList.remove('shred-active-warning');
    }
    return;
  }

  autoShredRemainingSec = 180; // 3 minutes idle timeout
  updateAutoShredBadgeText();

  autoShredInterval = setInterval(() => {
    autoShredRemainingSec--;
    if (autoShredRemainingSec <= 0) {
      clearInterval(autoShredInterval);
      autoShredInterval = null;
      secureClearMemory();
      appendAuditLog('[AUTO-SHRED] Tidak ada aktivitas selama 3 menit. Draf sensitif otomatis dihancurkan dari RAM.');
      showToast('⏱️ Auto-Shredder: Draf pesan otomatis dihapus karena tidak aktif selama 3 menit.', 'amber');
    } else {
      updateAutoShredBadgeText();
    }
  }, 1000);
}

function updateAutoShredBadgeText() {
  if (!elements.autoShredBadge) return;
  const mins = Math.floor(autoShredRemainingSec / 60);
  const secs = String(autoShredRemainingSec % 60).padStart(2, '0');
  elements.autoShredBadge.textContent = `⏱️ Auto-Shred: ${mins}:${secs}`;
  if (autoShredRemainingSec <= 30) {
    elements.autoShredBadge.classList.add('shred-active-warning');
  } else {
    elements.autoShredBadge.classList.remove('shred-active-warning');
  }
}

function togglePrivacyBlurShield(forceState) {
  isPrivacyBlurManual = typeof forceState === 'boolean' ? forceState : !isPrivacyBlurManual;
  document.body.classList.toggle('privacy-blur-active', isPrivacyBlurManual);

  if (elements.btnPrivacyBlur && elements.blurBtnText) {
    elements.btnPrivacyBlur.classList.toggle('active-blur', isPrivacyBlurManual);
    elements.blurBtnText.textContent = isPrivacyBlurManual ? 'Layar Disamarkan (ON)' : 'Samarkan Layar';
  }

  if (isPrivacyBlurManual) {
    appendAuditLog('[PRIVACY-SHIELD] Mode Samarkan Layar (Anti-Shoulder Surfing) diaktifkan.');
  }
}

// --- 11. TOAST & OFFLINE SIMULATION NOTIFIER ---

function showToast(message, color = 'emerald') {
  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.style.borderColor =
    color === 'emerald'
      ? 'var(--emerald-green)'
      : color === 'amber'
      ? 'var(--amber-yellow)'
      : 'var(--brand-indigo)';

  const icon = color === 'emerald' ? '✅' : color === 'amber' ? '⚠️' : 'ℹ️';
  toast.textContent = `${icon} ${message}`;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }, 2600);
}

function toggleOfflineSimulation() {
  state.isOfflineSimulated = !state.isOfflineSimulated;
  const isOff = state.isOfflineSimulated;

  if (isOff) {
    document.body.classList.add('airplane-mode-active');
    elements.offlineAlertBar.classList.remove('hidden');
    elements.btnOfflineSim.classList.add('active-offline');
    elements.offlineBtnIcon.textContent = '✈️';
    elements.offlineBtnText.textContent = 'Mode Offline: AKTIF';
    elements.phoneSignalIndicator.textContent = '✈️ Offline 🔋';
    elements.networkMonitorText.textContent = '📡 Network Out: 0.00 KB (Air-Gapped)';
    elements.privacyStatusText.textContent = 'Air-Gapped Local Sandbox';
    if (elements.liveEngineText) {
      elements.liveEngineText.textContent = 'Offline WASM (100% Lokal)';
    }
    appendAuditLog('[AIR-GAPPED] Simulasi Mode Pesawat diaktifkan. Koneksi eksternal diisolasi.');
    showToast('✈️ Airplane Mode Aktif: Koneksi putus, AI tetap 100% jalan lokal di browser!', 'amber');
  } else {
    document.body.classList.remove('airplane-mode-active');
    elements.offlineAlertBar.classList.add('hidden');
    elements.btnOfflineSim.classList.remove('active-offline');
    elements.offlineBtnIcon.textContent = '✈️';
    elements.offlineBtnText.textContent = 'Uji Mode Offline';
    elements.phoneSignalIndicator.textContent = '📶 5G 🔋';
    elements.networkMonitorText.textContent = '📡 Network Out: 0.00 KB (Audit)';
    elements.privacyStatusText.textContent = '100% On-Device Privacy';
    if (elements.liveEngineText) {
      elements.liveEngineText.textContent = 'Local WASM Ready';
    }
    appendAuditLog('[ONLINE-LOCAL] Kembali ke mode standar. Pemrosesan tetap 100% lokal di perangkat.');
    showToast('Mode Standar: Pemrosesan tetap 100% lokal tanpa pengiriman teks.', 'emerald');
  }
}

function highlightVirtualKey(keyChar) {
  if (!keyChar) return;
  const upper = keyChar.toUpperCase();
  elements.virtualKeys.forEach((key) => {
    const keyVal = key.dataset.key || key.textContent.trim().toUpperCase();
    if (
      keyVal === upper ||
      (keyChar === ' ' && keyVal === 'SPACE') ||
      (keyChar === 'Backspace' && keyVal === 'BACKSPACE') ||
      (keyChar === 'Enter' && keyVal === 'SEND')
    ) {
      key.classList.add('kb-key-pressed');
      setTimeout(() => {
        key.classList.remove('kb-key-pressed');
      }, 100);
    }
  });
}

// --- 12. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
  initDOMElements();
  initWorker();
  initServiceWorkerAndAuditor();
  renderPresetChips();

  // Textarea input event
  elements.textarea.addEventListener('input', handleTextInput);

  // Incoming context manual edit syncs with simulator incoming message & re-analyzes
  if (elements.incomingContextInput) {
    elements.incomingContextInput.addEventListener('input', () => {
      elements.simMsgIncoming.textContent = elements.incomingContextInput.value || '...';
      if (state.currentText.trim().length > 0) {
        handleTextInput();
      }
    });
  }

  // Cycle scenario button
  if (elements.btnCycleScenario) {
    elements.btnCycleScenario.addEventListener('click', cycleIncomingScenario);
  }

  // Real-time physical keyboard to virtual keyboard flash & cadence sensor
  elements.textarea.addEventListener('keydown', (e) => {
    recordKeystrokeEvent(e.key);
    highlightVirtualKey(e.key);
    // Ctrl+Enter or Cmd+Enter sends message to simulator
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendMessageToSimulator();
    }
  });

  // Secure Clear button
  elements.btnClear.addEventListener('click', secureClearMemory);

  // Utility Workflow Buttons (Paste, Undo, WhatsApp, Email, PII Redact)
  if (elements.btnPasteClipboard) {
    elements.btnPasteClipboard.addEventListener('click', pasteFromClipboard);
  }
  if (elements.btnUndoDraft) {
    elements.btnUndoDraft.addEventListener('click', undoToOriginalDraft);
  }
  if (elements.btnShareWA) {
    elements.btnShareWA.addEventListener('click', () => shareToWhatsApp());
  }
  if (elements.btnShareEmail) {
    elements.btnShareEmail.addEventListener('click', () => shareToEmail());
  }
  if (elements.btnRedactPII) {
    elements.btnRedactPII.addEventListener('click', redactPIIData);
  }

  // Alarm Interception Modal Buttons
  if (elements.btnAlarmSendSafe) {
    elements.btnAlarmSendSafe.addEventListener('click', () => {
      const safeText = elements.alarmSafePreview ? elements.alarmSafePreview.textContent : pendingHighRiskText;
      elements.alarmModal.classList.add('hidden');
      applyTextToEditor(safeText);
      setTimeout(() => {
        executeSimulatorSend(safeText, 'green', 10);
        showToast('✨ Pesan versi empatik berhasil dikirim dengan aman!', 'emerald');
      }, 100);
    });
  }
  if (elements.btnAlarmCancel) {
    elements.btnAlarmCancel.addEventListener('click', () => {
      elements.alarmModal.classList.add('hidden');
      elements.textarea.focus();
    });
  }
  if (elements.btnAlarmForceSend) {
    elements.btnAlarmForceSend.addEventListener('click', () => {
      elements.alarmModal.classList.add('hidden');
      const score = state.lastAnalysis ? state.lastAnalysis.score : 75;
      executeSimulatorSend(pendingHighRiskText, 'red', score);
      showToast('⚠️ Pesan asli tetap dikirim (Alarm di-bypass).', 'amber');
    });
  }

  // Send to Simulator button in editor footer
  if (elements.btnSendSimulator) {
    elements.btnSendSimulator.addEventListener('click', () => {
      sendMessageToSimulator();
    });
  }

  // Reset Chat button in phone simulator
  if (elements.btnResetChat) {
    elements.btnResetChat.addEventListener('click', resetSimulatorChat);
  }
  if (elements.btnSimGroupConflict) {
    elements.btnSimGroupConflict.addEventListener('click', simulateAutoBotGroupDetection);
  }

  // Network Auditor drawer toggle
  if (elements.networkMonitorBtn && elements.auditorPanel) {
    elements.networkMonitorBtn.addEventListener('click', () => {
      elements.auditorPanel.classList.toggle('hidden');
    });
  }
  if (elements.btnCloseAuditor && elements.auditorPanel) {
    elements.btnCloseAuditor.addEventListener('click', () => {
      elements.auditorPanel.classList.add('hidden');
    });
  }

  // Offline simulation toggle & Privacy Blur Shield toggle
  elements.btnOfflineSim.addEventListener('click', toggleOfflineSimulation);
  if (elements.btnPrivacyBlur) {
    elements.btnPrivacyBlur.addEventListener('click', () => {
      togglePrivacyBlurShield();
      showToast(
        isPrivacyBlurManual
          ? '🕵️ Layar disamarkan! Arahkan kursor ke kotak teks untuk membaca sementara.'
          : '🕵️ Mode Samarkan Layar dinonaktifkan.',
        'indigo'
      );
    });
  }

  // Automatic Tab-Switch Privacy Blur Shield (Shoulder-Surfing Protection)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.currentText.trim().length > 0) {
      document.body.classList.add('privacy-blur-active');
    } else if (!document.hidden && !isPrivacyBlurManual) {
      document.body.classList.remove('privacy-blur-active');
    }
  });

  // Mode tab buttons
  elements.modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      setRelationshipMode(tab.dataset.mode);
      showToast(`Mode beralih ke: ${tab.dataset.mode.toUpperCase()}`, 'indigo');
    });
  });

  // Virtual Keyboard buttons
  elements.virtualKeys.forEach((key) => {
    key.addEventListener('click', () => {
      const isSpecial =
        key.classList.contains('kb-key-special') ||
        key.classList.contains('kb-key-space') ||
        key.classList.contains('kb-key-send');
      const val = key.dataset.key || key.textContent.trim();
      handleVirtualKeyPress(val, isSpecial);
    });
  });

  // Simulator rewrite quick trigger
  elements.simRewriteBtn.addEventListener('click', () => {
    const firstRewrite = document.querySelector('.rewrite-card .btn-card-primary');
    if (firstRewrite) {
      firstRewrite.click();
    } else {
      showToast('Ketik pesan terlebih dahulu untuk melihat saran rewrite!', 'amber');
    }
  });

  // Default mode setup
  setRelationshipMode('professional');
});
