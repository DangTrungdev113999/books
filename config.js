/* Cấu hình runtime (không cần build).
 * WORKER_URL: URL Cloudflare Worker nhận góp ý → đẩy lên Telegram.
 *   Để trống "" → phần "Bạn học được gì" sẽ tự ẩn (chưa bật tính năng).
 *   Sau khi deploy worker, điền: "https://feedback-pyramid.<account>.workers.dev"
 */
window.APP_CONFIG = {
  WORKER_URL: '',
};
