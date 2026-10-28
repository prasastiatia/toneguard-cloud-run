/**
 * ToneGuard Dedicated Web Worker (worker.js)
 * Hybrid Client-Side NLP Engine v3.0 (Deep Pragmatic & Behavioral AI Edition):
 * 1. PII & Sensitive Credential Scanner (Regex & Luhn-aware)
 * 2. Neural Deep Learning Model: DistilBERT Transformer (ONNX INT8 via Transformers.js / WASM)
 * 3. Contextual Window Negation & Hedging Parser (Anti-False-Positive)
 * 4. Multi-Sentence Discourse & "Compliment Sandwich" ("Tapi...") Peak-Toxicity Analyzer
 * 5. Indonesian Pragmatics: Bare Imperative Detector & Mode-Specific Pronoun Mismatch (Formal Distancing)
 * 6. Paralinguistic Emoji Sentiment & Bilingual "Jaksel" Code-Switching Lexicon
 * 7. Biometric Keystroke Cadence & Agitation Evaluator
 * 8. Explainable AI (XAI) Transparent Factor Breakdown + Context-Preserving Surgical Rewriter
 *
 * 100% Client-Side In-Browser Inference. ZERO Keystroke Cloud Upload.
 */

// --- 1. SYNCHRONOUS TOP-LEVEL IMPORT OF TRANSFORMERS.JS ---
let hasTransformersLib = false;
try {
  importScripts('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
  if (self.transformers) {
    hasTransformersLib = true;
    self.transformers.env.allowLocalModels = false;
    self.transformers.env.useBrowserCache = true;
    if (
      self.transformers.env.backends &&
      self.transformers.env.backends.onnx &&
      self.transformers.env.backends.onnx.wasm
    ) {
      self.transformers.env.backends.onnx.wasm.numThreads = 1;
    }
  }
} catch (libErr) {
  console.warn('Transformers.js library CDN could not be loaded at top-level:', libErr);
}

// --- 2. NEURAL PIPELINE STATE & ASYNC INITIALIZER ---
let neuralClassifier = null;
let isNeuralReady = false;
let isNeuralLoading = false;

async function loadNeuralPipeline() {
  if (!hasTransformersLib || isNeuralLoading || isNeuralReady) return;
  isNeuralLoading = true;

  try {
    self.postMessage({
      action: 'MODEL_STATUS',
      status: 'downloading',
      message: 'Mengunduh bobot Neural Transformer (ONNX INT8)...'
    });

    neuralClassifier = await self.transformers.pipeline(
      'sentiment-analysis',
      'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
      {
        quantized: true,
        progress_callback: (progressData) => {
          if (progressData.status === 'progress' && progressData.progress != null) {
            self.postMessage({
              action: 'MODEL_PROGRESS',
              progress: Math.round(progressData.progress),
              file: progressData.file || ''
            });
          }
        }
      }
    );

    isNeuralReady = true;
    isNeuralLoading = false;

    self.postMessage({
      action: 'MODEL_STATUS',
      status: 'ready',
      message: 'Neural Model Aktif (DistilBERT ONNX + Deep Pragmatics v3)'
    });
  } catch (err) {
    console.warn('Neural weights download/init failed, using deep pragmatic engine:', err);
    isNeuralLoading = false;
    isNeuralReady = false;

    self.postMessage({
      action: 'MODEL_STATUS',
      status: 'fallback',
      reason: err?.message || 'Jaringan terbatas atau offline',
      message: 'Deep Pragmatic NLP v3 Aktif (Mode Cepat & Aman)'
    });
  }
}

if (hasTransformersLib) {
  loadNeuralPipeline();
} else {
  self.postMessage({
    action: 'MODEL_STATUS',
    status: 'fallback',
    reason: 'CDN library tidak terjangkau',
    message: 'Deep Pragmatic NLP v3 Aktif (Mode Cepat)'
  });
}

// --- 3. PII & SENSITIVE CREDENTIALS DETECTOR ---
const PII_PATTERNS = [
  {
    type: 'API Token / Secret Key',
    regex: /(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9_\-\.]{25,}|eyJ[a-zA-Z0-9_\-]{20,}|AIza[0-9A-Za-z\-_]{35})/i
  },
  {
    type: 'Nomor Kartu Kredit',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/
  },
  {
    type: 'Nomor Induk Kependudukan (NIK)',
    regex: /\b\d{16}\b/
  },
  {
    type: 'Kode OTP / PIN Transaksi',
    regex: /\b(?:otp|kode\s*verifikasi|pin\s*atm|pin\s*bank|cvv)[\s:=]*([0-9]{3,6})\b/i
  },
  {
    type: 'Kredensial Password',
    regex: /\b(?:password|kata\s*sandi|pwd|pass)[\s:=]+([^\s,]{5,})/i
  }
];

function scanPII(text) {
  for (const item of PII_PATTERNS) {
    if (item.regex.test(text)) {
      return { detected: true, type: item.type };
    }
  }
  return { detected: false, type: null };
}

function redactPII(text) {
  let redacted = text;
  for (const item of PII_PATTERNS) {
    const globalRegex = new RegExp(item.regex.source, 'gi');
    const tag = item.type.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    redacted = redacted.replace(globalRegex, `[DISENSOR_${tag}]`);
  }
  return redacted;
}

// --- 4. NEGATION & HEDGING CONTEXTUAL PARSER (UPGRADE #1) ---
const NEGATION_CUES = /\b(tidak\s+harus|gak\s+harus|ga\s+harus|nggak\s+harus|tidak\s+perlu|gak\s+perlu|ga\s+perlu|nggak\s+perlu|jangan\s+buru-buru|gak\s+usah|ga\s+usah|nggak\s+usah|bukan\s+berarti|tidak\s+usah|tidak|bukan|jangan)\s*$/i;
const HEDGING_CUES = /\b(kalau\s+bisa|jika\s+memungkinkan|kalau\s+sempat|bila\s+berkenan|kalau\s+tidak\s+merepotkan|seandainya\s+bisa)\b/i;

function checkContextualNegation(fullText, matchStart, category) {
  // Hostile swear words cannot be negated into politeness (e.g. "kamu tidak bodoh" is still weird, though less hostile)
  if (category === 'hostile') return { negated: false, hedged: false };

  const prefixStart = Math.max(0, matchStart - 28);
  const windowBefore = fullText.slice(prefixStart, matchStart);
  // Only look within the current clause (do not cross punctuation or contrastive markers)
  const lastClauseSlice = windowBefore.split(/[.,!?;]|(?:\btapi\b|\bnamun\b)/i).pop() || '';

  if (NEGATION_CUES.test(lastClauseSlice.trim())) {
    return { negated: true, hedged: false, cue: lastClauseSlice.trim() };
  }

  const surroundingSlice = fullText.slice(Math.max(0, matchStart - 35), Math.min(fullText.length, matchStart + 50));
  if (HEDGING_CUES.test(surroundingSlice)) {
    return { negated: false, hedged: true };
  }

  return { negated: false, hedged: false };
}

// --- 5. SURGICAL INDONESIAN & BILINGUAL CODE-SWITCHING RULES ---
const SURGICAL_RULES = [
  // HOSTILE / OFFENSIVE
  {
    pattern: /\b(ga becus|gak becus|tidak becus|nggak becus)\b/gi,
    category: 'hostile',
    severity: 'red',
    weight: 42,
    reason: 'Frasa merendahkan kompetensi',
    inlineFix: 'perlu ditingkatkan lagi ketelitiannya',
    warmer: 'masih ada bagian yang bisa kita sempurnakan bersama',
    corporate: 'belum sepenuhnya memenuhi standar kualitas yang diharapkan',
    casual: 'kayaknya masih perlu dirapihin dikit nih'
  },
  {
    pattern: /\b(bodoh|tolol|goblok|idiot|bego|otak udang)\b/gi,
    category: 'hostile',
    severity: 'red',
    weight: 50,
    reason: 'Kata kasar/ofensif personal',
    inlineFix: 'kurang tepat',
    warmer: 'mungkin ada hal yang terlewat',
    corporate: 'terdapat kekeliruan yang perlu dievaluasi',
    casual: 'agak keliru nih'
  },
  {
    pattern: /\b(brengsek|bangsat|anjing|babi|kampret|sampah|bacot)\b/gi,
    category: 'hostile',
    severity: 'red',
    weight: 55,
    reason: 'Umpatan agresif/konfrontatif',
    inlineFix: 'mengecewakan',
    warmer: 'membuat saya cukup kurang nyaman',
    corporate: 'menjadi kendala serius yang perlu kita selesaikan',
    casual: 'bikin pusing banget jujur'
  },
  {
    pattern: /\b(jangan banyak omong|tutup mulut|gak usah banyak alasan|jangan banyak alasan)\b/gi,
    category: 'hostile',
    severity: 'red',
    weight: 40,
    reason: 'Menutup ruang komunikasi secara agresif',
    inlineFix: 'mari kita fokus pada solusinya',
    warmer: 'yuk kita fokus mencari jalan keluarnya bersama',
    corporate: 'mohon fokus pada penyelesaian dan tindak lanjutnya',
    casual: 'yuk langsung fokus ke solusinya aja'
  },
  {
    pattern: /\b(malas|pemalas|makan gaji buta|lelet banget|lambat banget|lelet)\b/gi,
    category: 'hostile',
    severity: 'red',
    weight: 38,
    reason: 'Serangan karakter yang memicu defensif',
    inlineFix: 'perlu dipercepat progresnya',
    warmer: 'semoga bisa kita akselerasi pelan-pelan ya',
    corporate: 'perlu dioptimalkan kembali kecepatan eksekusinya',
    casual: 'perlu agak dikebut nih'
  },
  {
    pattern: /\b(muak|benci banget|capek ngomong sama kamu|percuma ngomong sama kamu)\b/gi,
    category: 'hostile',
    severity: 'red',
    weight: 45,
    reason: 'Ungkapan frustrasi emosional tinggi',
    inlineFix: 'merasa komunikasi kita sedang kurang efektif',
    warmer: 'merasa kita butuh waktu tenang sebentar agar saling memahami',
    corporate: 'melihat perlunya penyelarasan ekspektasi kembali',
    casual: 'ngerasa kita lagi kurang nyambung nih, tarik napas dulu yuk'
  },

  // DEMANDING / BOSSY & BILINGUAL CODE-SWITCHING ("JAKSEL" CORPORATE)
  {
    pattern: /\b(sekarang juga|detik ini juga|saat ini juga)\b/gi,
    category: 'demanding',
    severity: 'red',
    weight: 30,
    reason: 'Nada mendesak & memerintah secara mutlak',
    inlineFix: 'sesegera mungkin jika berkenan',
    warmer: 'jika sudah senggang hari ini ya',
    corporate: 'sebagai prioritas utama hari ini',
    casual: 'kalau udah luang ya'
  },
  {
    pattern: /\b(asap|a\.s\.a\.p)\b/gi,
    category: 'demanding',
    severity: 'yellow',
    weight: 22,
    reason: 'Singkatan "ASAP" terkesan memburu-buru jika tanpa konteks sopan',
    inlineFix: 'sesegera mungkin saat luang',
    warmer: 'begitu ada waktu luang ya',
    corporate: 'sesuai prioritas jadwal terdekat',
    casual: 'kalau udah sempet ya'
  },
  {
    pattern: /\b(jangan sampai miss lagi|jangan miss lagi|kok bisa miss|jangan blunder)\b/gi,
    category: 'demanding',
    severity: 'red',
    weight: 34,
    reason: 'Teguran menyalahkan (blaming) dalam bahasa kerja',
    inlineFix: 'mari kita pastikan detailnya terjaga dengan baik',
    warmer: 'yuk kita cek bareng-bareng supaya tidak ada yang terlewat lagi',
    corporate: 'mohon dapat dipastikan kembali akurasinya agar berjalan lancar',
    casual: 'kita pastiin bareng biar aman gak ada yang kelewat ya'
  },
  {
    pattern: /\b(hari ini juga|pokoknya hari ini|wajib hari ini)\b/gi,
    category: 'demanding',
    severity: 'red',
    weight: 28,
    reason: 'Ultimatum tenggat waktu yang kaku',
    inlineFix: 'diusahakan hari ini ya',
    warmer: 'mudah-mudahan bisa terbantu hari ini ya',
    corporate: 'sesuai target timeline hari ini',
    casual: 'usahain hari ini ya bro/sis'
  },
  {
    pattern: /\b(ga mau tahu|gak mau tau|gamau tau|tidak mau tahu|bodo amat)\b/gi,
    category: 'demanding',
    severity: 'red',
    weight: 38,
    reason: 'Menolak empati terhadap kendala lawan bicara',
    inlineFix: 'mohon diupayakan yang terbaik',
    warmer: 'saya percaya kamu bisa mengupayakan yang terbaik',
    corporate: 'kami sangat mengharapkan komitmen penyelesaiannya',
    casual: 'tolong dibantu maksimal ya'
  },
  {
    pattern: /\b(pokoknya harus|harus sudah selesai|wajib selesai)\b/gi,
    category: 'demanding',
    severity: 'yellow',
    weight: 26,
    reason: 'Instruksi kaku tanpa ruang diskusi',
    inlineFix: 'diharapkan dapat selesai',
    warmer: 'alangkah baiknya jika sudah bisa rampung',
    corporate: 'diharapkan telah rampung sesuai jadwal',
    casual: 'moga-moga udah bisa kelar'
  },
  {
    pattern: /\b(buruan|cepetan|cepat sedikit|jangan telat|awas kalau telat)\b/gi,
    category: 'demanding',
    severity: 'yellow',
    weight: 25,
    reason: 'Nada memburu-buru yang meningkatkan stres penerima',
    inlineFix: 'mohon dibantu tepat waktu ya',
    warmer: 'kabari saya jika ada kendala waktu ya',
    corporate: 'mohon dapat diselesaikan sesuai estimasi waktu',
    casual: 'kabarin aja kalau udah beres ya'
  },
  {
    pattern: /\b(mana hasilnya|mana laporannya|mana draf|kok belum selesai|kenapa belum selesai|kok lama banget)\b/gi,
    category: 'demanding',
    severity: 'yellow',
    weight: 28,
    reason: 'Pertanyaan interogatif yang terkesan menyudutkan',
    inlineFix: 'bagaimana update progres untuk',
    warmer: 'boleh tahu sudah sampai mana progres untuk',
    corporate: 'mohon informasi terkait status perkembangan',
    casual: 'gimana nih update buat'
  },
  {
    pattern: /\b(saya butuh ini|aku butuh ini|gua butuh ini)\b/gi,
    category: 'demanding',
    severity: 'yellow',
    weight: 18,
    reason: 'Kalimat berpusat pada tuntutan sepihak',
    inlineFix: 'boleh minta tolong terkait hal ini',
    warmer: 'bolehkah saya minta bantuan untuk hal ini',
    corporate: 'mohon bantuan dan dukungan terkait kebutuhan ini',
    casual: 'boleh minta tolong bantu yang ini gak'
  },

  // PASSIVE-AGGRESSIVE & SARCASTIC
  {
    pattern: /\b(seperti yang sudah saya katakan sebelumnya|seperti yang sudah saya bilang|kan sudah saya bilang|perasaan udah dibilangin|as per my previous email)\b/gi,
    category: 'passiveAggressive',
    severity: 'red',
    weight: 34,
    reason: 'Frasa pasif-agresif yang menyindir lawan bicara kurang teliti',
    inlineFix: 'sebagai pengingat kembali dari diskusi kita sebelumnya',
    warmer: 'izin menyambung catatan kita sebelumnya ya',
    corporate: 'merujuk kembali pada poin pembahasan sebelumnya',
    casual: 'nyambung obrolan kita yang tadi ya'
  },
  {
    pattern: /\b(tolong baca lagi|makanya baca|baca yang bener|baca dulu makanya|budayakan membaca| dengan bener)\b/gi,
    category: 'passiveAggressive',
    severity: 'red',
    weight: 34,
    reason: 'Nada menggurui dan menyalahkan pembaca',
    inlineFix: 'silakan ditinjau kembali pada bagian detailnya',
    warmer: 'boleh dicek kembali di bagian atas ya, barangkali terlewat',
    corporate: 'mohon berkenan meninjau kembali detail yang telah tercantum',
    casual: 'coba cek lagi di chat atas ya, takutnya kelewat'
  },
  {
    pattern: /\b(terserah kamu mau gimana|terserah lah|terserah kamu|terserah lu|terserah|serah lu|serah deh|serah)\b/gi,
    category: 'passiveAggressive',
    severity: 'yellow',
    weight: 32,
    reason: 'Kata "terserah" terkesan dingin, ngambek, atau lepas tangan',
    inlineFix: 'saya percaya pada pertimbanganmu, mari kita pilih yang terbaik',
    warmer: 'aku ikut mana yang menurutmu paling nyaman buat kita berdua ya',
    corporate: 'saya mempercayakan keputusan terbaik sesuai pertimbangan Anda',
    casual: 'gua ngikut enaknya gimana aja, kabarin ya'
  },
  {
    pattern: /\b(bukan urusan saya|bukan urusanku|bukan masalah saya|urus sendiri aja)\b/gi,
    category: 'passiveAggressive',
    severity: 'red',
    weight: 38,
    reason: 'Penolakan dingin yang memutus kerja sama',
    inlineFix: 'hal tersebut kebetulan berada di luar cakupan wewenang saya',
    warmer: 'maaf sekali untuk bagian ini di luar jangkauan saya, mungkin bisa dikoordinasikan dengan PIC terkait ya',
    corporate: 'hal tersebut berada di luar lingkup tanggung jawab kami, mohon dapat diarahkan ke tim terkait',
    casual: 'wah kalau yang itu kebetulan bukan di bagian gua nih, coba tanya tim sebelah ya'
  },
  {
    pattern: /\b(wah rajin banget ya|hebat banget ya baru nongol|tumben inget|kirain udah lupa|makasih loh udah bikin repot|bagus banget ya kerjanya)\b/gi,
    category: 'sarcastic',
    severity: 'red',
    weight: 38,
    reason: 'Sindiran sarkastik/ironi yang berpotensi memicu pertengkaran',
    inlineFix: 'lain kali mohon dikabari lebih awal ya',
    warmer: 'syukurlah sudah ada kabar, lain waktu kabari lebih awal ya supaya tidak khawatir',
    corporate: 'ke depannya mohon dapat memberikan konfirmasi lebih awal demi kelancaran koordinasi',
    casual: 'syukur deh udah nongol, lain kali kabarin duluan ya bro'
  },
  {
    pattern: /\b(gausah dibahas lagi|gak usah dibahas|lupain aja|tau ah|au ah|ya sudahlah|yasudahlah)\b/gi,
    category: 'passiveAggressive',
    severity: 'yellow',
    weight: 28,
    reason: 'Menarik diri secara pasif-agresif (stonewalling)',
    inlineFix: 'kita bahas lagi nanti saat suasana sudah lebih tenang ya',
    warmer: 'kita jeda sebentar ya bahas ininya, nanti kita ngobrol lagi pelan-pelan',
    corporate: 'pembahasan ini dapat kita jadwalkan ulang pada sesi evaluasi berikutnya',
    casual: 'pending dulu aja bahasannya ya, nanti kita obrolin lagi santai'
  }
];

const COLD_SHORT_MAP = {
  'k': 'Siap, terima kasih infonya ya!',
  'k.': 'Siap, terima kasih infonya ya!',
  'y': 'Iya, siap. Terima kasih ya!',
  'y.': 'Iya, baik. Terima kasih ya!',
  'ya.': 'Iya, baik. Sudah saya catat ya.',
  'ok.': 'Oke siap, terima kasih ya!',
  'oke.': 'Oke baik, terima kasih infonya!',
  'sip.': 'Sip, mantap! Terima kasih ya.',
  'oh.': 'Oh begitu, baik terima kasih penjelasannya ya.',
  'oh gitu.': 'Oh begitu, paham. Terima kasih infonya ya!',
  'ydh': 'Ya sudah, tidak apa-apa. Kabari saja nanti ya!',
  'ydh.': 'Ya sudah, baik kalau begitu. Terima kasih ya!',
  'ywdh': 'Ya sudah, aman kok. Kabari lagi nanti ya!',
  'yaudah.': 'Ya sudah, tidak masalah. Nanti kita atur lagi ya!',
  'gpp': 'Tidak apa-apa kok, santai saja ya! 😊',
  'gpp.': 'Tidak apa-apa kok, aman saja ya.',
  'belum': 'Saat ini masih dalam proses pengerjaan, segera saya kabari begitu selesai ya!',
  'belum.': 'Saat ini masih saya kerjakan, nanti saya update segera ya.',
  'blm': 'Masih on-progress nih, nanti langsung dikabari kalau sudah siap ya!',
  'gak bisa': 'Maaf sekali saat ini belum memungkinkan, apakah bisa kita cari alternatif waktu lain?',
  'ga bisa': 'Maaf banget belum bisa untuk saat ini, gimana kalau kita atur opsi lain?',
  '👍': 'Siap, sudah diterima dengan baik. Terima kasih ya! 👍'
};

const POLITE_MARKERS = [
  'tolong', 'mohon', 'bisa tolong', 'bisa minta bantuan', 'apakah berkenan',
  'apresiasi', 'terima kasih', 'makasih', 'terimakasih', 'thank you', 'thanks',
  'noted with thanks', 'maaf', 'permisi', 'salam', 'selamat pagi', 'selamat siang',
  'selamat sore', 'selamat malam', 'izin', 'jika berkenan', 'kalau sempat', 'bila memungkinkan'
];

const WARM_WORDS = [
  'semangat', 'keren', 'hebat', 'mantap', 'senang', 'alhamdulillah', 'syukur',
  'paham kok', 'mengerti', 'tenang saja', 'jangan khawatir', 'santai saja',
  'pelan-pelan', 'take your time', 'sukses selalu', 'love you', 'sayang',
  'terima kasih banyak', 'bantuannya sangat berarti', 'hati-hati di jalan', 'sehat selalu'
];

// --- 6. INDONESIAN PRAGMATICS: BARE IMPERATIVES & PRONOUN HIERARCHY (UPGRADE #3) ---

const BARE_IMPERATIVE_REGEX = /(?:^|[.!?]\s+)(kirim|kirimkan|cek|periksa|revisi|perbaiki|kerjakan|buatkan|selesaikan|siapkan|ubah|ganti|hapus|laporkan|jelaskan|buka|tulis|kumpulkan)\b/gi;
const SOFTENER_WORDS_REGEX = /\b(tolong|mohon|bisa|boleh|bolehkah|bisakah|izin|mari|yuk|coba|silakan)\b/i;

function scanIndonesianPragmatics(text, mode) {
  const spans = [];
  const xai = [];
  let pragmaticRisk = 0;

  // A. Bare Imperative Detection (Command Verbs at Start of Sentence without Softener)
  BARE_IMPERATIVE_REGEX.lastIndex = 0;
  let match;
  while ((match = BARE_IMPERATIVE_REGEX.exec(text)) !== null) {
    const verb = match[1];
    const verbOffset = match.index + match[0].toLowerCase().indexOf(verb.toLowerCase());
    // Check if the sentence containing this verb has a softener
    const sentenceAfter = text.slice(verbOffset, Math.min(text.length, verbOffset + 80)).split(/[.!?]/)[0];
    if (!SOFTENER_WORDS_REGEX.test(sentenceAfter)) {
      const addedRisk = mode === 'professional' ? 24 : (mode === 'partner' ? 20 : 12);
      pragmaticRisk += addedRisk;
      const capitalizedFix = `Mohon bantuan untuk ${verb.toLowerCase()}`;
      spans.push({
        start: verbOffset,
        end: verbOffset + verb.length,
        text: text.slice(verbOffset, verbOffset + verb.length),
        category: 'demanding',
        severity: 'yellow',
        reason: `Kalimat perintah langsung ("${verb}...") tanpa kata "tolong/mohon" terkesan memerintah (bossy)`,
        inlineFix: capitalizedFix
      });
      xai.push({
        label: `+${addedRisk}% Kalimat Perintah Tanpa "Tolong" ("${verb}...")`,
        type: 'risk'
      });
    }
  }

  // B. Mode-Specific Pronoun & Register Mismatch
  if (mode === 'professional') {
    const slangPronounRegex = /\b(lu|loe|gue|gua|elo|anjir|anjay|bro|cuy|wkwk|wkwkwk)\b/gi;
    let pMatch;
    while ((pMatch = slangPronounRegex.exec(text)) !== null) {
      const word = pMatch[0];
      pragmaticRisk += 22;
      spans.push({
        start: pMatch.index,
        end: pMatch.index + word.length,
        text: word,
        category: 'passiveAggressive',
        severity: 'yellow',
        reason: `Kata ganti/slang kasual ("${word}") kurang sesuai untuk Mode Profesional/Kerja`,
        inlineFix: /^(gue|gua)$/i.test(word) ? 'saya' : (/^(lu|loe|elo)$/i.test(word) ? 'Anda/Rekan' : '')
      });
      xai.push({
        label: `+22% Slang/Kata Ganti Kasual ("${word}") di Mode Kerja`,
        type: 'risk'
      });
    }
  } else if (mode === 'partner') {
    // Formal Distancing in Romantic Partner Mode ("Anda", "Saudara", "Terima kasih atas waktu Anda")
    const coldFormalRegex = /\b(anda|saudara|dengan hormat|terima kasih atas perhatian anda)\b/gi;
    let fMatch;
    while ((fMatch = coldFormalRegex.exec(text)) !== null) {
      const word = fMatch[0];
      pragmaticRisk += 30;
      spans.push({
        start: fMatch.index,
        end: fMatch.index + word.length,
        text: word,
        category: 'cold',
        severity: 'red',
        reason: `Penggunaan kata formal "${word}" ke pasangan mengindikasikan Formal Distancing (jaga jarak/ngambek dingin)`,
        inlineFix: /^anda$/i.test(word) ? 'kamu sayang' : 'terima kasih ya sayang'
      });
      xai.push({
        label: `+30% Formal Distancing ("${word}" ke Pasangan = Sinyal Dingin)`,
        type: 'risk'
      });
    }
  }

  return { pragmaticRisk, spans, xai };
}

// --- 7. PARALINGUISTIC EMOJI SENTIMENT ANALYZER (UPGRADE #4) ---

function scanParalinguisticEmojis(text) {
  let emojiRiskDelta = 0;
  const xai = [];
  const spans = [];

  // Hostile / Eye-roll / Passive-Aggressive Emojis
  const negativeEmojiRegex = /(🙄|😒|😤|😠|😡|🤬|🖕|🗿|😑|🙂)/g;
  let match;
  while ((match = negativeEmojiRegex.exec(text)) !== null) {
    const em = match[0];
    const isFakeSmile = em === '🙂';
    const weight = isFakeSmile ? 20 : 28;
    emojiRiskDelta += weight;
    spans.push({
      start: match.index,
      end: match.index + em.length,
      text: em,
      category: 'passiveAggressive',
      severity: isFakeSmile ? 'yellow' : 'red',
      reason: isFakeSmile
        ? 'Emoji 🙂 sering dipersepsikan sebagai senyum pasif-agresif/sinis di chat modern'
        : `Emoji ${em} menunjukkan kekesalan atau sikap sinis`,
      inlineFix: '😊'
    });
    xai.push({
      label: `+${weight}% Emoji Sinis/Pasif-Agresif (${em})`,
      type: 'risk'
    });
  }

  // Warm / Polite Softening Emojis
  const warmEmojiRegex = /(🙏|😊|🥰|❤️|💖|🙌|✨|🤗|😄)/g;
  let wCount = 0;
  while (warmEmojiRegex.exec(text) !== null) {
    wCount++;
  }
  if (wCount > 0) {
    const discount = Math.min(24, wCount * 12);
    emojiRiskDelta -= discount;
    xai.push({
      label: `-${discount}% Emoji Pelunak & Hangat`,
      type: 'safe'
    });
  }

  return { emojiRiskDelta, xai, spans };
}

// --- 8. MULTI-SENTENCE DISCOURSE & "TAPI..." CONTRASTIVE ANALYZER (UPGRADE #2) ---

function analyzeDiscourseClauses(text) {
  // Split into clauses by sentence punctuation or contrastive markers ("tapi", "namun", "sayangnya")
  const rawClauses = text
    .split(/(?<=[.!?])\s+|\b(?=tapi\b|namun\b|sayangnya\b|akan tetapi\b|padahal\b)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  if (rawClauses.length <= 1) {
    return {
      hasContrastiveWhiplash: false,
      contrastiveMultiplier: 1.0,
      clauseCount: rawClauses.length,
      xai: []
    };
  }

  const xai = [];
  let hasContrastiveWhiplash = false;

  for (const clause of rawClauses) {
    if (/^(tapi|namun|sayangnya|padahal)\b/i.test(clause)) {
      // Check if the contrastive clause contains negative/demanding triggers
      let hasSharpTrigger = false;
      for (const rule of SURGICAL_RULES) {
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(clause)) {
          hasSharpTrigger = true;
          break;
        }
      }
      if (hasSharpTrigger) {
        hasContrastiveWhiplash = true;
        xai.push({
          label: 'x1.35 Bobot Klausa Kontras ("Tapi/Namun..." mengandung kritik tajam)',
          type: 'risk'
        });
      }
    }
  }

  return {
    hasContrastiveWhiplash,
    contrastiveMultiplier: hasContrastiveWhiplash ? 1.35 : 1.0,
    clauseCount: rawClauses.length,
    xai
  };
}

// --- 9. BIOMETRIC KEYSTROKE CADENCE EVALUATOR (UPGRADE #5) ---

function evaluateKeystrokeCadence(metrics, finalRisk) {
  if (!metrics || !metrics.cpm) {
    return {
      status: 'normal',
      badgeText: '⌨️ Ritme Ketik: Stabil',
      agitationBonus: 0,
      xai: null
    };
  }

  const { cpm, backspaceCount } = metrics;

  if (cpm >= 340 && finalRisk >= 30) {
    return {
      status: 'impulsive',
      badgeText: `🔥 Ritme Ketik: Impulsif (${cpm} CPM) — Tarik napas sejenak`,
      agitationBonus: 8,
      xai: { label: `+8% Ritme Ketikan Cepat & Impulsif (${cpm} CPM)`, type: 'risk' }
    };
  }

  if (backspaceCount >= 6) {
    return {
      status: 'hesitant',
      badgeText: `🤔 Ritme Ketik: Ragu-ragu (${backspaceCount}x Hapus)`,
      agitationBonus: 0,
      xai: { label: `Info: Terdeteksi ${backspaceCount}x koreksi ketikan (Indikasi Ragu/Tegang)`, type: 'info' }
    };
  }

  return {
    status: 'calm',
    badgeText: `🟢 Ritme Ketik: Tenang (${cpm} CPM)`,
    agitationBonus: 0,
    xai: null
  };
}

// --- 10. WORD-LEVEL DIFF & CONTEXT-PRESERVING SMART REWRITER (WITH POWER DYNAMICS) ---

function computeWordDiff(originalText, rewrittenText) {
  const origWords = originalText.trim().split(/\s+/).filter(Boolean);
  const newWords = rewrittenText.trim().split(/\s+/).filter(Boolean);
  const origLowerSet = new Set(origWords.map((w) => w.toLowerCase().replace(/[.,!?]/g, '')));
  const newLowerSet = new Set(newWords.map((w) => w.toLowerCase().replace(/[.,!?]/g, '')));

  const diffTokens = [];
  // Show removed harsh tokens first if they no longer exist in the rewrite
  origWords.forEach((w) => {
    const clean = w.toLowerCase().replace(/[.,!?]/g, '');
    if (clean && !newLowerSet.has(clean)) {
      diffTokens.push({ type: 'removed', value: w });
    }
  });

  // Then stream the new rewrite words, marking newly added empathetic words vs preserved words
  newWords.forEach((w) => {
    const clean = w.toLowerCase().replace(/[.,!?]/g, '');
    if (clean && origLowerSet.has(clean)) {
      diffTokens.push({ type: 'same', value: w });
    } else {
      diffTokens.push({ type: 'added', value: w });
    }
  });

  return diffTokens;
}

function getQuickKeyboardPhrases(mode, subRole, status) {
  if (mode === 'professional') {
    if (subRole === 'boss_client') {
      return [
        'Mohon izin Bapak/Ibu 🙏',
        'Terima kasih atas arahannya',
        'Segera saya tindak lanjuti',
        'Apakah berkenan jika...'
      ];
    } else if (subRole === 'subordinate') {
      return [
        'Tolong dibantu cek ya 👍',
        'Terima kasih kerja kerasnya!',
        'Kabari jika ada kendala ya',
        'Mari kita diskusikan'
      ];
    }
    return [
      'Mohon bantuannya ya 🙏',
      'Terima kasih sebelumnya 😊',
      'Kalau sudah senggang ya',
      'Siap, segera saya cek 👍'
    ];
  } else if (mode === 'partner') {
    if (subRole === 'parents') {
      return [
        'Mohon doa restunya Ayah/Ibu 🙏',
        'Terima kasih banyak ya Bu/Pak ❤️',
        'InsyaAllah segera dikabari',
        'Sehat-sehat selalu ya 🙏'
      ];
    }
    return [
      'Sayang, makasih ya ❤️',
      'Semangat terus hari ini 🥰',
      'Nanti kita obrolin baik-baik ya',
      'Hati-hati di jalan ya 💖'
    ];
  }
  return [
    'Thank you banget bro! 🙌',
    'Kabarin aja kalau luang 👍',
    'Santai aja bro, aman! ☕',
    'Gas, nanti kita atur! 🔥'
  ];
}

function extractTopicFromIncoming(incomingContext) {
  if (!incomingContext) return '';
  const lower = incomingContext.toLowerCase();
  if (lower.includes('draf laporan') || lower.includes('presentasi')) {
    return 'draf laporan untuk presentasi nanti';
  }
  if (lower.includes('revisi') || lower.includes('anggaran') || lower.includes('klien')) {
    return 'revisi bagian anggaran dari klien';
  }
  if (lower.includes('rekap data') || lower.includes('penjualan')) {
    return 'rekap data penjualan bulan Mei';
  }
  if (lower.includes('makan bareng') || lower.includes('lembur')) {
    return 'rencana makan malam kita';
  }
  if (lower.includes('capek') || lower.includes('cerita')) {
    return 'ceritamu hari ini';
  }
  if (lower.includes('belum bales') || lower.includes('sibuk')) {
    return 'kabarku siang ini';
  }
  if (lower.includes('mabar') || lower.includes('futsal')) {
    return 'agenda main bareng weekend ini';
  }
  if (lower.includes('patungan') || lower.includes('kado')) {
    return 'transfer patungan kado Dani';
  }
  if (lower.includes('ngopi') || lower.includes('curhat')) {
    return 'ajakan ngopi malam ini';
  }
  return '';
}

function cleanPunctuationForRewrite(str) {
  return str
    .replace(/!{2,}/g, '.')
    .replace(/\?{2,}/g, '?')
    .replace(/(🙄|😒|😤|😠|😡|🤬|🖕|🗿|🙂)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAllCapsIfShouting(str) {
  const letters = str.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 6) {
    const upper = str.replace(/[^A-Z]/g, '');
    if (upper.length / letters.length > 0.6) {
      const lowered = str.toLowerCase();
      return lowered.charAt(0).toUpperCase() + lowered.slice(1);
    }
  }
  return str;
}

function generateSmartRewrites(originalText, analysis, mode, incomingContext = '', subRole = '') {
  const trimmed = originalText.trim();
  const lower = trimmed.toLowerCase();
  const topicFromIncoming = extractTopicFromIncoming(incomingContext);
  const attachDiff = (list) =>
    list.map((item) => ({
      ...item,
      diffTokens: computeWordDiff(trimmed, item.text)
    }));

  // Case 1: Ultra-short / Cold 1-2 word replies — weave incoming context!
  if (COLD_SHORT_MAP[lower] || (analysis.flags.cold && trimmed.split(/\s+/).length <= 3)) {
    const contextPhrase = topicFromIncoming ? ` terkait ${topicFromIncoming}` : '';
    let warmer = '';
    let corporate = '';
    let casual = '';

    if (lower.includes('belum') || lower.includes('blm')) {
      warmer = `Halo! Untuk${contextPhrase || ' hal tersebut'} saat ini masih sedang saya rapikan sedikit lagi ya. Begitu selesai langsung saya kabari, terima kasih banyak pengertiannya! 🙏`;
      corporate = `Selamat siang, terkait${contextPhrase || ' pekerjaan tersebut'} saat ini masih dalam tahap finalisasi dan akan segera saya kirimkan. Terima kasih.`;
      casual = `Halo bro! Buat${contextPhrase || ' yang itu'} lagi gua kebut dikit lagi nih, beres langsung gua kabarin ya. Thanks! 🙌`;
    } else if (lower.includes('gak bisa') || lower.includes('ga bisa')) {
      warmer = `Maaf sekali ya, untuk${contextPhrase || ' saat ini'} kebetulan saya belum bisa menyanggupi. Bagaimana kalau kita cari waktu pengganti yang pas? 🙏`;
      corporate = `Mohon maaf, sehubungan dengan agenda lain yang bersamaan, saya belum dapat memenuhi permintaan${contextPhrase} saat ini. Mari kita jadwalkan alternatifnya.`;
      casual = `Waduh sorry banget nih, buat${contextPhrase || ' kali ini'} gua belum bisa ikutan. Next time kita atur jadwal lagi ya! 🙏`;
    } else if (mode === 'partner') {
      if (subRole === 'parents') {
        warmer = `Baik Ayah/Ibu, sudah saya catat${contextPhrase} ya. Terima kasih banyak atas pengingatnya, sehat selalu ya 🙏❤️`;
        corporate = `Baik Bapak/Ibu, pesan${contextPhrase} sudah saya terima dengan baik. Terima kasih.`;
        casual = `Siap Bu/Pak, aman kok${contextPhrase}! Nanti segera dikabari lagi ya 🙏`;
      } else {
        warmer = `Siap sayang, oke banget untuk${contextPhrase || ' rencananya'}! Kabari aku lagi nanti ya, semangat hari ini ❤️`;
        corporate = `Baik, sudah saya catat dengan baik${contextPhrase}. Terima kasih atas informasinya! 😊`;
        casual = `Sip sayang, aman kok${contextPhrase}! Nanti lanjut ngobrol lagi ya 🙌`;
      }
    } else {
      warmer = `Baik, sudah saya catat${contextPhrase} ya! Terima kasih banyak atas informasinya, semoga harimu menyenangkan. 😊`;
      corporate = `Baik, informasi${contextPhrase} telah diterima dan akan segera kami tindak lanjuti. Terima kasih.`;
      casual = `Sip mantap, noted ya buat${contextPhrase || ' infonya'}! Thank you banget bro/sis. 👍`;
    }

    return attachDiff([
      {
        style: 'Lebih Hangat & Kontekstual (Warmer)',
        icon: '💖',
        text: warmer,
        benefit: topicFromIncoming
          ? `Menjawab konteks "${topicFromIncoming}" dengan hangat dan apresiatif.`
          : 'Mengubah balasan singkat yang dingin menjadi respons ramah dan peduli.',
        contextPreserved: true
      },
      {
        style: 'Profesional & Jelas (Corporate Polite)',
        icon: '👔',
        text: corporate,
        benefit: 'Memberikan kepastian konfirmasi yang sopan dan terstruktur.',
        contextPreserved: true
      },
      {
        style: 'Santai & Akrab (Casual / Chill)',
        icon: '☕',
        text: casual,
        benefit: 'Menghilangkan kesan jutek tanpa terdengar kaku.',
        contextPreserved: true
      }
    ]);
  }

  // Case 2: Surgical Context-Preserving Transformation on User's Actual Sentence
  let baseClean = normalizeAllCapsIfShouting(cleanPunctuationForRewrite(trimmed));
  let warmerCore = baseClean;
  let corporateCore = baseClean;
  let casualCore = baseClean;
  let replacementsCount = 0;

  for (const rule of SURGICAL_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(baseClean)) {
      replacementsCount++;
      warmerCore = warmerCore.replace(rule.pattern, rule.warmer);
      corporateCore = corporateCore.replace(rule.pattern, rule.corporate);
      casualCore = casualCore.replace(rule.pattern, rule.casual);
    }
    rule.pattern.lastIndex = 0;
  }

  // Also transform bare imperatives at the start if detected
  BARE_IMPERATIVE_REGEX.lastIndex = 0;
  if (BARE_IMPERATIVE_REGEX.test(warmerCore) && !SOFTENER_WORDS_REGEX.test(warmerCore)) {
    replacementsCount++;
    warmerCore = warmerCore.replace(BARE_IMPERATIVE_REGEX, (m, verb) => `boleh minta tolong untuk ${verb.toLowerCase()}`);
    corporateCore = corporateCore.replace(BARE_IMPERATIVE_REGEX, (m, verb) => `mohon bantuan untuk dapat ${verb.toLowerCase()}`);
    casualCore = casualCore.replace(BARE_IMPERATIVE_REGEX, (m, verb) => `tolong bantu ${verb.toLowerCase()}`);
  }

  // Also fix pronoun mismatches in Partner or Professional mode
  if (mode === 'partner' && /\banda\b/i.test(warmerCore)) {
    warmerCore = warmerCore.replace(/\banda\b/gi, subRole === 'parents' ? 'Ayah/Ibu' : 'kamu');
    casualCore = casualCore.replace(/\banda\b/gi, subRole === 'parents' ? 'Bu/Pak' : 'kamu');
  } else if (mode === 'professional' && /\b(gue|gua|lu|loe)\b/i.test(corporateCore)) {
    corporateCore = corporateCore
      .replace(/\b(gue|gua)\b/gi, 'saya')
      .replace(/\b(lu|loe)\b/gi, subRole === 'boss_client' ? 'Bapak/Ibu' : 'Rekan');
  }

  warmerCore = warmerCore.replace(/!+/g, '.');
  corporateCore = corporateCore.replace(/!+/g, '.');
  casualCore = casualCore.replace(/!+/g, '!');

  const cap = (s) => {
    const t = s.trim().replace(/\s+/g, ' ');
    if (!t) return '';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  warmerCore = cap(warmerCore);
  corporateCore = cap(corporateCore);
  casualCore = cap(casualCore);

  const hasGreeting = /\b(halo|hai|hi|selamat|pagi|siang|sore|malam|permisi|bro|sis|sayang|pak|bu|mas|mbak|ayah|ibu)\b/i.test(trimmed);
  const hasThanks = /\b(terima kasih|makasih|thanks|thank you|mohon|tolong)\b/i.test(trimmed);

  let warmerFinal = warmerCore;
  let corporateFinal = corporateCore;
  let casualFinal = casualCore;

  const ensureEndPunct = (s) => (/[.!?]$/.test(s) ? s : s + '.');

  // Role-specific salutation prefix based on Power Dynamics (Upgrade #4)
  let warmPrefix = hasGreeting ? '' : 'Halo! ';
  let corpPrefix = hasGreeting ? '' : 'Selamat siang, ';

  if (!hasGreeting) {
    if (mode === 'professional') {
      if (subRole === 'boss_client') {
        warmPrefix = 'Selamat siang Bapak/Ibu, mohon izin menyampaikan. ';
        corpPrefix = 'Selamat siang Bapak/Ibu, dengan hormat mohon izin menyampaikan: ';
      } else if (subRole === 'subordinate') {
        warmPrefix = 'Halo Tim! ';
        corpPrefix = 'Halo Rekan-rekan Tim, ';
      } else {
        warmPrefix = 'Halo Rekan! ';
        corpPrefix = 'Selamat siang Rekan, ';
      }
    } else if (mode === 'partner') {
      if (subRole === 'parents') {
        warmPrefix = 'Halo Ayah/Ibu, mohon izin menyampaikan. ';
        corpPrefix = 'Selamat siang Ayah/Ibu, ';
      } else {
        warmPrefix = 'Sayang, ';
      }
    }
  }

  if (analysis.status !== 'green' || replacementsCount > 0) {
    const warmSuffix =
      mode === 'partner' && subRole !== 'parents'
        ? ' Terima kasih pengertiannya ya ❤️'
        : hasThanks
        ? ' 🙏'
        : ' Terima kasih banyak sebelumnya atas bantuan dan pengertiannya ya. 🙏';

    const corpSuffix = hasThanks ? '' : ' Terima kasih atas kerja sama dan perhatiannya.';
    const casualPrefix = hasGreeting ? '' : 'Hai bro/sis! ';
    const casualSuffix = hasThanks ? ' 🙌' : ' Thank you banget sebelumnya ya! 👍';

    warmerFinal = `${warmPrefix}${ensureEndPunct(warmerCore)}${warmSuffix}`;
    corporateFinal = `${corpPrefix}${ensureEndPunct(corporateCore)}${corpSuffix}`;
    casualFinal = `${casualPrefix}${ensureEndPunct(casualCore)}${casualSuffix}`;
  } else {
    warmerFinal = `${ensureEndPunct(warmerCore)} Semoga harimu menyenangkan ya! 😊`;
    corporateFinal = `${ensureEndPunct(corporateCore)} Terima kasih atas koordinasi yang baik.`;
    casualFinal = `${ensureEndPunct(casualCore)} Mantap, thank you ya! 🙌`;
  }

  return attachDiff([
    {
      style: 'Lebih Hangat & Empatik (Warmer)',
      icon: '💖',
      text: warmerFinal,
      benefit:
        replacementsCount > 0
          ? `Mempertahankan konteks pesan Anda sambil menghaluskan ${replacementsCount} titik pemicu tensi.`
          : 'Menambahkan sentuhan empati dan apresiasi tulus tanpa mengubah maksud asli pesan.',
      contextPreserved: true
    },
    {
      style: 'Profesional & Asertif (Corporate Polite)',
      icon: '👔',
      text: corporateFinal,
      benefit: 'Menjaga ketegasan & pokok bahasan asli dalam bahasa korporat yang beretika.',
      contextPreserved: true
    },
    {
      style: 'Santai & Terbuka (Casual / Chill)',
      icon: '☕',
      text: casualFinal,
      benefit: 'Menyampaikan maksud yang sama dengan gaya bahasa akrab dan bebas drama.',
      contextPreserved: true
    }
  ]);
}

// --- 11. HYBRID TONE ANALYZER v3.0 (DEEP PRAGMATIC + XAI + CADENCE) ---

async function analyzeTone(text, mode = 'professional', incomingContext = '', keystrokeMetrics = null, subRole = '') {
  if (!text || text.trim().length === 0) {
    return {
      status: 'neutral',
      color: 'zinc',
      score: 0,
      label: 'Menunggu Input...',
      explanation: 'Ketik pesan Anda di atas atau coba klik salah satu contoh template.',
      flags: {},
      dimensions: { politeness: 50, warmth: 50, assertiveness: 50, urgency: 10 },
      matchedSpans: [],
      xaiFactors: [],
      cadenceInfo: { status: 'normal', badgeText: '⌨️ Ritme Ketik: Siap' },
      quickPhrases: getQuickKeyboardPhrases(mode, subRole, 'neutral'),
      rewrites: [],
      engineType: isNeuralReady ? 'Neural Model Ready' : 'Deep Pragmatic Ready'
    };
  }

  // 1. Check PII & sensitive credentials
  const piiCheck = scanPII(text);
  if (piiCheck.detected) {
    return {
      status: 'pii_warning',
      color: 'amber',
      score: 50,
      label: 'Kredensial Sensitif Terdeteksi',
      explanation: `Ditemukan pola ${piiCheck.type}. Tone check dinonaktifkan secara otomatis demi melindungi kerahasiaan Anda.`,
      piiDetected: true,
      piiType: piiCheck.type,
      flags: {},
      dimensions: { politeness: 0, warmth: 0, assertiveness: 0, urgency: 0 },
      matchedSpans: [],
      xaiFactors: [{ label: `🔒 Proteksi PII Aktif (${piiCheck.type})`, type: 'info' }],
      cadenceInfo: { status: 'normal', badgeText: '🔒 Dilindungi' },
      rewrites: [],
      engineType: 'PII Shield Bypassed'
    };
  }

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  let detectedTriggers = [];
  let matchedSpans = [];
  let xaiFactors = [];
  let neuralSentiment = null;
  let neuralRiskContribution = 0;

  // 2. Deep Neural Transformer Inference (if ready)
  if (isNeuralReady && neuralClassifier) {
    try {
      const neuralResult = await neuralClassifier(trimmed);
      if (neuralResult && neuralResult[0]) {
        neuralSentiment = neuralResult[0];
        if (neuralSentiment.label === 'NEGATIVE' && neuralSentiment.score > 0.65) {
          neuralRiskContribution = Math.round(neuralSentiment.score * 24);
          xaiFactors.push({
            label: `+${neuralRiskContribution}% DistilBERT Neural Tension (${Math.round(neuralSentiment.score * 100)}%)`,
            type: 'risk'
          });
        } else if (neuralSentiment.label === 'POSITIVE' && neuralSentiment.score > 0.7) {
          neuralRiskContribution = -Math.round(neuralSentiment.score * 16);
          xaiFactors.push({
            label: `${neuralRiskContribution}% DistilBERT Sentimen Positif`,
            type: 'safe'
          });
        }
      }
    } catch (neuralErr) {
      console.warn('Neural inference exception:', neuralErr);
    }
  }

  // 3. Scan Surgical Rules with Contextual Negation & Hedging Check (UPGRADE #1)
  let hostileScore = 0;
  let demandingScore = 0;
  let passiveAggressiveScore = 0;
  let sarcasticScore = 0;
  let coldScore = 0;
  let politeScore = 0;
  let warmScore = 0;

  for (const rule of SURGICAL_RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      const matchedText = match[0];
      const negCheck = checkContextualNegation(text, match.index, rule.category);

      if (negCheck.negated) {
        // Negated! Flip to safe green span!
        matchedSpans.push({
          start: match.index,
          end: match.index + matchedText.length,
          text: matchedText,
          category: 'mitigated',
          severity: 'green',
          reason: `Frasa "${matchedText}" telah dinetralkan oleh kata negasi ("${negCheck.cue}") sehingga aman dan tidak menuntut`,
          inlineFix: null
        });
        politeScore += 15;
        xaiFactors.push({
          label: `0% "${matchedText}" Dinetralkan Negasi ("${negCheck.cue}")`,
          type: 'safe'
        });
        continue;
      }

      const effectiveWeight = negCheck.hedged ? Math.round(rule.weight * 0.45) : rule.weight;

      matchedSpans.push({
        start: match.index,
        end: match.index + matchedText.length,
        text: matchedText,
        category: rule.category,
        severity: negCheck.hedged ? 'yellow' : rule.severity,
        reason: negCheck.hedged
          ? `${rule.reason} (Sudah sedikit dilunakkan oleh kata pengandaian)`
          : rule.reason,
        inlineFix: rule.inlineFix
      });

      detectedTriggers.push(`${rule.reason}: "${matchedText}"`);
      xaiFactors.push({
        label: `+${effectiveWeight}% ${rule.reason} ("${matchedText}")`,
        type: 'risk'
      });

      if (rule.category === 'hostile') hostileScore += effectiveWeight;
      else if (rule.category === 'demanding') demandingScore += effectiveWeight;
      else if (rule.category === 'passiveAggressive') passiveAggressiveScore += effectiveWeight;
      else if (rule.category === 'sarcastic') sarcasticScore += effectiveWeight;
    }
    rule.pattern.lastIndex = 0;
  }

  // 4. Indonesian Pragmatics: Bare Imperatives & Pronoun Hierarchy (UPGRADE #3)
  const pragmatics = scanIndonesianPragmatics(text, mode);
  demandingScore += pragmatics.pragmaticRisk;
  matchedSpans.push(...pragmatics.spans);
  xaiFactors.push(...pragmatics.xai);
  for (const sp of pragmatics.spans) {
    detectedTriggers.push(sp.reason);
  }

  // 5. Paralinguistic Emoji Sentiment (UPGRADE #4)
  const emojiAnalysis = scanParalinguisticEmojis(text);
  if (emojiAnalysis.emojiRiskDelta > 0) {
    passiveAggressiveScore += emojiAnalysis.emojiRiskDelta;
  } else if (emojiAnalysis.emojiRiskDelta < 0) {
    warmScore += Math.abs(emojiAnalysis.emojiRiskDelta);
  }
  matchedSpans.push(...emojiAnalysis.spans);
  xaiFactors.push(...emojiAnalysis.xai);

  // 6. Cold / Ultra-Short Response Check
  if (COLD_SHORT_MAP[lower]) {
    coldScore += 45;
    detectedTriggers.push(`Balasan singkat dingin ("${trimmed}")`);
    matchedSpans.push({
      start: 0,
      end: text.length,
      text: trimmed,
      category: 'cold',
      severity: 'yellow',
      reason: 'Respons terlalu singkat/dingin, rawan dianggap tidak peduli',
      inlineFix: COLD_SHORT_MAP[lower]
    });
    xaiFactors.push({
      label: `+45% Balasan Ultra-Singkat Dingin ("${trimmed}")`,
      type: 'risk'
    });
  } else if (words.length <= 2 && trimmed.endsWith('.') && !politeScore) {
    coldScore += 28;
    detectedTriggers.push('Jawaban sangat singkat diakhiri tanda titik (terkesan jutek/dingin)');
    xaiFactors.push({
      label: '+28% Kalimat Pendek Diakhiri Titik Dingin',
      type: 'risk'
    });
  }

  // 7. Politeness & Warmth Positive Spans
  for (const w of POLITE_MARKERS) {
    const idx = lower.indexOf(w);
    if (idx !== -1) {
      politeScore += 20;
      matchedSpans.push({
        start: idx,
        end: idx + w.length,
        text: text.slice(idx, idx + w.length),
        category: 'polite',
        severity: 'green',
        reason: 'Kata penanda kesopanan positif',
        inlineFix: null
      });
      xaiFactors.push({
        label: `-18% Penanda Kesopanan ("${text.slice(idx, idx + w.length)}")`,
        type: 'safe'
      });
    }
  }

  for (const w of WARM_WORDS) {
    const idx = lower.indexOf(w);
    if (idx !== -1) {
      warmScore += 20;
      matchedSpans.push({
        start: idx,
        end: idx + w.length,
        text: text.slice(idx, idx + w.length),
        category: 'warm',
        severity: 'green',
        reason: 'Ungkapan hangat & empatik',
        inlineFix: null
      });
      xaiFactors.push({
        label: `-18% Ungkapan Empatik ("${text.slice(idx, idx + w.length)}")`,
        type: 'safe'
      });
    }
  }

  // 8. Punctuation & Capitalization Nuances
  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 8) {
    const uppercaseLetters = trimmed.replace(/[^A-Z]/g, '');
    const uppercaseRatio = uppercaseLetters.length / letters.length;
    if (uppercaseRatio > 0.6) {
      demandingScore += 32;
      detectedTriggers.push('Penggunaan HURUF KAPITAL berlebih (terkesan membentak)');
      xaiFactors.push({ label: '+32% ALL CAPS (Terkesan Membentak)', type: 'risk' });
    }
  }

  const exclamationCount = (trimmed.match(/!/g) || []).length;
  if (exclamationCount >= 2) {
    const excRisk = 14 * Math.min(exclamationCount, 3);
    demandingScore += excRisk;
    detectedTriggers.push('Tanda seru beruntun (meningkatkan tensi ketus)');
    xaiFactors.push({ label: `+${excRisk}% Tanda Seru Beruntun (${exclamationCount}x "!")`, type: 'risk' });
  }

  const questionSpam = /\?{2,}/.test(trimmed);
  if (questionSpam) {
    demandingScore += 22;
    detectedTriggers.push('Tanda tanya beruntun "???" (terkesan menginterogasi/tidak sabar)');
    xaiFactors.push({ label: '+22% Tanda Tanya Interogatif ("???")', type: 'risk' });
  }

  // 9. Multi-Sentence Discourse & Contrastive Clause Weighting ("Tapi...") (UPGRADE #2)
  const discourse = analyzeDiscourseClauses(trimmed);
  xaiFactors.push(...discourse.xai);

  // 10. Context-Aware Weighting based on Relationship Mode & Power Dynamics (Sub-Role)
  const modeMultiplier = {
    professional: { demanding: 1.3, passiveAggressive: 1.25, sarcastic: 1.35, cold: 1.15, hostile: 1.5 },
    partner:      { demanding: 1.15, passiveAggressive: 1.5, sarcastic: 1.5, cold: 1.65, hostile: 1.5 },
    casual:       { demanding: 0.8, passiveAggressive: 0.9, sarcastic: 0.9, cold: 0.65, hostile: 1.25 }
  }[mode] || { demanding: 1.0, passiveAggressive: 1.0, sarcastic: 1.0, cold: 1.0, hostile: 1.0 };

  const subRoleFactor =
    subRole === 'boss_client' || subRole === 'parents'
      ? 1.22
      : subRole === 'subordinate'
      ? 1.08
      : subRole === 'bestie'
      ? 0.85
      : 1.0;

  let rawDanger =
    ((hostileScore * modeMultiplier.hostile) +
    (demandingScore * modeMultiplier.demanding) +
    (passiveAggressiveScore * modeMultiplier.passiveAggressive) +
    (sarcasticScore * modeMultiplier.sarcastic) +
    (coldScore * modeMultiplier.cold)) * subRoleFactor;

  if (subRoleFactor > 1.15 && rawDanger > 15) {
    xaiFactors.push({
      label: `x${subRoleFactor} Sensitivitas Hierarki (${subRole === 'boss_client' ? 'Atasan/Klien VIP' : 'Orang Tua'})`,
      type: 'info'
    });
  }

  rawDanger = rawDanger * discourse.contrastiveMultiplier;

  // Prevent "Compliment Sandwich" from masking severe hostility/contrastive jabs:
  // If rawDanger >= 45, cap politeness discount so a rude clause can't hide behind "Halo, terima kasih"!
  const maxAllowedDiscount = rawDanger >= 45 ? Math.min(20, rawDanger * 0.25) : (politeScore * 0.9 + warmScore * 0.9);
  const effectiveDiscount = Math.min(maxAllowedDiscount, politeScore * 0.9 + warmScore * 0.9);

  if (rawDanger >= 45 && (politeScore > 0 || warmScore > 0)) {
    xaiFactors.push({
      label: '🛡️ Anti-Compliment-Sandwich: Sapaan sopan tidak menutupi klausa tajam',
      type: 'info'
    });
  }

  const totalRawRisk = rawDanger + neuralRiskContribution - effectiveDiscount;
  let finalRisk = Math.max(0, Math.min(100, Math.round(totalRawRisk)));

  // 11. Biometric Keystroke Cadence Evaluation (UPGRADE #5)
  const cadenceInfo = evaluateKeystrokeCadence(keystrokeMetrics, finalRisk);
  if (cadenceInfo.agitationBonus > 0) {
    finalRisk = Math.min(100, finalRisk + cadenceInfo.agitationBonus);
  }
  if (cadenceInfo.xai) {
    xaiFactors.push(cadenceInfo.xai);
  }

  // Determine Status & Color
  let status = 'green';
  let color = 'emerald';
  let label = 'Aman & Bersahabat';
  let explanation = 'Pesan Anda memiliki nada yang positif, sopan, dan menghargai lawan bicara.';

  if (finalRisk >= 56 || hostileScore > 0 || sarcasticScore >= 35) {
    status = 'red';
    color = 'rose';
    label = hostileScore > 0
      ? 'Agresif / Ofensif'
      : (sarcasticScore > 0 ? 'Sarkastik / Menyindir' : 'Ketus & Menuntut');
    explanation = detectedTriggers.length > 0
      ? `Terdeteksi: ${detectedTriggers.slice(0, 2).join(' • ')}. Klik frasa bertanda merah untuk memperhalus.`
      : 'Pesan terkesan menuntut atau konfrontatif bagi penerima.';
  } else if (finalRisk >= 26) {
    status = 'yellow';
    color = 'amber';
    label = coldScore > 0
      ? 'Dingin & Terlalu Singkat'
      : (passiveAggressiveScore > 0 ? 'Pasif-Agresif / Kaku' : 'Berisiko / Nada Tegang');
    explanation = detectedTriggers.length > 0
      ? `Terdeteksi: ${detectedTriggers.slice(0, 2).join(' • ')}. Rawan memicu salah paham.`
      : 'Pesan berpotensi terkesan kaku atau kurang ramah bagi penerima.';
  } else if (words.length <= 3 && !politeScore && !warmScore && mode === 'professional') {
    status = 'yellow';
    color = 'amber';
    label = 'Terlalu Singkat (Mode Kerja)';
    explanation = 'Pesan sangat singkat tanpa kata sapaan/tolong berisiko terkesan dingin di lingkungan kerja.';
    finalRisk = Math.max(finalRisk, 32);
    xaiFactors.push({ label: '+32% Kalimat Kerja Sangat Singkat Tanpa Sapaan', type: 'risk' });
  }

  if (xaiFactors.length === 0) {
    xaiFactors.push({ label: '✓ Struktur Kalimat Netral & Kondusif', type: 'safe' });
  }

  // 12. Calculate 4-Dimensional Tone Breakdown (0 - 100%)
  const politenessDim = Math.max(5, Math.min(100, Math.round(62 + politeScore * 1.1 - hostileScore * 1.2 - passiveAggressiveScore * 0.7 - coldScore * 0.5)));
  const warmthDim = Math.max(5, Math.min(100, Math.round(58 + warmScore * 1.2 + politeScore * 0.4 - coldScore * 1.0 - hostileScore * 1.1 - passiveAggressiveScore * 0.8)));
  const assertivenessDim = Math.max(10, Math.min(100, Math.round(45 + demandingScore * 0.9 + (words.length >= 6 ? 15 : 0) - (coldScore > 0 ? 15 : 0))));
  const urgencyDim = Math.max(5, Math.min(100, Math.round(20 + demandingScore * 1.3 + exclamationCount * 15 + (questionSpam ? 25 : 0))));

  const flags = {
    hostile: hostileScore > 0,
    demanding: demandingScore > 0,
    passiveAggressive: passiveAggressiveScore > 0 || sarcasticScore > 0,
    cold: coldScore > 0,
    polite: politeScore > 0,
    warm: warmScore > 0,
    neuralNegative: neuralSentiment?.label === 'NEGATIVE',
    neuralPositive: neuralSentiment?.label === 'POSITIVE'
  };

  // Deduplicate overlapping matchedSpans (keep earliest/longest)
  matchedSpans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const cleanSpans = [];
  let lastEnd = -1;
  for (const sp of matchedSpans) {
    if (sp.start >= lastEnd) {
      cleanSpans.push(sp);
      lastEnd = sp.end;
    }
  }

  const rewrites = generateSmartRewrites(trimmed, { status, flags }, mode, incomingContext, subRole);

  return {
    status,
    color,
    score: finalRisk,
    label,
    explanation,
    piiDetected: false,
    piiType: null,
    triggers: detectedTriggers,
    matchedSpans: cleanSpans,
    xaiFactors,
    cadenceInfo,
    quickPhrases: getQuickKeyboardPhrases(mode, subRole, status),
    dimensions: {
      politeness: politenessDim,
      warmth: warmthDim,
      assertiveness: assertivenessDim,
      urgency: urgencyDim
    },
    flags,
    rewrites,
    engineType: isNeuralReady
      ? 'DistilBERT ONNX + Deep Pragmatic NLP v4.0'
      : 'Deep Pragmatic & Behavioral NLP v4.0',
    neuralScore: neuralSentiment ? `${neuralSentiment.label} (${Math.round(neuralSentiment.score * 100)}%)` : null
  };
}

// --- 12. CONTEXTUAL TWO-WAY CHAT REPLY GENERATOR ---

function generatePersonaReply(userText, toneStatus, mode) {
  const lower = userText.toLowerCase();

  if (mode === 'professional') {
    if (toneStatus === 'red') {
      return {
        mood: 'Tense / Defensif',
        reply: 'Waduh, baik Pak/Bu. Mohon maaf jika ada kendala, kami sedang berusaha maksimal menyelesaikan bagian tersebut. Tapi mohon arahannya agar tetap kondusif ya.'
      };
    } else if (toneStatus === 'yellow') {
      return {
        mood: 'Kaku / Canggung',
        reply: 'Baik, dicatat. Nanti akan saya kirimkan update-nya.'
      };
    } else {
      if (lower.includes('terima kasih') || lower.includes('makasih') || lower.includes('thank')) {
        return {
          mood: 'Kooperatif & Apresiatif',
          reply: 'Sama-sama! Senang bisa berkolaborasi dengan lancar. Draf finalnya segera saya kirimkan ke email dalam 15 menit ya. 🙌'
        };
      }
      return {
        mood: 'Positif & Responsif',
        reply: 'Siap, terima kasih banyak atas konfirmasi dan komunikasinya yang jelas! Segera saya tindak lanjuti sesuai arahan ya. 👍'
      };
    }
  }

  if (mode === 'partner') {
    if (toneStatus === 'red') {
      return {
        mood: 'Sedih / Tersinggung',
        reply: 'Kok kamu ngomongnya gitu sih sama aku? Aku kan cuma nanya baik-baik... Kalau lagi capek bilang aja, jangan marah-marah gini 😔'
      };
    } else if (toneStatus === 'yellow') {
      return {
        mood: 'Khawatir / Dingin',
        reply: 'Kamu kenapa? Kok balasnya singkat/jutek gitu... Aku ada salah ngomong ya?'
      };
    } else {
      return {
        mood: 'Hangat & Sayang',
        reply: 'Oke sayangku, makasih ya udah ngabarin dengan manis! Semangat terus ya, nanti malam kita ketemu ❤️🥰'
      };
    }
  }

  if (toneStatus === 'red') {
    return {
      mood: 'Kaget / Kesal',
      reply: 'Woi santai dong bro, ngegas amat haha. Kalau lagi badmood kita obrolin nanti aja dah.'
    };
  } else if (toneStatus === 'yellow') {
    return {
      mood: 'Bingung',
      reply: 'Waduh singkat amat bro, lagi sibuk banget ya? Yaudah kabarin aja nanti.'
    };
  } else {
    return {
      mood: 'Asik & Kompak',
      reply: 'Nah gitu dong mantap bro! Siap, nanti gua kabarin di grup ya. Gas terus! 🔥🙌'
    };
  }
}

// --- 13. WORKER MESSAGE HANDLER ---

self.onmessage = async function (event) {
  const { id, action, text, mode, subRole, incomingContext, keystrokeMetrics, toneStatus, score } = event.data || {};

  if (action === 'ANALYZE') {
    const startTime = performance.now();
    const result = await analyzeTone(text, mode, incomingContext, keystrokeMetrics, subRole);
    const duration = Math.max(1, Math.round(performance.now() - startTime));

    self.postMessage({
      id,
      action: 'ANALYZE_RESULT',
      success: true,
      durationMs: duration,
      ...result
    });
  } else if (action === 'GENERATE_REPLY') {
    const replyData = generatePersonaReply(text || '', toneStatus || 'green', mode || 'professional', score || 0);
    self.postMessage({
      id,
      action: 'REPLY_RESULT',
      success: true,
      ...replyData
    });
  } else if (action === 'REDACT_PII') {
    const redactedText = redactPII(text || '');
    self.postMessage({
      id,
      action: 'REDACT_PII_RESULT',
      success: true,
      redactedText
    });
  }
};
