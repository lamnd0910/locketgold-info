export function addAdminAccount(dash, api) {
  const panel = document.createElement("section");
  panel.id = "admin-account";
  panel.className = "admin-panel";
  panel.innerHTML = `<h2>Tài khoản quản trị</h2><p>Đổi tên đăng nhập, mật khẩu hoặc cả hai. Để trống mật khẩu mới nếu chỉ đổi tên đăng nhập. Sau khi lưu, các phiên đăng nhập khác sẽ được đăng xuất.</p><form><label>Tên đăng nhập<input name="username" autocomplete="username" pattern="[a-zA-Z0-9_.-]{3,64}" minlength="3" maxlength="64" required></label><label>Mật khẩu hiện tại<input name="current_password" type="password" autocomplete="current-password" maxlength="1000" required></label><div class="form-row"><label>Mật khẩu mới<input name="new_password" type="password" autocomplete="new-password" minlength="10" maxlength="128"></label><label>Nhập lại mật khẩu mới<input name="confirm_password" type="password" autocomplete="new-password" minlength="10" maxlength="128"></label></div><button class="button" type="submit" disabled>Lưu tài khoản</button><p class="form-message" role="status" aria-live="polite">Đang tải thông tin tài khoản…</p></form>`;
  dash.querySelector(".admin-main").append(panel);
  const link = document.createElement("a");
  link.href = "#admin-account";
  link.textContent = "🔑 Tài khoản quản trị";
  dash.querySelector(".admin-sidebar nav").append(link);
  const form = panel.querySelector("form"), button = form.querySelector("button"), message = form.querySelector(".form-message");
  api("/api/admin/account").then(account => {
    form.elements.username.value = account.username;
    button.disabled = !account.editable;
    message.textContent = account.editable ? "Mật khẩu mới cần từ 10 đến 128 ký tự." : "Vui lòng đổi tài khoản NoDNS trực tiếp trên hệ thống NoDNS.";
  }).catch(error => { message.textContent = error.message; message.className = "form-message is-error"; });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (button.disabled) return;
    const values = Object.fromEntries(new FormData(form));
    if (values.new_password !== values.confirm_password) { message.textContent = "Mật khẩu xác nhận không khớp."; message.className = "form-message is-error"; return; }
    button.disabled = true;
    message.textContent = "Đang lưu tài khoản…";
    try {
      const result = await api("/api/admin/account", { method: "POST", body: JSON.stringify(values) });
      form.reset();
      form.elements.username.value = result.username;
      message.textContent = result.message;
      message.className = "form-message is-success";
    } catch (error) { message.textContent = error.message; message.className = "form-message is-error"; }
    finally { button.disabled = false; }
  });
}
