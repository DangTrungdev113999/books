/* ════════════════════════════════════════════════════════════════════════════
 * karaoke.ts — Read-along: text active dần theo voice (timing build sẵn).
 *   Mỗi section có public/audio/<book>/<sec>.words.json = { n, words:[{w,s}] }
 *   (xem scripts/align.mjs). Bọc <span class="kw"> từng từ trong .prose, rồi theo
 *   #audio-el.currentTime tô .read (đã đọc) + .now (từ hiện tại), từ chưa tới = mờ.
 *   Click 1 từ → tua audio. Auto-scroll giữ từ đang đọc trong tầm nhìn.
 *
 *   Bọc từ KHỚP scripts/align.mjs:sourceTokens (cùng nguồn md_vi → marked → text):
 *   walk text-node trong .prose, bỏ qua .ocr-badge, tách theo whitespace.
 * ════════════════════════════════════════════════════════════════════════════ */

const BASE = import.meta.env.BASE_URL;

interface Timing { hash: string; n: number; dur: number; words: { w: string; s: number }[]; }

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);

let audioEl: HTMLAudioElement | null = null;
let spans: HTMLElement[] = [];
let starts: number[] = []; // giây, theo index từ
let reading = false;
let rafId = 0;
let lastActive = -1;
const timingCache = new Map<string, Timing | null>();

/* ── Bọc từng từ trong .prose vào <span class="kw"> (giữ khoảng trắng) ──────── */
export function wrapWords(art: HTMLElement) {
  spans = [];
  let wi = 0;
  // gom text-node trước (tránh sửa cây khi đang walk)
  const walker = document.createTreeWalker(art, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      (n.parentElement && n.parentElement.closest('.ocr-badge'))
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const textNodes: Text[] = [];
  let tn: Node | null;
  while ((tn = walker.nextNode())) textNodes.push(tn as Text);

  for (const node of textNodes) {
    const text = node.nodeValue || '';
    if (!/\S/.test(text)) continue; // chỉ khoảng trắng → để nguyên
    const frag = document.createDocumentFragment();
    // tách giữ delimiter khoảng trắng làm text-node riêng → offset highlight không lệch
    const parts = text.split(/(\s+)/);
    for (const part of parts) {
      if (part === '') continue;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
      } else {
        const span = document.createElement('span');
        span.className = 'kw';
        span.dataset.wi = String(wi++);
        span.textContent = part;
        frag.appendChild(span);
        spans.push(span);
      }
    }
    node.parentNode?.replaceChild(frag, node);
  }
}

/* ── Nạp timing cho section (best-effort) ─────────────────────────────────── */
export async function loadTiming(bookId: string, sectionId: string): Promise<boolean> {
  const key = `${bookId}/${sectionId}`;
  let t = timingCache.get(key) ?? null;
  if (!timingCache.has(key)) {
    try {
      const res = await fetch(`${BASE}audio/${bookId}/${sectionId}.words.json`, { cache: 'no-cache' });
      t = res.ok ? ((await res.json()) as Timing) : null;
    } catch { t = null; }
    timingCache.set(key, t);
  }
  starts = t ? t.words.map((x) => x.s) : [];
  lastActive = -1;
  if (reading) setReading(true); // áp lại khi timing vừa về (lúc mở bar có thể chưa có)
  return Boolean(t);
}

/* timing có sẵn (đã cache) cho section? — để popup quyết định wrap đồng bộ */
export function hasTimingCached(bookId: string, sectionId: string): boolean {
  return Boolean(timingCache.get(`${bookId}/${sectionId}`));
}

/* ── Bật/tắt chế độ đọc-theo ──────────────────────────────────────────────── */
export function setReading(on: boolean) {
  reading = on;
  // Chỉ dim/tô khi THỰC SỰ có timing — tránh dim cả đoạn nếu section chưa được căn.
  const active = on && starts.length > 0;
  $('#modal-body .prose')?.classList.toggle('reading', active);
  if (active) { paint(currentActive()); startLoop(); }
  else { stopLoop(); clearPaint(); }
}

export function resetKaraoke() {
  stopLoop();
  spans = [];
  starts = [];
  lastActive = -1;
  reading = false;
}

/* ── Sync ─────────────────────────────────────────────────────────────────── */
function currentActive(): number {
  if (!starts.length || !audioEl) return -1;
  const t = audioEl.currentTime;
  // binary search: index lớn nhất có starts[i] <= t
  let lo = 0, hi = starts.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function paint(active: number) {
  if (active === lastActive) return;
  if (active > lastActive) {
    for (let i = Math.max(0, lastActive); i <= active; i++) spans[i]?.classList.add('read');
  } else {
    for (let i = lastActive; i > active; i--) spans[i]?.classList.remove('read');
  }
  spans[lastActive]?.classList.remove('now');
  if (active >= 0) {
    spans[active]?.classList.add('read', 'now');
    autoScroll(spans[active]);
  }
  lastActive = active;
}

function clearPaint() {
  for (const s of spans) s.classList.remove('read', 'now');
  lastActive = -1;
}

function autoScroll(span?: HTMLElement) {
  if (!span) return;
  const body = $('#modal-body');
  if (!body) return;
  const br = body.getBoundingClientRect();
  const sr = span.getBoundingClientRect();
  // chỉ cuộn khi từ rơi ngoài vùng thoải mái (35%–75% chiều cao khung)
  if (sr.top < br.top + br.height * 0.35 || sr.bottom > br.top + br.height * 0.75) {
    body.scrollTo({ top: body.scrollTop + (sr.top - br.top) - br.height * 0.45, behavior: 'smooth' });
  }
}

function loop() {
  if (!reading) return;
  paint(currentActive());
  rafId = requestAnimationFrame(loop);
}
function startLoop() { if (!rafId) rafId = requestAnimationFrame(loop); }
function stopLoop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

/* ── Wiring 1 lần (từ initReader) ─────────────────────────────────────────── */
let wired = false;
export function setupKaraoke() {
  if (wired) return;
  wired = true;
  audioEl = $<HTMLAudioElement>('#audio-el');
  if (!audioEl) return;
  audioEl.addEventListener('play', () => { if (reading) startLoop(); });
  audioEl.addEventListener('pause', () => { stopLoop(); paint(currentActive()); });
  audioEl.addEventListener('seeked', () => paint(currentActive()));
  audioEl.addEventListener('ended', () => { stopLoop(); paint(currentActive()); });

  // click 1 từ → tua audio tới đó
  $('#modal-body')!.addEventListener('click', (e) => {
    if (!reading || !audioEl) return;
    const kw = (e.target as HTMLElement).closest<HTMLElement>('.kw');
    if (!kw || kw.dataset.wi == null) return;
    const i = Number(kw.dataset.wi);
    if (starts[i] == null) return;
    audioEl.currentTime = starts[i];
    paint(currentActive());
    if (audioEl.paused) audioEl.play().catch(() => {});
  });
}
