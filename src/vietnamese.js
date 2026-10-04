const orderStates = { pending: "Chờ thanh toán", paid: "Đã thanh toán · chờ kích hoạt", completed: "Hoàn tất", cancelled: "Đã hủy", canceled: "Đã hủy", failed: "Không thành công", processing: "Đang xử lý", success: "Thành công", approved: "Đã duyệt", rejected: "Đã từ chối" };
const goldStates = { active: "Đang hoạt động", expired: "Đã hết hạn", pending: "Chờ duyệt", none: "Chưa có Gold", inactive: "Chưa kích hoạt", cancelled: "Đã hủy", revoked: "Đã thu hồi" };
export const orderStatusLabel = status => orderStates[status] || "Chưa xác định";
export const goldStatusLabel = status => goldStates[status] || "Chưa xác định";
export const planNameLabel = name => ({ "1month": "Gói 1 tháng", "1year": "Gói 1 năm", lifetime: "Gói vĩnh viễn" }[name] || name);
