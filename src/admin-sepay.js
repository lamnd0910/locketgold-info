const outcomes = {
  matched: "Đã khớp thanh toán", underpaid: "Thiếu tiền", no_order_code: "Không có mã đơn",
  order_not_found: "Không tìm thấy đơn", wrong_account: "Sai tài khoản nhận", outgoing: "Tiền ra",
  order_not_pending: "Đơn đã xử lý / đã hủy", legacy: "Bản ghi cũ", received: "Đang xử lý",
  expired_order: "Đơn hết hạn · cần đối soát",
};
const orderStates = { pending: "Chờ thanh toán", paid: "Đã nhận tiền · chờ cấp Gold", completed: "Hoàn tất", cancelled: "Đã hủy", failed: "Lỗi" };

export function addAdminSepay(dash, api, { escapeHtml: esc, money }) {
  const panel = document.createElement("section");
  panel.id = "sepay-admin";
  panel.className = "admin-panel";
  panel.innerHTML = `<h2>Giao dịch SePay</h2><p>Xem thông báo giao dịch đã nhận và kết quả đối chiếu thanh toán. Tự cập nhật mỗi 15 giây khi mục này đang mở.</p><div data-sepay-config></div><button class="button button--outline" type="button" data-sepay-refresh>Kiểm tra giao dịch và kết nối</button><p class="form-message" data-sepay-message role="status"></p><div class="form-row"><label>Tìm trong 100 giao dịch gần nhất<input data-sepay-search type="search" placeholder="Mã đơn, mã giao dịch, nội dung"></label><label>Kết quả xử lý<select data-sepay-filter><option value="">Tất cả</option>${Object.entries(outcomes).map(([key, title]) => `<option value="${key}">${title}</option>`).join("")}</select></label></div><div data-sepay-transactions></div>`;
  dash.querySelector("#orders-admin").after(panel);
  const link = document.createElement("a");
  link.href = "#sepay-admin";
  link.textContent = "₫ Giao dịch SePay";
  dash.querySelector('.admin-sidebar a[href="#orders-admin"]').after(link);
  const button = panel.querySelector("[data-sepay-refresh]");
  const message = panel.querySelector("[data-sepay-message]");
  let rows = [];
  const date = (value) => value ? new Date(/Z$|[+]\d\d:\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa nhận thông báo giao dịch";
  const render = () => {
    const search = panel.querySelector("[data-sepay-search]").value.trim().toLowerCase();
    const filter = panel.querySelector("[data-sepay-filter]").value;
    const shown = rows.filter((row) => (!filter || row.outcome === filter) && [row.transaction_id, row.order_code, row.content, row.reference].join(" ").toLowerCase().includes(search));
    panel.querySelector("[data-sepay-transactions]").innerHTML = shown.length ? `<div class="table-wrap"><table><thead><tr><th>Nhận thông báo giao dịch (giờ VN)</th><th>Giao dịch</th><th>Tài khoản</th><th>Số tiền</th><th>Nội dung</th><th>Đơn hàng</th><th>Kết quả</th></tr></thead><tbody>${shown.map((row) => `<tr><td>${esc(date(row.received_at))}</td><td>${esc(row.transaction_id)}<br><small>${esc(row.reference)}</small></td><td>${esc(row.bank)}<br>${esc(row.account)}</td><td>${row.direction === "out" ? "−" : "+"}${money(row.amount)}</td><td>${esc(row.content)}</td><td>${esc(row.order_code || "—")}<br><small>${esc(orderStates[row.order_status] || "")}${row.order_amount != null ? ` · ${money(row.order_amount)}` : ""}</small></td><td>${esc(outcomes[row.outcome] || "Chưa xác định")}</td></tr>`).join("")}</tbody></table></div>` : `<p>${rows.length ? "Không có giao dịch phù hợp bộ lọc." : "Chưa nhận giao dịch SePay. Kiểm tra liên kết ngân hàng và bật thông báo giao dịch trong SePay."}</p>`;
  };
  const refresh = async () => {
    if (button.disabled) return;
    button.disabled = true;
    message.textContent = "Đang kiểm tra…";
    try {
      const { config, summary, transactions } = await api("/api/admin/sepay");
      rows = transactions;
      panel.querySelector("[data-sepay-config]").innerHTML = `<p>Khóa thông báo giao dịch: <strong>${config.key_configured ? "Đã cấu hình" : "Chưa cấu hình"}</strong> · ${esc(config.bank_name)} · STK <strong>${esc(config.bank_account || "Chưa cấu hình")}</strong></p><p>Địa chỉ nhận thông báo giao dịch: <code>${esc(config.webhook_url)}</code></p><p>Tổng giao dịch đã ghi nhận: <strong>${Number(summary.total)}</strong> · Tiền đã khớp đơn: <strong>${money(summary.matched_amount)}</strong><br>Thông báo giao dịch gần nhất: ${esc(date(summary.last_received))}</p><p>Chọn sự kiện Có tiền vào, xác thực khóa API và tiền tố mã đơn LG trong SePay. Có khóa trên trang web chưa xác nhận thông báo giao dịch bên SePay đã được bật.</p>`;
      render();
      message.textContent = `Đã kiểm tra lúc ${new Date().toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.`;
      message.className = "form-message is-success";
    } catch (error) { message.textContent = error.message; message.className = "form-message is-error"; }
    finally { button.disabled = false; }
  };
  button.addEventListener("click", refresh);
  panel.querySelector("[data-sepay-search]").addEventListener("input", render);
  panel.querySelector("[data-sepay-filter]").addEventListener("change", render);
  refresh();
  const timer = window.setInterval(() => {
    if (!panel.isConnected) { window.clearInterval(timer); return; }
    if (!document.hidden && !panel.hidden) refresh();
  }, 15000);
}
