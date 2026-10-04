const statuses = { active: "Đang hoạt động", expired: "Đã hết hạn", cancelled: "Đã hủy" };
export function addAdminPromos(dash, api, { escapeHtml: esc, money }) {
  const panel = dash.querySelector("#promos"), form = panel.querySelector("form");
  form.removeAttribute("data-admin-endpoint");
  form.querySelector('input[name="code"]').pattern = "[A-Za-z0-9_-]{1,32}";
  form.querySelector('input[name="expires_at"]').closest("label").firstChild.textContent = "Ngày hết hạn (giờ Việt Nam)";
  const help = document.createElement("p");
  help.textContent = "Để trống ngày hết hạn nếu mã không giới hạn thời gian. Lưu mã trùng sẽ cập nhật mức giảm và bật lại mã đó.";
  form.before(help);
  const list = document.createElement("div");
  list.innerHTML = `<hr><h2>Thống kê mã giảm giá</h2><div class="metric-grid" data-promo-summary></div><button class="button button--outline" type="button" data-promo-refresh>Làm mới danh sách</button><p class="form-message" data-promo-message role="status"></p><div class="form-row"><label>Tìm mã<input type="search" data-promo-search placeholder="Nhập mã giảm giá"></label><label>Trạng thái<select data-promo-filter><option value="">Tất cả</option>${Object.entries(statuses).map(([key,label])=>`<option value="${key}">${label}</option>`).join("")}</select></label></div><div data-promo-table></div>`;
  panel.append(list);
  const message = list.querySelector("[data-promo-message]"), refreshButton = list.querySelector("[data-promo-refresh]");
  let rows = [];
  const render = () => {
    const search = list.querySelector("[data-promo-search]").value.trim().toUpperCase(), status = list.querySelector("[data-promo-filter]").value;
    const shown = rows.filter(row => row.code.includes(search) && (!status || row.status === status));
    list.querySelector("[data-promo-table]").innerHTML = shown.length ? `<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Mức giảm</th><th>Trạng thái</th><th>Ngày hết hạn (giờ VN)</th><th>Đơn đã thanh toán</th><th>Tổng tiền đã giảm</th><th>Thao tác</th></tr></thead><tbody>${shown.map(row=>`<tr><td><b>${esc(row.code)}</b></td><td>${Number(row.percent)}%</td><td><span class="status status--${row.status === "active" ? "completed" : "cancelled"}">${statuses[row.status] || "Chưa xác định"}</span></td><td>${row.expires_at ? esc(new Date(row.expires_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })) : "Không giới hạn"}</td><td>${Number(row.paid_orders)}</td><td>${money(row.discount_total)}</td><td>${Number(row.active) ? `<button class="button button--outline button--small" type="button" data-promo-cancel="${esc(row.code)}">Hủy mã</button>` : "—"}</td></tr>`).join("")}</tbody></table></div>` : "<p>Không có mã giảm giá phù hợp.</p>";
  };
  const refresh = async () => {
    if (refreshButton.disabled) return;
    refreshButton.disabled = true;
    try {
      const { promos, summary } = await api("/api/admin/promos"); rows = promos;
      list.querySelector("[data-promo-summary]").innerHTML = [["Tổng số mã",summary.total],["Đang hoạt động",summary.active],["Đã hết hạn",summary.expired],["Đã hủy",summary.cancelled]].map(([label,value])=>`<article><span>${label}</span><strong>${Number(value)}</strong></article>`).join("");
      render();
    } catch(error) { message.textContent = error.message; message.className = "form-message is-error"; }
    finally { refreshButton.disabled = false; }
  };
  list.querySelector("[data-promo-search]").addEventListener("input", render);
  list.querySelector("[data-promo-filter]").addEventListener("change", render);
  refreshButton.addEventListener("click", refresh);
  panel.addEventListener("promos-refresh", refresh);
  list.addEventListener("click", async event => {
    const button = event.target.closest("[data-promo-cancel]");
    if (!button || button.disabled) return;
    const code = button.dataset.promoCancel;
    if (!window.confirm(`Hủy mã ${code}? Các đơn đã tạo giữ nguyên số tiền.`)) return;
    button.disabled = true;
    try { const result = await api("/api/admin/promos/cancel", { method: "POST", body: JSON.stringify({ code }) }); message.textContent = result.message; message.className = "form-message is-success"; await refresh(); }
    catch(error) { message.textContent = error.message; message.className = "form-message is-error"; }
    finally { button.disabled = false; }
  });
  const save = form.querySelector('button[type="submit"]'), formMessage = form.querySelector(".form-message");
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (save.disabled) return;
    save.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      if (values.expires_at) values.expires_at = new Date(`${values.expires_at}${values.expires_at.length === 16 ? ":00" : ""}+07:00`).toISOString();
      const result = await api("/api/admin/promos", { method: "POST", body: JSON.stringify(values) });
      formMessage.textContent = result.message; formMessage.className = "form-message is-success"; form.reset(); await refresh();
    } catch(error) { formMessage.textContent = error.message; formMessage.className = "form-message is-error"; }
    finally { save.disabled = false; }
  });
  refresh();
}
