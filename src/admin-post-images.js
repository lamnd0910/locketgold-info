export function initPostImages(dash, api) {
  const form = dash.querySelector('form[data-admin-endpoint="/api/admin/posts"]');
  const textarea = form.elements.content;
  const toolbar = document.createElement("div");
  toolbar.className = "post-image-upload";
  toolbar.innerHTML = `<label>Mô tả ảnh (tùy chọn)<input data-post-image-alt maxlength="160" placeholder="Ví dụ: Các bước cài đặt DNS trên iPhone"></label><label>Chèn ảnh vào nội dung<input data-post-image-file type="file" accept="image/jpeg,image/png,image/webp"></label><p>Chọn ảnh JPG, PNG hoặc WebP. Ảnh được tối ưu tự động và chèn tại vị trí con trỏ trong nội dung.</p><p data-post-image-message class="post-image-feedback" role="status"></p><div data-post-image-preview hidden></div>`;
  textarea.parentElement.after(toolbar);
  const picker = toolbar.querySelector("[data-post-image-file]");
  const feedback = toolbar.querySelector("[data-post-image-message]");
  const preview = toolbar.querySelector("[data-post-image-preview]");
  const publish = form.querySelector('button:not([type="button"])');
  form.addEventListener("submit", (event) => {
    if (picker.disabled) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, { capture: true });
  picker.addEventListener("change", async () => {
    const file = picker.files[0]; if (!file) return;
    const start = textarea.selectionStart, end = textarea.selectionEnd;
    picker.disabled = true; textarea.disabled = true; publish.disabled = true;
    feedback.textContent = "Đang tối ưu và tải ảnh lên…";
    let bitmap;
    try {
      if (file.size > 20 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Chọn ảnh JPG, PNG hoặc WebP tối đa 20 MB.");
      bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", .84));
      if (!blob || blob.size > 1024 * 1024) throw new Error("Ảnh sau tối ưu vẫn quá lớn. Hãy chọn ảnh nhỏ hơn.");
      const { url } = await api("/api/admin/images", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      const alt = toolbar.querySelector("[data-post-image-alt]").value.trim().replace(/[\[\]\r\n]/g, " ");
      const marker = `\n\n![${alt}](${url})\n\n`;
      if (textarea.value.length - (end - start) + marker.length > 20000) throw new Error("Nội dung bài viết vượt quá 20.000 ký tự. Rút gọn nội dung trước khi chèn ảnh.");
      textarea.setRangeText(marker, start, end, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      preview.replaceChildren();
      const img = document.createElement("img"); img.src = url; img.alt = alt; preview.append(img); preview.hidden = false;
      feedback.textContent = "Đã chèn ảnh. Bấm Xuất bản để đăng bài viết kèm ảnh.";
    } catch (error) { feedback.textContent = error.message; }
    finally { bitmap?.close(); picker.value = ""; picker.disabled = false; textarea.disabled = false; publish.disabled = false; }
  });
  form.addEventListener("reset", () => { preview.hidden = true; preview.replaceChildren(); feedback.textContent = ""; });
}
