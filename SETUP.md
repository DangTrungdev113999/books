# Hướng dẫn dựng & deploy — Sơ đồ tư duy sách (React + Vite)

Ứng dụng React + Vite + TypeScript: sơ đồ hoá nội dung sách (markmap) + popup đọc
song ngữ Việt/Anh + highlight/ghi chú + theo dõi tiến độ + gửi "điều bạn học được"
lên Telegram. Thiết kế để **scale lên nhiều quyển sách**.

## Cấu trúc

| Thư mục | Vai trò |
|---|---|
| `content/<id>/` | Nội dung sách (file `NN_*.md` + `NN_*_vi.md`). Nguồn cho build. |
| `content/books.json` | Registry các sách (`id`, `titleVi`, `source`, `data`, `groups`). |
| `scripts/build.mjs` | Sinh `public/data/<id>.json` + copy registry → `public/data/books.json`. |
| `public/data/` | JSON đã sinh (app fetch lúc runtime). **Generated — gitignored.** |
| `src/` | Mã React: `components/`, `hooks/`, `lib/` (module imperative: markmap, popup, highlight). |
| `css/` | `tokens.css` + 28 theme (`themes/*.css`) + `app.css`. Theme đổi qua `data-theme` trên `<html>`. |
| `worker/` | Cloudflare Worker chuyển góp ý → Telegram. |
| `.env` | `VITE_WORKER_URL` (để trống → form góp ý báo "chưa cấu hình"). |

## 1. Cài & chạy local

```bash
npm install
npm run dev      # tự chạy build:books trước (predev), mở http://localhost:5173
```

`npm run build:books` sinh lại `public/data/*.json` từ markdown — chạy tự động qua
`predev`/`prebuild`, hoặc gọi tay sau khi sửa nội dung/bản dịch.

## 2. Build production

```bash
npm run build    # build:books → tsc → vite build → dist/
npm run preview  # xem thử bản build
```

## 3. Thêm sách mới (scale đa sách)

1. Tạo `content/<id>/` và bỏ các file `NN_*.md` + `NN_*_vi.md` vào.
2. Thêm một mục vào mảng `books` trong `content/books.json`:
   ```json
   { "id": "<id>", "title": "...", "titleVi": "...", "author": "...",
     "source": "<id>", "data": "<id>.json",
     "groups": [ { "title": "...", "files": ["01", "02"] } ] }
   ```
3. `npm run build:books`.

Khi registry có ≥2 sách, **dropdown chọn sách** tự hiện ở đầu sidebar; mỗi sách có
tiến độ đọc / highlight riêng (localStorage key `book-state:<id>`).

## 4. Telegram (Cloudflare Worker)

Worker ở `worker/`. Sau khi deploy worker, điền URL vào `.env`:

```
VITE_WORKER_URL=https://feedback-pyramid.<account>.workers.dev
```

Deploy worker:
```bash
cd worker
npm i -g wrangler
wrangler login
wrangler kv namespace create FEEDBACK_RL        # dán id vào wrangler.toml
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_FEEDBACK_GROUP_ID  # chat_id group (số âm)
wrangler deploy
```

> `VITE_WORKER_URL` để trống → ô góp ý vẫn hiện nhưng báo "chưa cấu hình worker".

## 5. Deploy GitHub Pages

Workflow `.github/workflows/pages.yml` tự `npm ci && npm run build` rồi publish `dist/`.

1. GitHub → Settings → Pages → Source = **GitHub Actions**.
2. Push lên nhánh `main` → workflow tự chạy.
3. Nếu domain Pages khác `dangtrungdev113999.github.io`, cập nhật CORS trong
   `worker/feedback.js` và `SITE_URL` trong `worker/wrangler.toml`.

> `vite.config.ts` đặt `base: './'` nên app chạy được cả khi deploy ở subpath
> (vd. `https://<user>.github.io/<repo>/`).
