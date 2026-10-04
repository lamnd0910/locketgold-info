export function postPurchaseState(order) {
  const paid = order.status === "paid" || order.status === "completed";
  const completed = order.status === "completed";
  return {
    paid,
    completed,
    terminal: completed || ["failed", "cancelled"].includes(order.status),
    showApkGuide: paid && order.platform === "Android",
    showGoldGuide: completed && order.platform === "iOS",
    message: completed
      ? "✓ Đơn đã hoàn tất."
      : order.status === "paid"
        ? order.platform === "Android"
          ? "✓ Thanh toán đã được xác nhận. Nhận file APK qua Zalo theo hướng dẫn bên dưới."
          : "✓ SePay đã xác nhận thanh toán. Đang chờ hệ thống xác nhận nâng cấp Locket Gold…"
        : order.status === "failed"
          ? "Đơn chưa hoàn tất. Vui lòng liên hệ hỗ trợ kèm mã đơn."
          : order.status === "cancelled"
            ? "Đơn đã hủy. Vui lòng liên hệ hỗ trợ nếu bạn đã chuyển khoản."
            : "Đang chờ SePay xác nhận thanh toán. Trang sẽ tự cập nhật…",
  };
}

export function apkInstallationGuide() {
  return `<section class="after-payment installation-guide" aria-labelledby="apk-guide-title">
    <strong>✓ Thanh toán đã được xác nhận</strong>
    <h2 id="apk-guide-title">HƯỚNG DẪN CÀI LOCKET APK NHẬN QUA ZALO</h2>
    <p>Khách chỉ cần làm từng bước dưới đây.</p>
    <section><h3>🟢 BƯỚC 1: NHẬN VÀ TẢI FILE APK QUA ZALO</h3>
      <p>Mở Zalo và liên hệ hỗ trợ kèm mã đơn thanh toán trên website. File Locket APK sẽ được gửi trong Zalo sau khi thanh toán được xác nhận.</p>
      <p>Mở tin nhắn chứa file Locket APK, nhấn Tải xuống và chờ file tải hoàn tất. Nếu được gửi đường dẫn tải, mở bằng trình duyệt trên điện thoại, ví dụ Chrome hoặc Cốc Cốc, rồi nhấn Tải APK / Download APK.</p>
      <a class="button button--small" data-apk-zalo href="/lien-he/">Liên hệ Zalo để nhận file APK ↗</a>
    </section>
    <section><h3>🟢 BƯỚC 2: MỞ FILE APK</h3>
      <p>Sau khi tải xong, mở thông báo tải xuống hoặc vào Tệp / Files / Quản lý tệp → Download / Tải xuống.</p>
      <p>Tìm file APK vừa tải và nhấn vào file.</p>
      <p>Điện thoại có thể hiện thông báo: ⚠️ Không được phép cài đặt ứng dụng từ nguồn này.</p>
      <p>Đây là cảnh báo bảo mật của Android khi cài APK ngoài Google Play. Chỉ tiếp tục với file do hỗ trợ gửi cho đơn của bạn.</p>
    </section>
    <section><h3>🟢 BƯỚC 3: CHO PHÉP CÀI APK TỪ ỨNG DỤNG MỞ FILE</h3>
      <p>Nếu xuất hiện nút Cài đặt hoặc Cài đặt ứng dụng không xác định:</p>
      <ol><li>Nhấn Cài đặt.</li><li>Tìm mục Cho phép từ nguồn này.</li><li>Bật công tắc lên cho ứng dụng đang mở file (Zalo, trình duyệt hoặc Quản lý tệp).</li><li>Nhấn nút Quay lại để trở về màn hình cài đặt.</li></ol>
      <p>📌 Một số điện thoại có thể có tên hơi khác:</p>
      <ul><li>Cho phép cài đặt ứng dụng</li><li>Cho phép từ nguồn này</li><li>Cài đặt ứng dụng không xác định</li><li>Cho phép nguồn không xác định</li></ul>
    </section>
    <section><h3>🟢 BƯỚC 4: TIẾN HÀNH CÀI ĐẶT</h3>
      <ol><li>Nhấn lại vào file Locket APK vừa tải.</li><li>Chọn Cài đặt.</li><li>Chờ khoảng vài giây.</li><li>Khi hiện ✅ Ứng dụng đã được cài đặt, nhấn Mở.</li></ol>
    </section>
    <section><h3>🟢 BƯỚC 5: NẾU KHÔNG TÌM THẤY FILE APK</h3>
      <p>Nếu đã tải file nhưng không biết file nằm ở đâu:</p>
      <p><b>Cách 1:</b> Mở lại tin nhắn Zalo chứa file APK. Nếu tải bằng trình duyệt, mở trình duyệt → Tải xuống / Downloads → tìm file APK vừa tải.</p>
      <p><b>Cách 2:</b> Mở ứng dụng Quản lý tệp / Files / Tệp của tôi → Download / Tải xuống → tìm file có đuôi .apk.</p>
    </section>
    <section><h3>🔴 NẾU HIỆN “ỨNG DỤNG CHƯA ĐƯỢC CÀI ĐẶT”</h3>
      <p>Bạn thử lần lượt:</p>
      <ul><li>Kiểm tra điện thoại còn dung lượng trống không.</li><li>Xóa phiên bản Locket cũ nếu phiên bản APK yêu cầu thay thế.</li><li>Tải lại file APK được gửi trong Zalo hoặc đường dẫn hỗ trợ gửi.</li><li>Kiểm tra file APK đã tải đầy đủ chưa.</li><li>Khởi động lại điện thoại.</li><li>Thử cài đặt lại.</li></ul>
    </section>
  </section>`;
}

export function goldCompletionGuide() {
  return `<section class="after-payment installation-guide" aria-labelledby="gold-complete-title"><h2 id="gold-complete-title">✓ Đã nâng cấp Locket Gold</h2><p>Mở Locket, đăng xuất rồi đăng nhập lại nếu trạng thái Gold chưa cập nhật. Xem video hướng dẫn đoạn 1:12–1:59.</p><a class="button button--small" href="https://www.youtube.com/watch?v=JEEMLXXIrvE&t=72s" target="_blank" rel="noopener noreferrer">Xem hướng dẫn ↗</a></section>`;
}
