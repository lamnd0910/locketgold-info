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

Trang `/thanh-toan/` có bốn bước: nhập thông tin, tự xác nhận Username, chọn gói và rà soát trước khi tạo đơn. Bước xác nhận gọi API public NoDNS để lấy UID, tên, ảnh đại diện và trạng thái Gold; lỗi tra cứu sẽ giữ khách ở bước nhập thông tin.

Sau khi tạo đơn, trang tự kiểm tra trạng thái mỗi 5 giây và tạm dừng khi tab bị ẩn. Gói Android mở hướng dẫn nhận APK qua Zalo và cài đặt khi SePay xác nhận thanh toán. Gói iOS chỉ mở hướng dẫn lên Gold khi API nâng cấp xác nhận hoàn tất; HTTP 200 hoặc phản hồi đang xử lý chưa được tính là hoàn tất.

Đơn khách lẻ có hạn thanh toán **10 phút từ lúc tạo**, lưu mốc `expires_at` trên máy chủ (migration `0008_order_payment_deadline.sql`). Trang hiển thị đồng hồ đếm ngược; đơn hết hạn ẩn QR và cho tạo đơn mới. Cron mỗi phút, API tra cứu và trang admin cập nhật đơn `pending` quá hạn thành `cancelled` với dấu `expired_at`. Các đơn đã nhận tiền hoặc hoàn tất không bị hủy theo thời gian. Webhook nhận sau hạn vẫn lưu giao dịch với kết quả `expired_order` để đối soát, không tự cấp Gold; cần liên hệ hỗ trợ nếu khách đã chuyển tiền.

Chế độ API tùy chỉnh cũ hỗ trợ JSON `{"status":"completed"}` hoặc `{"completed":true}`. Cần đối chiếu mẫu phản hồi thực tế của nhà cung cấp và chỉnh `worker/activation.js` trước khi kết nối API khác. API xử lý bất đồng bộ cần tích hợp thêm webhook hoặc tra cứu trạng thái theo tài liệu nhà cung cấp để chuyển đơn từ `paid` sang `completed`. Nội dung hướng dẫn sau mua nằm trong `src/post-purchase.js`; ảnh và nguyên văn hướng dẫn hoàn tất cần được cung cấp để thay nội dung iOS hiện tại.

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

Thông tin nhận tiền hiện cấu hình trong `wrangler.jsonc`: MB Bank, BIN `970422`, STK `5565662518`. QR động dùng `https://vietqr.app/img` theo tài liệu SePay, lấy số tiền cuối cùng sau giảm giá và nội dung là mã đơn từ API. CSP cho phép ảnh từ `vietqr.app`. Tên chủ tài khoản có thể bổ sung bằng `BANK_ACCOUNT_NAME` sau khi xác nhận.

Để xác nhận tự động, liên kết STK trên với SePay; tạo webhook **Có tiền vào**, chọn đúng tài khoản, URL `https://locketgold.info/api/sepay/webhook`, xác thực **API Key** bằng cùng khóa `SEPAY_WEBHOOK_API_KEY` của Worker. Cấu trúc mã thanh toán: tiền tố `LG`, hậu tố 8 ký tự chữ và số. Worker bỏ qua giao dịch khác tài khoản nhận; đơn thiếu tiền giữ trạng thái chờ. QR tự điền thông tin chuyển khoản; xác nhận đã nhận tiền vẫn cần webhook SePay thật. Không gửi webhook giả để đánh dấu đơn thật đã thanh toán.

Trong admin, mục **Giao dịch SePay** gọi `/api/admin/sepay` để xem 100 webhook mới nhất, tìm theo mã đơn/giao dịch/nội dung, lọc kết quả và kiểm tra cấu hình nhận tiền. Mục này tự cập nhật mỗi 15 giây khi mở. Webhook đã xác thực được ghi nhận cả khi không khớp đơn, thiếu tiền hoặc sai tài khoản; giao dịch trùng chỉ lưu một lần. Bản ghi trước migration `0004_sepay_event_status.sql` hiện là “Bản ghi cũ”, không suy đoán đã thanh toán. API chỉ dành cho phiên admin và không trả khóa webhook hoặc toàn bộ payload. Đây là lịch sử webhook website nhận được; không phải truy vấn trực tiếp lịch sử ngân hàng hoặc xác minh webhook đã bật trên SePay.

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

Admin → **Bài viết** có phần chèn ảnh từ máy tính (JPG/PNG/WebP, tối đa 20 MB trước tối ưu). Trình duyệt thu nhỏ cạnh dài tối đa 1600 px và chuyển sang WebP; Worker chỉ nhận ảnh tối đa 1 MB, kiểm tra định dạng và lưu BLOB trong `post_images` (migration `0007_post_images.sql`). Ảnh được chèn tại con trỏ bằng cú pháp `![mô tả](/api/images/UUID)` trên một dòng riêng. Trang bài viết chỉ render ảnh thuộc đường dẫn này; HTML hoặc URL ảnh ngoài được hiển thị như văn bản. Mô tả ảnh làm alt text và chú thích. Upload chỉ dành cho phiên admin; ảnh trong bài được phục vụ công khai trên cùng website.

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

- `buoc1.png`, `buoc2.png`: hình tham khảo tra cứu tài khoản/avatar. Luồng hiện tại lấy dữ liệu trực tiếp qua API NoDNS.
- `reference-images/buoc3.png`: chứa số tài khoản và QR thanh toán cố định; không được phục vụ trên web. Thông tin chuyển khoản phải lấy từ đơn thực tế.
- `buoc4.png`: mô tả kích hoạt tự động và hỗ trợ 24/7; chỉ dùng sau khi quy trình thực tế đáp ứng các cam kết này.
- `antoan.png`: chứa cam kết an toàn tuyệt đối 100%, chưa có cơ sở để công bố.
- `noapp.png`: còn chi tiết Doraemon, không phù hợp yêu cầu giao diện Hello Kitty.
- `anh1.png`, `huyhieu.png`: ảnh trang trí dự phòng, chưa cần cho bố cục hiện tại.

Các ảnh do chủ dự án cung cấp không phải tài sản chính thức của Locket Labs hoặc Sanrio.

## Kết nối API NoDNS

Trong admin → **API NoDNS → Đổi API key NoDNS**, nhập khóa mới rồi bấm **Kiểm tra và lưu API key**. Worker gọi `/api/v1/me` để xác nhận khóa; lỗi kiểm tra giữ khóa cũ. Khóa được mã hóa AES-GCM bằng `SESSION_SECRET` và lưu trong bảng riêng `provider_credentials` (migration `0006_provider_credentials.sql`). `NODNS_CREDENTIALS_ENABLED=true` bật việc đọc khóa này. Khóa lưu qua admin ưu tiên hơn `NODNS_API_KEY` trong Cloudflare; khi chưa lưu khóa qua admin, Cloudflare Secret vẫn được dùng. Mọi phản hồi chỉ trả thông tin tài khoản và nguồn cấu hình, không trả khóa hoặc dữ liệu mã hóa. Không thay `SESSION_SECRET` khi chưa chuẩn bị lưu lại khóa NoDNS và đăng nhập lại các phiên phụ thuộc secret này. Việc đổi key không chuyển quyền sở hữu Gold giữa các tài khoản NoDNS.

Đã đối chiếu [API admin/CTV](https://github.com/Duckcozy/api-admin-and-ctv), [API web chính](https://github.com/Duckcozy/api-web-ch-nh) và [demo admin](https://github.com/Duckcozy/trang-admin-demo). Các repo chứa tài liệu Postman và demo HTML.

`wrangler.jsonc` dùng `NODNS_API_BASE_URL=https://ctv.nodns.vn`, `NODNS_ADMIN_AUTH=false`, `ADMIN_USERNAME=admin` và `NODNS_CTV_PORTAL=true`.

- Admin website dùng `ADMIN_USERNAME` và secret `ADMIN_PASSWORD_SHA256`. Muốn dùng tài khoản NoDNS, đổi `NODNS_ADMIN_AUTH=true`; khi đó đăng nhập qua `/api/auth/login` và kiểm tra phiên qua `/api/auth/me`. Quản lý website vẫn dùng D1 của website.
- CTV đăng nhập qua `/api/ctv/auth/login`, xem tài khoản và lịch sử NoDNS. Tạo đơn gọi `/api/ctv/lookup` rồi `/api/ctv/upgrade`, sử dụng lượt NoDNS.
- Khách lẻ tra cứu tên, avatar và trạng thái Gold qua `/api/v1/userinfo` trước khi xác nhận tài khoản.
- Khi SePay xác nhận thanh toán, Worker gọi `/api/v1/grant` với `{user, days, note}`: tháng = 30 ngày, năm = 365 ngày, vĩnh viễn bỏ `days`. Chỉ `status=success` và `data.active=true` mới hoàn tất đơn. Lỗi hoặc phản hồi chờ giữ đơn ở `paid`, cần đối soát; Worker không tự gọi lại grant để tránh trừ lượt trùng.
- API cấp Gold áp dụng cho iOS. Android tiếp tục nhận APK qua Zalo.
- Link DNS lấy từ `/api/v1/profile` nếu có key và chưa cấu hình link riêng. Mục **API NoDNS** trong admin kiểm tra quota và lịch sử cấp Gold.

Cấu hình secrets:

```powershell
npx wrangler secret put SESSION_SECRET
npx wrangler secret put NODNS_API_KEY
```

`SESSION_SECRET` là chuỗi ngẫu nhiên riêng dài ít nhất 32 byte. Lấy `NODNS_API_KEY` tại **ctv.nodns.vn → Cài đặt** của tài khoản dùng cấp Gold cho khách lẻ. Key chỉ nằm trong Worker, gửi bằng header `x-api-key`. Cookie NoDNS được mã hóa AES-GCM và lưu trong cookie HttpOnly; không gửi API key hoặc cookie gốc trong JSON tới trình duyệt.

Vẫn cần D1 và các secrets SePay/ngân hàng cho đơn khách lẻ. Bài viết, giá bán, mã giảm giá và cấu hình website lưu trong D1. Tài liệu đã cung cấp chưa có API admin tạo tài khoản hoặc điều chỉnh số dư CTV NoDNS; mục CTV trong admin dẫn tới hệ thống NoDNS để quản lý.

Chạy local bằng hai terminal:

```powershell
Copy-Item .dev.vars.example .dev.vars
# Điền secrets trong .dev.vars, được gitignore.
npm run dev:api
```

```powershell
npm run dev
```

Vite proxy `/api` sang Worker local cổng 8787. Worker local vẫn gọi API NoDNS thật; cấp Gold có thể trừ lượt thật. Dùng tài khoản thử nghiệm khi kiểm tra.

Quay về tài khoản D1 cũ bằng `NODNS_CTV_PORTAL=false`, `NODNS_ADMIN_AUTH=false` và cấu hình `ADMIN_PASSWORD_SHA256`. Nhánh `UPSTREAM_API_URL`/`UPSTREAM_API_KEY` cũ chỉ dùng khi chưa có `NODNS_API_KEY`.

## JSON API dùng trong admin

Mục **Tài khoản quản trị** cho phép đổi tên đăng nhập và mật khẩu cục bộ sau khi xác thực mật khẩu hiện tại. Migration `0010_admin_credentials.sql` lưu mật khẩu băm PBKDF2 cùng mã phiên; bật `ADMIN_CREDENTIALS_ENABLED=true`. Khi đã lưu tài khoản trong D1, thông tin mới thay thế `ADMIN_USERNAME`/`ADMIN_PASSWORD_SHA256`; các phiên cũ bị vô hiệu hóa. Phiên đang lưu được cấp cookie mới. Để trống mật khẩu mới nếu chỉ đổi tên. Tài khoản NoDNS dùng xác thực bên ngoài phải đổi trên NoDNS.

Mục **Hủy Gold** trong admin tra cứu Username, yêu cầu xác nhận đúng tài khoản rồi gọi `POST /api/v1/cancel` bằng `NODNS_API_KEY` của website. Chỉ tài khoản thuộc key này mới hủy được; phiên admin NoDNS không thay thế API key. Lượt được hoàn hay không dựa trên phản hồi thực tế của NoDNS. Hủy Gold không hoàn tiền ngân hàng, không xóa lịch sử thanh toán. Migration `0005_gold_cancellations.sql` lưu lịch sử hủy và đánh dấu quyền Gold của đơn đã bị thu hồi để không tiếp tục hiển thị màn hình đã kích hoạt.

Collection admin tách từ **Proxy Admin API v2** mới được cung cấp: `public/downloads/admin.postman_collection.json`. Chỉ giữ nhóm **Auth - Admin**, gồm `POST /api/auth/login`, `POST /api/auth/logout` và `GET /api/auth/me`. Loại toàn bộ nhóm CTV, V1 dùng API key và public. Import vào Postman, gửi Login Admin trước; Postman lưu cookie để gọi Me/Logout. Không cần biến `apiKey`.

Trong `/quan-tri-locket/`, mở **Admin NoDNS** để tải JSON, kết nối tài khoản admin NoDNS, kiểm tra phiên và đăng xuất. Các route `/api/admin/nodns/login`, `/me`, `/logout` chỉ dành cho admin website đã đăng nhập; Worker gọi các endpoint nguồn bằng cookie phiên. Cookie NoDNS được mã hóa trong cookie HttpOnly, không trả về JSON. Cần `SESSION_SECRET`; không dùng `NODNS_API_KEY` cho các thao tác này.

Khi `NODNS_ADMIN_AUTH=false`, admin website đăng nhập bằng tài khoản cục bộ rồi kết nối NoDNS trong mục này. Khi `NODNS_ADMIN_AUTH=true`, dùng phiên NoDNS đã tạo lúc đăng nhập website; đăng xuất NoDNS tại đây cũng kết thúc phiên website. JSON mới chỉ cung cấp xác thực admin, chưa có API quản lý Gold hoặc tạo/chỉnh số dư CTV dành cho admin. Phần quản lý Gold vừa thêm từ file nhầm trước đó đã được gỡ; chức năng CTV và kích hoạt đơn mua có sẵn được giữ nguyên. Các bài kiểm tra dùng API giả lập.
