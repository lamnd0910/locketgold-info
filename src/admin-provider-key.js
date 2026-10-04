export function addProviderKeyForm(panel, api) {
  const section = document.createElement("div");
  section.innerHTML = `<hr><h2>Đổi khóa API NoDNS</h2><p>Khóa mới sẽ dùng cho cấp Gold, hủy Gold và lấy đường dẫn DNS. Trang web kiểm tra tài khoản NoDNS trước khi lưu.</p><p data-provider-key-state role="status">Đang đọc cấu hình khóa…</p><form data-provider-key-form><label>Khóa API mới<input name="api_key" type="password" autocomplete="new-password" maxlength="4096" placeholder="Dán khóa API từ cài đặt tài khoản NoDNS" required></label><button class="button" type="submit">Kiểm tra và lưu khóa API</button><p class="form-message" data-provider-key-message role="status"></p></form><p>Khóa được mã hóa phía máy chủ. Đổi khóa không chuyển các tài khoản Gold cũ sang tài khoản NoDNS mới.</p>`;
  panel.append(section);
  const form = section.querySelector("form"), input = form.elements.api_key;
  const message = section.querySelector("[data-provider-key-message]");
  const state = section.querySelector("[data-provider-key-state]");
  const refresh = async () => {
    try {
      const config = await api("/api/admin/provider/key");
      state.textContent = config.configured ? `Khóa đang dùng: ${config.source === "admin" ? "đã lưu qua trang quản trị" : "cấu hình máy chủ"}.${config.updated_at ? ` Cập nhật: ${new Date(`${config.updated_at.replace(" ", "T")}Z`).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.` : ""}` : "Chưa cấu hình khóa API NoDNS.";
    } catch (error) { state.textContent = error.message; }
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    if (button.disabled) return;
    button.disabled = true; input.disabled = true;
    message.className = "form-message"; message.textContent = "Đang kiểm tra khóa với NoDNS…";
    try {
      const result = await api("/api/admin/provider/key", { method: "POST", body: JSON.stringify({ api_key: input.value.trim() }) });
      input.value = "";
      message.textContent = `${result.message} Tài khoản: ${result.account.username}. Lượt còn lại: ${result.account.remaining}.`;
      message.className = "form-message is-success";
      await refresh();
    } catch (error) { message.textContent = error.message; message.className = "form-message is-error"; }
    finally { button.disabled = false; input.disabled = false; }
  });
  refresh();
}
