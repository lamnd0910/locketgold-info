import { DEFAULT_WELCOME, validateWelcome, welcomeMarkup } from "./welcome-notice.js";
export function addAdminWelcome(dash, api) {
  const panel = document.createElement("section");
  panel.id = "welcome-admin";
  panel.className = "admin-panel";
  panel.innerHTML = `<h2>Thông báo khi vào trang</h2><p>Thông báo mới sẽ hiện lại cho khách dù đã đóng phiên bản trước. Để trống cả tên và đường dẫn để ẩn một nút.</p><form><label class="consent"><input name="enabled" type="checkbox"> Bật thông báo</label><label>Tần suất hiển thị<select name="display_policy"><option value="session">Một lần trong mỗi phiên truy cập</option><option value="visit">Mỗi lần mở hoặc tải lại trang</option></select></label>${[["badge","Dòng nhãn phía trên",100],["title","Tiêu đề",140]].map(([name,label,max])=>`<label>${label}<input name="${name}" maxlength="${max}" ${name === "title" ? "required" : ""}></label>`).join("")}<label>Nội dung<textarea name="content" rows="5" maxlength="2000" required></textarea></label>${["primary","secondary"].map((name,i)=>`<div class="form-row"><label>Tên nút ${i+1}<input name="${name}_label" maxlength="60"></label><label>Đường dẫn nút ${i+1}<input name="${name}_url" maxlength="500" placeholder="/len-gold/ hoặc https://..."></label></div>`).join("")}<button class="button" type="submit" disabled>Lưu thông báo</button><button class="button button--outline" type="button" data-preview>Xem trước</button><p class="form-message" role="status"></p></form><dialog class="welcome-modal" aria-label="Xem trước thông báo"></dialog>`;
  dash.querySelector(".admin-main").append(panel);
  const link = document.createElement("a"); link.href = "#welcome-admin"; link.textContent = "🔔 Thông báo khi vào trang";
  dash.querySelector(".admin-sidebar nav").append(link);
  const form = panel.querySelector("form"), message = form.querySelector(".form-message"), save = form.querySelector('[type="submit"]'), preview = panel.querySelector("dialog");
  const fill = notice => { for (const key of Object.keys(DEFAULT_WELCOME)) { const input = form.elements.namedItem(key); if (input) key === "enabled" ? input.checked = notice[key] : input.value = notice[key]; } };
  const values = () => validateWelcome({ ...Object.fromEntries(new FormData(form)), enabled: form.elements.enabled.checked });
  fill(DEFAULT_WELCOME);
  api("/api/admin/welcome").then(notice => { fill(notice); save.disabled = false; }).catch(error => { message.textContent = error.message; message.className = "form-message is-error"; });
  form.querySelector("[data-preview]").addEventListener("click", () => {
    try { preview.innerHTML = welcomeMarkup(values()); preview.querySelector(".modal-close").onclick = () => preview.close(); preview.querySelectorAll("a").forEach(a => a.onclick = event => event.preventDefault()); preview.showModal(); }
    catch(error) { message.textContent = error.message; message.className = "form-message is-error"; }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (save.disabled) return;
    try { const notice = values(); save.disabled = true; const result = await api("/api/admin/welcome", { method: "POST", body: JSON.stringify(notice) }); message.textContent = result.message; message.className = "form-message is-success"; }
    catch(error) { message.textContent = error.message; message.className = "form-message is-error"; }
    finally { save.disabled = false; }
  });
}
