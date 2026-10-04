// Giá mặc định dùng chung cho giao diện và API.
// Khi đã cấu hình D1, giá lưu qua trang quản trị được ưu tiên.
export const DEFAULT_PLANS = [
  { id: "ios-month", name: "Gói 1 tháng", platform: "iOS", price: 29000, period: "1 tháng", featured: false },
  { id: "ios-year", name: "Gói 1 năm", platform: "iOS", price: 69000, period: "1 năm", featured: false },
  { id: "ios-lifetime", name: "Gói vĩnh viễn", platform: "iOS", price: 139000, period: "trọn đời", featured: true },
  { id: "android-lifetime", name: "Gói vĩnh viễn", platform: "Android", price: 99000, period: "trọn đời", featured: false },
];
