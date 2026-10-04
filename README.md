# Locket Gold — locketgold.info

Website nhiều trang cho `locketgold.info`, gồm giao diện bán gói, tải DNS, hướng dẫn, bài viết, cổng cộng tác viên, quản trị và API chạy trên Cloudflare Workers.

## Chạy local

```powershell
npm install
npm run dev
```

Kiểm tra bản production:

```powershell
npm run build
npm run preview
```

Nếu chưa gắn D1, toàn bộ trang công khai vẫn chạy; các thao tác tạo đơn, admin và CTV sẽ báo hệ thống chưa được cấu hình.

Giá mặc định dùng chung cho giao diện và API nằm trong `src/plans.js`. Sửa giá tại đây để bảng giá và bước thanh toán thống nhất. Khi đã gắn D1, giá trong cơ sở dữ liệu được ưu tiên; đổi giá qua trang quản trị. Migration `0003_sync_default_prices.sql` sửa các mức seed cũ về 69.000đ / 139.000đ / 99.000đ nếu chưa có giá khuyến mãi hoặc mức giá tùy chỉnh khác.

Trang `/thanh-toan/` có bốn bước: nhập thông tin, tự xác nhận Username, chọn gói và rà soát trước khi tạo đơn. Bước xác nhận chỉ hiển thị lại dữ liệu khách đã nhập; website chưa có API tra cứu tài khoản Locket nên không xác minh avatar hoặc trạng thái Gold.

Sau khi tạo đơn, trang tự kiểm tra trạng thái mỗi 5 giây và tạm dừng khi tab bị ẩn. Gói Android mở hướng dẫn nhận APK qua Zalo và cài đặt khi SePay xác nhận thanh toán. Gói iOS chỉ mở hướng dẫn lên Gold khi API nâng cấp xác nhận hoàn tất; HTTP 200 hoặc phản hồi đang xử lý chưa được tính là hoàn tất.

Hợp đồng phản hồi nâng cấp hiện hỗ trợ JSON `{"status":"completed"}` hoặc `{"completed":true}`. Cần đối chiếu mẫu phản hồi thực tế của nhà cung cấp và chỉnh `worker/activation.js` trước khi kết nối API khác. API xử lý bất đồng bộ cần tích hợp thêm webhook hoặc tra cứu trạng thái theo tài liệu nhà cung cấp để chuyển đơn từ `paid` sang `completed`. Nội dung hướng dẫn sau mua nằm trong `src/post-purchase.js`; ảnh và nguyên văn hướng dẫn hoàn tất cần được cung cấp để thay nội dung iOS hiện tại.

Trang `/huong-dan/` có bộ 4 bước tương tác và FAQ. Nội dung chuyển khoản luôn dẫn khách xem thông tin trên đơn thực tế, không hiển thị QR hoặc số tài khoản cố định từ ảnh minh họa.

## Khởi tạo Cloudflare D1

```powershell
npx wrangler d1 create locketgold-db
```

Cloudflare trả về `database_id`. Mở `wrangler.jsonc`, bỏ chú thích khối `d1_databases` và dán đúng ID, sau đó chạy:

```powershell
npx wrangler d1 migrations apply locketgold-db --remote
```

## Secrets và biến môi trường

Không ghi khóa bí mật vào repo. Cấu hình bằng Wrangler hoặc Cloudflare Dashboard:

```powershell
npx wrangler secret put ADMIN_PASSWORD_SHA256
npx wrangler secret put SESSION_SECRET
npx wrangler secret put SEPAY_WEBHOOK_API_KEY
npx wrangler secret put UPSTREAM_API_KEY
npx wrangler secret put BANK_NAME
npx wrangler secret put BANK_ACCOUNT
npx wrangler secret put BANK_ACCOUNT_NAME
```

- `ADMIN_PASSWORD_SHA256`: SHA-256 dạng hex của mật khẩu admin.
- `SESSION_SECRET`: chuỗi ngẫu nhiên dài tối thiểu 32 byte.
- `SEPAY_WEBHOOK_API_KEY`: API Key riêng dùng để SePay gọi webhook.
- `UPSTREAM_API_KEY`: khóa API kích hoạt Gold phía máy chủ; có thể bỏ qua cho tới khi có API.
- Thêm `UPSTREAM_API_URL` bằng secret hoặc nhập URL trong admin. API key không hiển thị trong admin.

Tạo SHA-256 trên Windows mà không gửi mật khẩu lên mạng:

```powershell
$securePassword = Read-Host "Mật khẩu admin" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($plainPassword))
    ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""
  } finally {
    $sha256.Dispose()
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $plainPassword = $null
}
```

## Cấu hình SePay

Trong SePay, tạo webhook cho giao dịch tiền vào:

- URL: `https://locketgold.info/api/sepay/webhook`
- Kiểu xác thực: `API Key`
- API key: cùng giá trị với secret `SEPAY_WEBHOOK_API_KEY`
- Content-Type: `application/json`

Worker xác thực header, chỉ nhận giao dịch tiền vào, kiểm tra số tiền, chống xử lý trùng bằng transaction ID và mới gọi API kích hoạt sau khi đơn được đánh dấu đã thanh toán.

## DNS, APK và API kích hoạt

Đăng nhập `/quan-tri-locket/` để cấu hình đường dẫn HTTPS tải DNS/APK, URL API kích hoạt và liên kết hỗ trợ. Đường dẫn riêng chỉ giảm khả năng bị dò thấy, không thay thế mật khẩu mạnh; khóa API và cấu hình SePay vẫn chỉ tồn tại trong Cloudflare Secrets. Sau khi cập nhật mã, áp dụng migration mới để bật trường giá cũ: `npx wrangler d1 migrations apply locketgold-db --remote` (nếu đã kết nối D1).

## Deploy

Cloudflare Git integration dùng:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

Deploy thủ công:

```powershell
npm run deploy
```

Sau khi build thành công, vào **Workers & Pages → locketgold-info → Domains & Routes** để gắn `locketgold.info` và `www.locketgold.info`.

## Cấu trúc chính

```text
├── admin/                 # trang quản trị
├── bai-viet/              # blog
├── cong-tac-vien/         # cổng CTV
├── huong-dan/             # hướng dẫn
├── len-gold/              # bảng giá
├── lien-he/               # liên hệ
├── tai-dns/               # tải và cài DNS
├── thanh-toan/            # tạo/tra cứu đơn
├── migrations/            # schema D1
├── public/                # asset tĩnh
├── src/                   # giao diện dùng chung
└── worker/                # API Worker
```

## Bộ ảnh chủ dự án cung cấp

15 tệp PNG từ thư mục Drive đã được lưu trong repo: 10 ảnh chưa tối ưu ở `public/images/`, 4 ảnh gốc ở `reference-images/` và ảnh chứa thông tin chuyển khoản mẫu cũng ở `reference-images/` để không được deploy công khai. Bốn ảnh đang dùng (`banner-locketpro`, `username`, `nodns`, `lienhe`) đã được nén thành WebP trong `public/images/` (tổng dung lượng từ 8,62 MB xuống 0,99 MB). Trang còn dùng `logo.png` ở phần nhận diện, `khunggold.png` ở phần giới thiệu và `khungavatar.png` ở trang bảng giá.

Các tệp còn lại được giữ để hoàn thiện nội dung sau khi xác nhận:

- `buoc1.png`, `buoc2.png`: hình mô tả tra cứu tài khoản/avatar qua API, trong khi website chưa có chức năng tra cứu này.
- `reference-images/buoc3.png`: chứa số tài khoản và QR thanh toán cố định; không được phục vụ trên web. Thông tin chuyển khoản phải lấy từ đơn thực tế.
- `buoc4.png`: mô tả kích hoạt tự động và hỗ trợ 24/7; chỉ dùng sau khi quy trình thực tế đáp ứng các cam kết này.
- `antoan.png`: chứa cam kết an toàn tuyệt đối 100%, chưa có cơ sở để công bố.
- `noapp.png`: còn chi tiết Doraemon, không phù hợp yêu cầu giao diện Hello Kitty.
- `anh1.png`, `huyhieu.png`: ảnh trang trí dự phòng, chưa cần cho bố cục hiện tại.

Các ảnh do chủ dự án cung cấp không phải tài sản chính thức của Locket Labs hoặc Sanrio.
