// Only the server's final order amount is used to build the bank transfer QR.
export function paymentQrUrl(order) {
  if (!/^[0-9]{6}$/.test(String(order.bank_bin || "")) || !/^[0-9]{6,20}$/.test(String(order.bank_account || "")) || !Number.isSafeInteger(order.amount) || order.amount <= 0 || !/^LG[A-Z0-9]{8}$/.test(order.transfer_content || "")) return "";
  const params = new URLSearchParams({ acc: order.bank_account, bank: order.bank_bin, amount: String(order.amount), des: order.transfer_content, template: "compact" });
  return `https://vietqr.app/img?${params}`;
}
