# Tính năng "đọc sách" (Vbee TTS)

Mỗi section tiếng Việt được tổng hợp thành 1 file mp3 bằng Vbee, **build sẵn lúc dev**
và **commit vào repo** → GitHub Pages phục vụ tĩnh. Khi đọc, trình đọc hiện thanh phát
(play/pause + tua + tốc độ). Giọng: **Ngọc Huyền 2.0** (`hn_female_ngochuyen_full_24k-st`, x3 điểm).

## Bảo mật key — key KHÔNG nằm trong ứng dụng

- Key Vbee (`VBEE_APP_ID`, `VBEE_TOKEN`) **chỉ** ở `.env.local` (đã `.gitignore`).
- Biến **không** prefix `VITE_` → Vite **không** nhúng vào bundle frontend. Người dùng cuối
  không bao giờ thấy key.
- Vì audio đã build sẵn & commit, **CI/GitHub không cần key**. Không có gì để lộ.

`.env.local` (tạo ở gốc dự án, không commit):

```
VBEE_APP_ID=<app-id-uuid>
VBEE_TOKEN=<jwt-lấy-ở-Vbee-Studio→API-Tokens>
# VBEE_VOICE_CODE=hn_female_ngochuyen_full_24k-st   # tuỳ chọn; mặc định = Ngọc Huyền 2.0
```

## Tạo / cập nhật audio

```bash
npm run build:books     # sinh public/data/*.json (đã chạy tự động bởi predev/prebuild)
npm run build:audio     # đọc data → gọi Vbee → public/audio/<book>/<sec>.mp3 + manifest.json
# chỉ 1 sách:
node scripts/tts.mjs the-pyramid-principle
```

- **Incremental:** cache theo hash nội dung (trong `manifest.json`). Chạy lại chỉ tổng hợp
  những section đã đổi nội dung (đỡ tốn phí). Đổi `VBEE_VOICE_CODE` → tạo lại toàn bộ.
- Lưu sau **mỗi** section nên ngắt giữa chừng vẫn an toàn, chạy lại tiếp tục.
- Sau khi tạo: `git add public/audio && git commit` → đẩy lên là Pages có audio.

## Cấu trúc

```
public/audio/<book>/manifest.json   # { voice, sections: { "sec-01-00": {hash,chars,bytes} } }
public/audio/<book>/sec-01-00.mp3   # 1 file / section
```

Frontend (`src/lib/audio.ts`) nạp `manifest.json` khi mở sách; section nào có trong manifest
mới hiện thanh phát, nguồn là `./audio/<book>/<sec>.mp3`.

## (Tuỳ chọn) Để CI tự tạo audio — đặt key ở GitHub

Mặc định **không cần** (audio commit sẵn). Nếu sau này muốn CI tự tổng hợp khi build:

1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `VBEE_APP_ID` = app id
   - `VBEE_TOKEN`  = jwt
2. Trong `.github/workflows/pages.yml`, thêm bước trước `npm run build`:

   ```yaml
   - run: npm run build:audio
     env:
       VBEE_APP_ID: ${{ secrets.VBEE_APP_ID }}
       VBEE_TOKEN:  ${{ secrets.VBEE_TOKEN }}
   ```

   ⚠️ Nên cache `public/audio` giữa các lần chạy (`actions/cache`) kẻo mỗi lần deploy
   gọi lại Vbee = tốn phí. Hash-cache chỉ giúp khi thư mục audio còn tồn tại.

> Khuyến nghị: cứ commit mp3 (cách hiện tại). Đơn giản, 0đ runtime, key không rời máy bạn.

## Karaoke read-along (highlight text theo voice)

Khi nghe, text active dần theo giọng (từ đã đọc = đậm, chưa tới = mờ). Timing từng từ
lấy bằng **Groq Whisper** (miễn phí) chạy lên mp3 sẵn có — KHÔNG tạo lại audio.

```bash
# .env.local:  GROQ_API_KEY=gsk_...   (free ở console.groq.com)
npm run build:align                 # căn timing → public/audio/<book>/<sec>.words.json
node scripts/align.mjs the-pyramid-principle   # chỉ 1 sách
```

- **Incremental + resumable:** cache theo hash text, lưu sau mỗi section. Free tier Groq có
  giới hạn audio-giây/ngày → có thể gặp 429 (script tự chờ & thử lại). Chạy lại để căn nốt
  phần còn thiếu khi quota reset.
- `align.mjs` căn từ Whisper về **đúng chuỗi từ nguồn** (LCS + nội suy) → `words.json` khớp
  index với `<span class="kw">` mà `src/lib/karaoke.ts` bọc trong `.prose`.
- Section CHƯA căn → vẫn nghe bình thường, chỉ không có highlight (không lỗi).
- `words.json` commit như mp3 → static, runtime không cần key.
