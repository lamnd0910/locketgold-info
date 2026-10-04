export function paymentTimeLeft(expiresAt, now = Date.now()) {
  const deadline = Date.parse(expiresAt);
  return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
}

export function mountPaymentDeadline(container, order, onExpire) {
  const seconds = paymentTimeLeft(order.expires_at);
  if (seconds == null) return () => {};
  const box = document.createElement("p");
  box.className = "payment-deadline";
  container.querySelector("h2").after(box);
  let interval;
  const update = () => {
    const left = paymentTimeLeft(order.expires_at);
    box.textContent = left > 0 ? `Thời gian thanh toán còn lại: ${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}` : "Đã hết thời gian thanh toán. Đang kiểm tra trạng thái đơn…";
    box.classList.toggle("is-expiring", left <= 60);
    if (left === 0) {
      window.clearInterval(interval);
      const qr = container.querySelector(".payment-qr"); if (qr) qr.hidden = true;
      onExpire();
    }
  };
  interval = window.setInterval(update, 1000);
  update();
  return () => { window.clearInterval(interval); box.hidden = true; };
}
