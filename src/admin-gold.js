import { normalizeUsername } from "./username.js";

export function addAdminGold(dash, api, { escapeHtml: esc }) {
  const panel = document.createElement("section");
  panel.id = "gold-admin";
  panel.className = "admin-panel";
  panel.innerHTML = `<h2>Hủy Locket Gold</h2><p>Thu hồi Gold của tài khoản thuộc khóa API NoDNS đang cấu hình trên trang web. Việc hoàn lượt do NoDNS quyết định; thao tác này không hoàn tiền ngân hàng.</p><form data-gold-lookup><label>Tên người dùng Locket<input name="username" required maxlength="65" placeholder="@username" autocomplete="off"></label><button class="button button--outline" type="submit">Tra cứu tài khoản</button></form><div data-gold-preview hidden></div><p class="form-message" data-gold-message role="status"></p><hr><h2>Lịch sử hủy Gold</h2><button class="button button--outline" type="button" data-gold-refresh>Làm mới lịch sử</button><div data-gold-history></div>`;
  dash.querySelector("#provider-admin").after(panel);
  const nav = document.createElement("a"); nav.href = "#gold-admin"; nav.textContent = "⊘ Hủy Gold";
  dash.querySelector(".admin-sidebar nav").append(nav);
  const form = panel.querySelector("form"), preview = panel.querySelector("[data-gold-preview]"), message = panel.querySelector("[data-gold-message]");
  let selected = "", busy = false;
  const history = async () => {
    const target = panel.querySelector("[data-gold-history]");
    try {
      const { cancellations } = await api("/api/admin/gold/cancellations");
      target.innerHTML = cancellations.length ? `<div class="table-wrap"><table><thead><tr><th>Thời gian (giờ VN)</th><th>Tài khoản</th><th>Hoàn lượt</th><th>Lượt còn lại</th></tr></thead><tbody>${cancellations.map((row) => `<tr><td>${esc(new Date(`${row.created_at.replace(" ", "T")}Z`).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }))}</td><td>@${esc(row.username)}</td><td>${row.refunded ? "Có" : "Không"}</td><td>${row.remaining == null ? "—" : Number(row.remaining)}</td></tr>`).join("")}</tbody></table></div>` : "<p>Chưa có thao tác hủy Gold trên trang web.</p>";
    } catch (error) { target.textContent = error.message; }
  };
  const run = async (task) => {
    if (busy) return;
    busy = true;
    panel.querySelectorAll("button, input").forEach((item) => { item.disabled = true; });
    message.className = "form-message";
    try { await task(); }
    catch (error) { message.textContent = error.message; message.className = "form-message is-error"; }
    finally { busy = false; panel.querySelectorAll("button, input").forEach((item) => { item.disabled = false; }); }
  };
  form.elements.username.addEventListener("input", () => { selected = ""; preview.hidden = true; preview.innerHTML = ""; message.textContent = ""; });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = normalizeUsername(form.elements.username.value);
    if (!username) { message.textContent = "Nhập Tên người dùng Locket hợp lệ."; return; }
    run(async () => {
      selected = ""; preview.hidden = true; message.textContent = "Đang tra cứu tài khoản…";
      const profile = await api(`/api/locket/userinfo?user=${encodeURIComponent(username)}`);
      selected = normalizeUsername(profile.username) || username;
      form.elements.username.value = selected;
      preview.innerHTML = `<p><strong>${esc(profile.full_name || selected)}</strong> · @${esc(selected)}</p><p>Trạng thái Locket: ${profile.gold?.has_gold ? "Đang có Gold" : "Chưa có Gold hoạt động"}. NoDNS sẽ kiểm tra quyền sở hữu khi hủy.</p><label class="consent"><input type="checkbox" data-gold-confirm> Tôi xác nhận hủy quyền Gold của @${esc(selected)}.</label><button class="button admin-gold-cancel" type="button" data-gold-cancel>Hủy Gold của @${esc(selected)}</button>`;
      preview.hidden = false; message.textContent = "Kiểm tra đúng tài khoản trước khi xác nhận hủy.";
      preview.querySelector("[data-gold-cancel]").addEventListener("click", () => {
        if (!selected || !preview.querySelector("[data-gold-confirm]").checked) { message.textContent = "Vui lòng đánh dấu xác nhận hủy Gold."; message.className = "form-message is-error"; return; }
        run(async () => {
          message.textContent = "Đang gửi yêu cầu hủy Gold…";
          const result = await api("/api/admin/gold/cancel", { method: "POST", body: JSON.stringify({ username: selected, confirmed: true }) });
          message.textContent = `${result.message}${result.remaining != null ? ` Lượt còn lại: ${result.remaining}.` : ""}`;
          message.className = "form-message is-success";
          selected = ""; preview.hidden = true; preview.innerHTML = "";
          await history();
        });
      });
    });
  });
  panel.querySelector("[data-gold-refresh]").addEventListener("click", () => run(history));
  history();
}
