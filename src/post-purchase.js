export function postPurchaseState(order) {
  const paid = order.status === "paid" || order.status === "completed";
  const completed = order.status === "completed";
  const revoked = Boolean(order.gold_revoked_at);
  return {
    paid,
    completed,
    terminal: revoked || completed || ["failed", "cancelled"].includes(order.status),
    showApkGuide: paid && !revoked && order.platform === "Android",
    showGoldGuide: completed && !revoked && order.platform === "iOS",
    message: order.expired_at ? "Đơn đã hết hạn thanh toán sau 10 phút. Vui lòng tạo đơn mới; nếu đã chuyển tiền, liên hệ hỗ trợ kèm mã đơn để đối soát." : revoked ? "Quyền Locket Gold của đơn này đã được hủy. Vui lòng liên hệ hỗ trợ kèm mã đơn nếu cần đối soát." : completed
      ? "✓ Đơn đã hoàn tất."
      : order.status === "paid"
        ? order.platform === "Android"
          ? "✓ Thanh toán đã được xác nhận. Tải tệp APK và cài đặt theo hướng dẫn bên dưới."
          : "✓ SePay đã xác nhận thanh toán. Đang chờ hệ thống xác nhận nâng cấp Locket Gold…"
        : order.status === "failed"
          ? "Đơn chưa hoàn tất. Vui lòng liên hệ hỗ trợ kèm mã đơn."
          : order.status === "cancelled"
            ? "Đơn đã hủy. Vui lòng liên hệ hỗ trợ nếu bạn đã chuyển khoản."
            : "Đang chờ SePay xác nhận thanh toán. Trang sẽ tự cập nhật…",
  };
}

export function apkInstallationGuide(order = {}) {
  const downloadUrl = /^LG[A-Z0-9]{8}$/.test(order.code || "") ? `/api/orders/${order.code}/apk` : "";
  return `<section class="after-payment installation-guide" aria-labelledby="apk-guide-title">
    <strong>✓ Thanh toán đã được xác nhận</strong>
    <h2 id="apk-guide-title">HƯỚNG DẪN TẢI VÀ CÀI LOCKET APK</h2>
    <p>Khách chỉ cần làm từng bước dưới đây.</p>
    <section><h3>🟢 BƯỚC 1: TẢI TỆP APK</h3>
      <p>Nhấn nút bên dưới để tải LocketGold.website.apk (khoảng 148 MB). Chờ tệp tải hoàn tất trước khi cài đặt.</p>
      ${downloadUrl ? `<a class="button" data-apk-download href="${downloadUrl}" download="LocketGold.website.apk">Tải Locket APK ↓</a>` : ""}
      <p>Nếu tải bằng trình duyệt trong ứng dụng gặp lỗi, hãy mở trang đơn này bằng Chrome hoặc Cốc Cốc để tải lại.</p>
      <a class="button button--small button--outline" data-apk-zalo href="/lien-he/">Liên hệ Zalo nếu cần hỗ trợ ↗</a>
    </section>
    <section><h3>🟢 BƯỚC 2: MỞ TỆP APK</h3>
      <p>Sau khi tải xong, mở thông báo tải xuống hoặc vào Tệp / Quản lý tệp → Tải xuống.</p>
      <p>Tìm tệp APK vừa tải và nhấn vào tệp.</p>
      <p>Điện thoại có thể hiện thông báo: ⚠️ Không được phép cài đặt ứng dụng từ nguồn này.</p>
      <p>Đây là cảnh báo bảo mật của Android khi cài APK ngoài Google Play. Sử dụng tệp vừa tải từ trang đơn của bạn.</p>
    </section>
    <section><h3>🟢 BƯỚC 3: CHO PHÉP CÀI APK TỪ ỨNG DỤNG MỞ TỆP</h3>
      <p>Nếu xuất hiện nút Cài đặt hoặc Cài đặt ứng dụng không xác định:</p>
      <ol><li>Nhấn Cài đặt.</li><li>Tìm mục Cho phép từ nguồn này.</li><li>Bật công tắc lên cho ứng dụng đang mở tệp (Zalo, trình duyệt hoặc Quản lý tệp).</li><li>Nhấn nút Quay lại để trở về màn hình cài đặt.</li></ol>
      <p>📌 Một số điện thoại có thể có tên hơi khác:</p>
      <ul><li>Cho phép cài đặt ứng dụng</li><li>Cho phép từ nguồn này</li><li>Cài đặt ứng dụng không xác định</li><li>Cho phép nguồn không xác định</li></ul>
    </section>
    <section><h3>🟢 BƯỚC 4: TIẾN HÀNH CÀI ĐẶT</h3>
      <ol><li>Nhấn lại vào tệp Locket APK vừa tải.</li><li>Chọn Cài đặt.</li><li>Chờ khoảng vài giây.</li><li>Khi hiện ✅ Ứng dụng đã được cài đặt, nhấn Mở.</li></ol>
    </section>
    <section><h3>🟢 BƯỚC 5: NẾU KHÔNG TÌM THẤY TỆP APK</h3>
      <p>Nếu đã tải tệp nhưng không biết tệp nằm ở đâu:</p>
      <p><b>Cách 1:</b> Mở trình duyệt → Tải xuống → tìm tệp LocketGold.website.apk vừa tải.</p>
      <p><b>Cách 2:</b> Mở ứng dụng Quản lý tệp / Tệp của tôi → Tải xuống → tìm tệp có đuôi .apk.</p>
    </section>
    <section><h3>🔴 NẾU HIỆN “ỨNG DỤNG CHƯA ĐƯỢC CÀI ĐẶT”</h3>
      <p>Bạn thử lần lượt:</p>
      <ul><li>Kiểm tra điện thoại còn dung lượng trống không.</li><li>Xóa phiên bản Locket cũ nếu phiên bản APK yêu cầu thay thế.</li><li>Quay lại trang đơn và nhấn Tải Locket APK để tải lại.</li><li>Kiểm tra tệp APK đã tải đầy đủ chưa.</li><li>Khởi động lại điện thoại.</li><li>Thử cài đặt lại.</li></ul>
    </section>
  </section>`;
}

export function goldCompletionGuide(order = {}) {
  if (order.gold_revoked_at || order.platform !== "iOS" || !["paid", "completed"].includes(order.status)) return "";
  const completed = order.status === "completed";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", '"': "&quot;", "'": "&#39;", ">": "&gt;" }[char]));
  return `<section class="gold-success" aria-labelledby="gold-complete-title">
    <div class="gold-success-check" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="m13 24 8 8 15-17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <span class="gold-success-label">ĐÃ XÁC NHẬN THANH TOÁN</span>
    <h2 id="gold-complete-title">Thanh Toán Thành Công! <span aria-hidden="true">🎉</span></h2>
    <div class="gold-success-account"><span>Tài khoản: <b>@${esc(order.username)}</b></span><span>Gói: <b>${esc(order.plan_name)}</b></span></div>
    ${completed ? `<p class="gold-success-description">Tài khoản đã được hệ thống kích hoạt quyền sở hữu<br><strong>✦ LOCKET GOLD ✦</strong></p>
    <a class="gold-success-dns" data-gold-dns href="/tai-dns/"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Cài Đặt DNS Ngay (iOS)</a>
    <div class="gold-success-instructions"><h3>ⓘ HƯỚNG DẪN HOÀN TẤT TRÊN IPHONE</h3><ol>
      <li><span>1</span><p>Bấm nút <b>“Cài Đặt DNS Ngay”</b> bên trên (mở bằng Safari) → chọn <b>Cho phép</b> tải về hồ sơ cấu hình.</p></li>
      <li><span>2</span><p>Mở <b>Cài đặt</b> trên iPhone → nhấn <b>Đã tải về hồ sơ</b> → bấm <b>Cài đặt</b>.</p></li>
      <li><span>3</span><p>Vào <b>Cài đặt chung → Giới thiệu → Cài đặt tin cậy chứng chỉ</b> → bật công tắc của chứng chỉ vừa cài.</p></li>
      <li><span>4</span><p>Vuốt tắt hẳn ứng dụng Locket và mở lại để tận hưởng huy hiệu <b>Locket Gold</b>!</p></li>
    </ol></div>` : `<div class="gold-success-wait" role="status"><span class="gold-success-spinner" aria-hidden="true"></span><p>Đã nhận thanh toán. Hệ thống đang xác nhận kích hoạt Locket Gold.<br>Trang sẽ tự cập nhật khi hoàn tất.</p></div>`}
    ${completed ? `<p class="gold-success-note"><strong>Lưu ý:</strong> sau khi làm hết các bước trên thì xoá tải lại để quay 15s</p>` : ""}
    <a class="gold-success-home" href="/">⌂ Quay Lại Trang Chủ</a>
    <p class="gold-success-order">Mã đơn: ${esc(order.code)} · <a href="/lien-he/">Liên hệ hỗ trợ</a></p>
  </section>`;
}
