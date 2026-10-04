export function addAdminNoDns(dash, api, remoteAdmin) {
  const panel = document.createElement("section");
  panel.id = "nodns-admin";
  panel.className = "admin-panel";
  panel.innerHTML = `<h2>Phiên quản trị NoDNS</h2><p>Kết nối bằng tài khoản admin tại ctv.nodns.vn. Bộ API quản trị được cung cấp gồm đăng nhập, đăng xuất và kiểm tra phiên.</p><a class="button button--outline" href="/downloads/admin.postman_collection.json" download>Tải JSON API quản trị</a>
    <form id="nodns-admin-login"><label>Tên đăng nhập NoDNS<input name="username" autocomplete="username" maxlength="100" required></label><label>Mật khẩu NoDNS<input name="password" type="password" autocomplete="current-password" maxlength="1000" required></label><button class="button" type="submit">Kết nối quản trị NoDNS</button></form>
    <button id="nodns-admin-me" class="button button--outline" type="button">Kiểm tra phiên admin</button><button id="nodns-admin-logout" class="button button--outline" type="button" hidden>Đăng xuất NoDNS</button><p id="nodns-admin-result" class="form-message" aria-live="polite"></p>`;
  dash.querySelector("#overview").after(panel);
  const link = document.createElement("a");
  link.href = "#nodns-admin";
  link.textContent = "🔐 Quản trị NoDNS";
  dash.querySelector(".admin-sidebar nav").append(link);
  const form = panel.querySelector("form"), message = panel.querySelector("#nodns-admin-result"), logout = panel.querySelector("#nodns-admin-logout");
  let busy = false;
  const connected = (value) => { form.hidden = value; logout.hidden = !value; };
  const run = async (task) => {
    if (busy) return;
    busy = true;
    panel.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    message.className = "form-message";
    message.textContent = "Đang kết nối…";
    try { await task(); message.className = "form-message is-success"; }
    catch (error) { message.textContent = error.message; message.className = "form-message is-error"; }
    finally { busy = false; panel.querySelectorAll("button").forEach((button) => { button.disabled = false; }); }
  };
  const me = async () => {
    try {
      const result = await api("/api/admin/nodns/me");
      connected(result.authenticated);
      message.textContent = result.username ? `Đã kết nối quản trị NoDNS: ${result.username}.` : "Phiên quản trị NoDNS đang hoạt động.";
    } catch (error) { connected(false); throw error; }
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(async () => {
      await api("/api/admin/nodns/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      form.elements.password.value = "";
      await me();
    });
  });
  panel.querySelector("#nodns-admin-me").addEventListener("click", () => run(me));
  logout.addEventListener("click", () => run(async () => {
    await api("/api/admin/nodns/logout", { method: "POST" });
    connected(false);
    message.textContent = "Đã đăng xuất quản trị NoDNS.";
    if (remoteAdmin) location.reload();
  }));
  if (remoteAdmin) run(me);
}
