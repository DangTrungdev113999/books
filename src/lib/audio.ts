/* ════════════════════════════════════════════════════════════════════════════
 * audio.ts — Trình phát "đọc sách" (Vbee TTS, file mp3 tĩnh build sẵn).
 *   Mỗi sách có public/audio/<book>/manifest.json + <section>.mp3 (xem scripts/tts.mjs).
 *   Phát toàn bộ section đang đọc: play/pause + seek + tốc độ. Imperative theo id,
 *   khớp phong cách lib/popup.ts. Section không có audio → ẩn thanh phát.
 * ════════════════════════════════════════════════════════════════════════════ */

const BASE = import.meta.env.BASE_URL; // vd. "/books/" trên GitHub Pages

interface AudioManifest {
  voice: string;
  sections: Record<string, { hash: string; chars: number; bytes: number }>;
}

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);

let bookId: string | null = null;
let manifest: AudioManifest | null = null;
let ready: Promise<void> = Promise.resolve();
const manifestCache = new Map<string, AudioManifest | null>();
let seeking = false;
let barOpen = false; // user bật/tắt thanh phát qua icon header; nhớ giữa các mục
let hasAudio = false; // mục hiện tại có audio không
const SPEEDS = [1, 1.25, 1.5, 0.85];
let speedIdx = 0;

function el() {
  return {
    bar: $('#audio-bar'),
    audio: $<HTMLAudioElement>('#audio-el'),
    play: $<HTMLButtonElement>('#audio-play'),
    seek: $<HTMLInputElement>('#audio-seek'),
    cur: $('#audio-cur'),
    dur: $('#audio-dur'),
    speed: $<HTMLButtonElement>('#audio-speed'),
  };
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── Đổi sách → nạp manifest (best-effort; lỗi/thiếu → không có audio) ─────── */
export function setAudioBook(id: string) {
  bookId = id;
  if (manifestCache.has(id)) {
    manifest = manifestCache.get(id) ?? null;
    ready = Promise.resolve();
    return;
  }
  manifest = null;
  ready = (async () => {
    let m: AudioManifest | null = null;
    try {
      const res = await fetch(`${BASE}audio/${id}/manifest.json`, { cache: 'no-cache' });
      m = res.ok ? ((await res.json()) as AudioManifest) : null;
    } catch {
      m = null;
    }
    manifestCache.set(id, m);
    if (bookId === id) manifest = m; // chỉ áp dụng nếu chưa đổi sách khác
  })();
}

/* ── Mở section → gắn nguồn mp3, hiện icon header; thanh phát theo barOpen ─── */
export async function loadAudioFor(sectionId: string) {
  const { bar, audio } = el();
  if (!bar || !audio) return;
  stopAudio();
  await ready; // đảm bảo manifest đã nạp xong (tránh race mở section sớm)

  hasAudio = Boolean(bookId && manifest && manifest.sections[sectionId]);
  if (hasAudio) {
    audio.src = `${BASE}audio/${bookId}/${sectionId}.mp3`;
    audio.playbackRate = SPEEDS[speedIdx];
    audio.load();
    setPlayingUI(false);
    const { seek, cur, dur } = el();
    if (seek) {
      seek.value = '0';
      seek.max = '0';
      seek.style.setProperty('--p', '0%');
    }
    if (cur) cur.textContent = '0:00';
    if (dur) dur.textContent = '0:00';
  } else {
    audio.removeAttribute('src');
  }
  applyVisibility(); // KHÔNG tự phát khi chuyển mục; chỉ hiện thanh nếu barOpen
}

/* Ẩn hẳn audio (vd. khi xem bản English) */
export function hideAudio() {
  hasAudio = false;
  stopAudio();
  applyVisibility();
}

/* Icon header bật/tắt thanh phát; mở → phát luôn (đang trong user-gesture) */
export function toggleAudioBar() {
  if (!hasAudio) return;
  barOpen = !barOpen;
  applyVisibility();
  const { audio } = el();
  if (barOpen) audio?.play().catch(() => {});
  else stopAudio();
}

function applyVisibility() {
  const { bar } = el();
  const toggle = $('#audio-toggle');
  toggle?.classList.toggle('hidden', !hasAudio);
  const open = hasAudio && barOpen;
  bar?.classList.toggle('hidden', !open);
  toggle?.classList.toggle('on', open);
}

export function stopAudio() {
  const { audio } = el();
  if (audio && !audio.paused) audio.pause();
  setPlayingUI(false);
}

function setPlayingUI(playing: boolean) {
  el().bar?.classList.toggle('playing', playing);
}

/* ── Wiring 1 lần — gọi từ initReader sau khi scaffold mounted ────────────── */
let wired = false;
export function setupAudio() {
  if (wired) return;
  wired = true;
  const { audio, play, seek, speed } = el();
  if (!audio || !play || !seek) return;

  $('#audio-toggle')?.addEventListener('click', toggleAudioBar);

  play.addEventListener('click', () => {
    if (audio.paused) audio.play();
    else audio.pause();
  });
  audio.addEventListener('play', () => setPlayingUI(true));
  audio.addEventListener('pause', () => setPlayingUI(false));
  audio.addEventListener('ended', () => {
    setPlayingUI(false);
    audio.currentTime = 0;
  });

  audio.addEventListener('loadedmetadata', () => {
    const { dur } = el();
    seek.max = String(Math.floor(audio.duration || 0));
    if (dur) dur.textContent = fmt(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    if (seeking) return;
    const { cur } = el();
    seek.value = String(Math.floor(audio.currentTime));
    if (cur) cur.textContent = fmt(audio.currentTime);
    seek.style.setProperty('--p', `${(audio.currentTime / (audio.duration || 1)) * 100}%`);
  });

  seek.addEventListener('input', () => {
    seeking = true;
    const { cur } = el();
    if (cur) cur.textContent = fmt(Number(seek.value));
    seek.style.setProperty('--p', `${(Number(seek.value) / (Number(seek.max) || 1)) * 100}%`);
  });
  seek.addEventListener('change', () => {
    audio.currentTime = Number(seek.value);
    seeking = false;
  });

  speed?.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    audio.playbackRate = SPEEDS[speedIdx];
    speed.textContent = `${SPEEDS[speedIdx]}×`;
  });
}
