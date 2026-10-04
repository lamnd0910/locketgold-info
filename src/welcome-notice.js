export const DEFAULT_WELCOME = Object.freeze({
  enabled: true, display_policy: "session", badge: "Locket Gold · locketgold.info",
  title: "Bắt đầu thật đơn giản",
  content: "Chọn gói phù hợp, chỉ dùng tên người dùng và xem hướng dẫn thanh toán rõ ràng trước khi chuyển khoản.",
  primary_label: "Xem các gói", primary_url: "/len-gold/",
  secondary_label: "Cách đặt gói", secondary_url: "/huong-dan/",
  revision: "initial",
});

export function validateWelcome(body) {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!body || typeof body !== "object" || typeof body.enabled !== "boolean") fail("Trạng thái thông báo không hợp lệ.");
  if (!["session", "visit"].includes(body.display_policy)) fail("Tần suất hiển thị không hợp lệ.");
  const result = { enabled: body.enabled, display_policy: body.display_policy };
  for (const [key, limit] of Object.entries({ badge: 100, title: 140, content: 2000, primary_label: 60, secondary_label: 60 })) {
    if (typeof body[key] !== "string" || body[key].trim().length > limit) fail("Nội dung thông báo thiếu hoặc vượt quá độ dài cho phép.");
    result[key] = body[key].trim();
  }
  if (!result.title || !result.content) fail("Vui lòng nhập tiêu đề và nội dung thông báo.");
  for (const button of ["primary", "secondary"]) {
    const url = typeof body[`${button}_url`] === "string" ? body[`${button}_url`].trim() : "";
    const label = result[`${button}_label`];
    if (!url && !label) { result[`${button}_url`] = ""; continue; }
    if (!url || !label) fail("Mỗi nút cần có cả tên và đường dẫn; để trống cả hai nếu muốn ẩn nút.");
    if (url.length > 500 || /[\\\u0000-\u0020\u007f]/.test(url)) fail("Đường dẫn của nút không hợp lệ.");
    let parsed;
    try { parsed = new URL(url, "https://locketgold.info"); } catch { fail("Đường dẫn của nút không hợp lệ."); }
    if ((!url.startsWith("/") || url.startsWith("//")) && !url.startsWith("https://")) fail("Chỉ dùng đường dẫn bắt đầu bằng / hoặc địa chỉ HTTPS.");
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) fail("Đường dẫn của nút không hợp lệ.");
    result[`${button}_url`] = url;
  }
  return result;
}

const esc = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function welcomeMarkup(config = DEFAULT_WELCOME) {
  const notice = validateWelcome(config);
  return `<button class="modal-close" type="button" aria-label="Đóng">×</button>${notice.badge ? `<span class="eyebrow">${esc(notice.badge)}</span>` : ""}<h2 id="welcome-title">${esc(notice.title)}</h2><p class="welcome-content">${esc(notice.content)}</p><div>${notice.primary_url ? `<a class="button button--gold" href="${esc(notice.primary_url)}">${esc(notice.primary_label)}</a>` : ""}${notice.secondary_url ? `<a class="text-link" href="${esc(notice.secondary_url)}">${esc(notice.secondary_label)}</a>` : ""}</div>`;
}

export function shouldShowWelcome(config, dismissedRevision) {
  return config.enabled && (config.display_policy === "visit" || dismissedRevision !== config.revision);
}
