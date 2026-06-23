# Hướng dẫn dựng & deploy — Sơ đồ tư duy sách

Trang web tĩnh sơ đồ hoá nội dung sách (markmap) + popup đọc tiếng Việt/Anh + gửi
"điều bạn học được" lên Telegram.

## Cấu trúc

| Thư mục | Vai trò |
|---|---|
| `*.md` (root) | Nội dung sách 1 (EN + `_vi.md`). Nguồn cho build. |
| `scripts/build.mjs` | Sinh `data/<book>.json` từ markdown. |
| `data/` | `books.json` (registry) + JSON đã sinh. |
| `index.html`, `css/`, `js/` | Trang web tĩnh (không cần build). |
| `worker/` | Cloudflare Worker chuyển góp ý → Telegram. |

## 1. Build dữ liệu (chạy lại mỗi khi có thêm bản dịch)

```bash
node scripts/build.mjs
```

## 2. Chạy thử local

```bash
python3 -m http.server 8099
# mở http://localhost:8099
```

## 3. Thêm sách mới (sau này)

1. Bỏ các file `NN_*.md` + `NN_*_vi.md` của sách vào một thư mục, vd. `books/<id>/`.
2. Thêm một mục vào `data/books.json` (`id`, `titleVi`, `source`, `data`, `groups`).
3. `node scripts/build.mjs`.

## 4. Telegram (Cloudflare Worker)

Worker đã viết sẵn ở `worker/`. Dùng **bot cũ** (của Stream Intelligent) + **group mới**.

**Cần bạn cung cấp / thực hiện:**

1. **Tạo group Telegram mới**, add bot cũ vào, cho quyền gửi tin. Lấy `chat_id`:
   - Gửi 1 tin bất kỳ vào group, rồi mở:
     `https://api.telegram.org/bot<TOKEN>/getUpdates` → tìm `chat.id` (số âm, vd `-1001234…`).
2. **Token bot cũ**: lấy lại từ worker Stream Intelligent (`wrangler secret list` không hiện giá trị; nếu cần, dùng lại token từ @BotFather).
3. Trong thư mục `worker/`:
   ```bash
   npm i -g wrangler            # nếu chưa có
   wrangler login
   wrangler kv namespace create FEEDBACK_RL     # dán id trả về vào wrangler.toml
   wrangler secret put TELEGRAM_BOT_TOKEN        # dán token bot cũ
   wrangler secret put TELEGRAM_FEEDBACK_GROUP_ID # dán chat_id group mới
   wrangler deploy
   ```
4. Copy URL worker in ra (vd `https://feedback-pyramid.<account>.workers.dev`) vào:
   - `config.js` → `WORKER_URL`
   - `worker/wrangler.toml` → `[vars] SITE_URL` = URL GitHub Pages (để gắn link trong tin)
   rồi `wrangler deploy` lại.

> Nếu `WORKER_URL` để trống, ô góp ý tự ẩn — trang vẫn chạy bình thường.

## 5. Deploy GitHub Pages

1. Tạo repo trên GitHub (vd. `barbara-minto`).
2. Cập nhật origin CORS trong `worker/feedback.js` nếu domain Pages khác
   `dangtrungdev113999.github.io` (đã whitelist sẵn domain này).
3. Push:
   ```bash
   git add -A && git commit -m "Init mindmap reader"
   git branch -M main
   git remote add origin git@github.com:<user>/<repo>.git
   git push -u origin main
   ```
4. GitHub → Settings → Pages → Source = **GitHub Actions** (workflow `.github/workflows/pages.yml` sẽ tự build & deploy).

## Cần bạn gửi mình để mình hoàn tất

- [ ] Tên repo GitHub (để chỉnh `SITE_URL` + CORS nếu cần).
- [ ] `chat_id` của group Telegram mới (mình điền vào hướng dẫn secret).
- [ ] Quyền Cloudflare (API token) **hoặc** bạn tự chạy mục 4 — mình đã viết sẵn toàn bộ.
