import "./styles.css";
import { normalizeUsername, parsePastedUsername } from "./username.js";
import { DEFAULT_PLANS as fallbackPlans } from "./plans.js";
import { postPurchaseState, apkInstallationGuide, goldCompletionGuide } from "./post-purchase.js";
import { addAdminNoDns } from "./admin-nodns.js";
import { paymentQrUrl } from "./payment.js";
import { addAdminSepay } from "./admin-sepay.js";
import { addAdminGold } from "./admin-gold.js";
import { addProviderKeyForm } from "./admin-provider-key.js";
import { initPostImages } from "./admin-post-images.js";
import { renderPostContent } from "./post-content.js";
import { mergePostArchive, postArchivePage } from "./post-archive.js";
import { postForDisplay } from "./post-brand.js";
import { mountPaymentDeadline } from "./payment-deadline.js";
import { addAdminAccount } from "./admin-account.js";
import { addAdminWelcome } from "./admin-welcome.js";
import { addAdminPromos } from "./admin-promos.js";
import { welcomeMarkup, shouldShowWelcome } from "./welcome-notice.js";
import { orderStatusLabel, goldStatusLabel, planNameLabel } from "./vietnamese.js";

const defaultDnsUrl = "https://ctv.nodns.vn/cai-dns";

const page = document.body.dataset.page || "home";
const app = document.querySelector("#app");

const navItems = [
  ["home", "/", "Trang chủ", "⌂"],
  ["pricing", "/len-gold/", "Lên Gold", "♛"],
  ["trust", "/uy-tin/", "Uy tín", "✧"],
  ["posts", "/bai-viet/", "Bài viết", "▤"],
  ["guide", "/huong-dan/", "Hướng dẫn", "▣"],
  ["ctv", "/cong-tac-vien/", "Cộng tác viên", "♙"],
  ["contact", "/lien-he/", "Liên hệ", "☎"],
];

const fallbackPosts = [
  { slug: "bao-ve-tai-khoan", title: "Ba nguyên tắc bảo vệ tài khoản Locket", excerpt: "Không chia sẻ mật khẩu, OTP và luôn kiểm tra đúng Tên người dùng trước khi xác nhận.", published_at: "2026-09-30", content: "1. Giữ riêng mật khẩu và OTP\nChỉ nhập Tên người dùng khi đặt gói. Không cung cấp mật khẩu, mã OTP hoặc mã khôi phục cho người khác, kể cả người tự nhận là nhân viên hỗ trợ.\n2. Kiểm tra địa chỉ trang web\nHãy đặt gói và theo dõi đơn tại locketgold.info. Kiểm tra tên miền trên thanh địa chỉ trước khi nhập thông tin hoặc chuyển khoản.\n3. Đối chiếu Tên người dùng và mã đơn\nMở Locket để kiểm tra chính xác Tên người dùng. Sau khi tạo đơn, giữ lại mã đơn và đối chiếu số tiền cùng nội dung chuyển khoản trên trang thanh toán. Khi cần hỗ trợ, gửi mã đơn qua các kênh ở trang Liên hệ." },
  { slug: "kiem-tra-sau-nang-cap", title: "Cách kiểm tra sau khi nâng cấp Gold", excerpt: "Các bước ngắn gọn giúp bạn xác nhận trạng thái trên ứng dụng một cách an toàn.", published_at: "2026-09-29", content: "Kiểm tra trạng thái đơn\nSau khi chuyển khoản, giữ trang thanh toán và bấm Kiểm tra thanh toán. Đối chiếu mã đơn, số tiền và nội dung chuyển khoản nếu đơn chưa được ghi nhận.\nKiểm tra trong ứng dụng\nKhi đơn được báo hoàn tất, mở lại Locket bằng đúng tài khoản đã đặt gói. Kiểm tra quyền lợi Gold trong phần tài khoản hoặc cài đặt của ứng dụng; vị trí hiển thị có thể khác theo phiên bản.\nNếu quyền lợi chưa xuất hiện\nĐóng rồi mở lại ứng dụng và kiểm tra kết nối mạng. Nếu vẫn chưa thấy, liên hệ hỗ trợ kèm mã đơn, Tên người dùng và ảnh màn hình. Không gửi mật khẩu hoặc OTP.\nGiữ lại thông tin đơn\nLưu mã đơn và xác nhận thanh toán để có thể đối soát khi cần hỗ trợ về sau." },
  { slug: "chon-goi-phu-hop", title: "Nên chọn gói Gold nào?", excerp1t: "So sánh thời hạn và nền tảng để chọn đúng gói cho thiết bị đang sử dụng.", published_at: "2026-09-28", content: "Chọn đúng nền tảng\nTrước tiên, xác định bạn đang dùng iPhone (iOS) hay Android. Chọn gói tương ứng với thiết bị và đọc hướng dẫn dành cho nền tảng đó trước khi thanh toán.\nGói 1 tháng\nPhù hợp khi bạn muốn thử trải nghiệm trong thời gian ngắn. Kiểm tra giá và thời hạn đang hiển thị trên bảng giá.\nGói 1 năm\nPhù hợp khi bạn dự định dùng lâu hơn. So sánh tổng chi phí với lựa chọn theo tháng trước khi quyết định.\nGói vĩnh viễn\nĐọc rõ quyền lợi và điều kiện áp dụng của gói. Nếu chưa rõ ý nghĩa thời hạn hoặc khả năng hỗ trợ khi đổi thiết bị, hỏi qua trang Liên hệ trước khi đặt.\nKiểm tra lần cuối\nỞ bước rà soát đơn, đối chiếu nền tảng, thời hạn, Tên người dùng và số tiền. Giá trên đơn là mức giá cần kiểm tra trước khi chuyển khoản." },
];

// Reference screenshots for the image gallery.
const feedbackImages = [
  { src: "/images/feedback-reference/locketpro-1.jpeg", caption: "Ảnh tham khảo 01" },
  { src: "/images/feedback-reference/locketpro-2.jpeg", caption: "Ảnh tham khảo 02" },
  { src: "/images/feedback-reference/locketpro-3.webp", caption: "Ảnh tham khảo 03" },
  { src: "/images/feedback-reference/locketpro-4.webp", caption: "Ảnh tham khảo 04" },
];

function feedbackGallery() {
  const items = feedbackImages.length ? feedbackImages : Array.from({ length: 4 }, (_, index) => ({ caption: `Ảnh phản hồi ${String(index + 1).padStart(2, "0")}` }));
  return `<section class="section section--compact"><div class="container"><div class="section-heading"><span class="eyebrow">Hình ảnh tham khảo</span><h2>Phản hồi và trải nghiệm</h2></div><div class="feedback-grid">${items.map((item) => `<article class="feedback-card">${item.src ? `<button class="feedback-image" type="button" data-feedback-src="${escapeHtml(item.src)}" data-feedback-caption="${escapeHtml(item.caption)}" aria-label="Xem đầy đủ ${escapeHtml(item.caption)}"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.caption)}" loading="lazy" decoding="async"></button>` : '<div class="feedback-placeholder"><span aria-hidden="true">▧</span><span>Đang cập nhật ảnh</span></div>'}</article>`).join("")}</div></div></section><dialog id="feedback-viewer" class="feedback-viewer" aria-label="Xem ảnh phản hồi"><button class="modal-close" type="button" aria-label="Đóng ảnh">×</button><img alt=""><p></p></dialog>`;
}

function navIcon(key) {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    pricing: '<path d="m3 6 4 4 5-7 5 7 4-4-3 12H6z"/><path d="M6 21h12"/>',
    trust: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    posts: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    guide: '<path d="M12 5v16M3 4h5l4 2 4-2h5v15h-5l-4 2-4-2H3z"/>',
    ctv: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
    contact: '<path d="M4 13v-1a8 8 0 0 1 16 0v1M20 17v2a2 2 0 0 1-2 2h-4"/><rect x="2" y="12" width="4" height="7" rx="2"/><rect x="18" y="12" width="4" height="7" rx="2"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[key]}</svg>`;
}

const money = (value) => `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function brand(isHeader = false) {
  if (isHeader) {
    return `<a class="brand brand--header" href="/" aria-label="Locket Gold - Trang chủ">
      <img class="header-brand-image" src="/images/locket-gold-brand.png" alt="Locket Gold - locketgold.info" width="562" height="167" decoding="async">
    </a>`;
  }
  return `<a class="brand" href="/" aria-label="Locket Gold - Trang chủ">
    <img class="brand-image" src="/images/logo.png" alt="" width="60" height="40" decoding="async">
    <span><strong>Locket Gold</strong><small>locketgold.info</small></span>
  </a>`;
}

function header() {
  const links = navItems.map(([key, href, label]) => `<a href="${href}" class="${page === key ? "is-active" : ""} ${key === "pricing" ? "nav-link--gold" : ""}" ${page === key ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${navIcon(key)}</span><span>${label}</span>${key === "pricing" ? '<em>BÁN CHẠY</em>' : ""}</a>`).join("");
  return `<header class="site-header"><div class="container nav-wrap">${brand(true)}
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Mở menu"><span></span><span></span><span></span></button>
    <nav class="main-nav" id="main-nav" aria-label="Điều hướng chính"><div class="nav-drawer-heading"><div><strong>Khám phá Locket Gold</strong><small>locketgold.info</small></div><button class="nav-close" type="button" aria-label="Đóng menu">×</button></div>${links}</nav>
    <a class="button button--dns" href="/tai-dns/">↓ Tải DNS</a>
  </div><button class="nav-backdrop" type="button" aria-label="Đóng menu" tabindex="-1" hidden></button></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container footer-grid">
    <div>${brand()}<p>Dịch vụ độc lập, giao diện thân thiện và quy trình không yêu cầu mật khẩu hay OTP.</p></div>
    <div><strong>Khám phá</strong><a href="/len-gold/">Bảng giá</a><a href="/huong-dan/">Hướng dẫn</a><a href="/bai-viet/">Bài viết</a></div>
    <div><strong>Hỗ trợ</strong><a href="/tai-dns/">Tải DNS</a><a href="/lien-he/">Liên hệ</a><a href="/uy-tin/">Chính sách an toàn</a></div>
  </div><div class="container footer-bottom"><span>© <span id="current-year"></span> Locket Gold</span><span>Không liên kết hoặc đại diện cho Locket Labs, Inc.</span></div></footer>`;
}

function publicShell(content) {
  return `<a class="skip-link" href="#noi-dung">Chuyển đến nội dung chính</a>${header()}<main id="noi-dung">${content}</main>${footer()}<a class="floating-support" href="/lien-he/" aria-label="Liên hệ hỗ trợ"><img src="/images/lienhe-transparent.png" alt="Liên hệ hỗ trợ" width="2048" height="768" decoding="async"></a><div id="activity-toast" class="activity-toast" hidden></div><dialog id="welcome-modal" class="welcome-modal" aria-labelledby="welcome-title">${welcomeMarkup()}</dialog>`;
}

function pageHero(kicker, title, description) {
  return `<section class="page-hero"><div class="container"><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div></section>`;
}

function planCards(plans = fallbackPlans) {
  return `<div class="pricing-grid pricing-grid--four">${plans.map((plan) => `<article class="price-card ${plan.featured ? "price-card--featured" : ""}">
    ${plan.featured ? '<span class="popular-ribbon">Khuyên dùng</span>' : ""}
    <span class="plan-platform">${escapeHtml(plan.platform)}</span><h2>${escapeHtml(plan.name)}</h2>
    <p class="price">${Number(plan.old_price) > Number(plan.price) ? `<del>${money(plan.old_price)}</del>` : ""}<strong>${money(plan.price)}</strong><span>/ ${escapeHtml(plan.period)}</span></p>
    ${String(plan.platform).toLowerCase() === "ios" ? `<ul><li>✓ Mở khóa Locket Gold</li><li>✓ Không quảng cáo</li><li>✓ Upload ảnh từ thư viện</li><li>✓ Quay video Lockets 15s</li><li>✓ Xem những ai đã xem Lockets của bạn</li><li>✓ Thay đổi icon Locket</li><li>✓ Mở khóa giới hạn bạn bè</li><li class="plan-feature--unavailable">✕ Huy hiệu Locket Gold</li></ul>` : `<ul><li>✓ Bản cài đặt riêng cho điện thoại Android</li><li>✓ Mở khóa full tính năng Locket Gold cao cấp</li><li>✓ Kỹ thuật viên Admin hỗ trợ cài đặt 1-1</li><li>✓ Bảo hành uy tín, hỗ trợ 24/7</li><li>✓ Kích hoạt nhanh chóng qua Zalo / Telegram</li></ul>`}
    <a class="button ${plan.featured ? "" : "button--outline"}" href="/thanh-toan/?plan=${encodeURIComponent(plan.id)}">Chọn gói này</a>
  </article>`).join("")}</div>`;
}

function checkoutPlanOptions(plans, selectedId) {
  return plans.map((plan) => `<label class="checkout-plan"><input type="radio" name="plan_id" value="${escapeHtml(plan.id)}" ${plan.id === selectedId ? "checked" : ""}>
    <span><b>${escapeHtml(plan.platform)} · ${escapeHtml(plan.name)}</b><small>${escapeHtml(plan.period)}</small></span><strong>${money(plan.price)}</strong>
  </label>`).join("");
}

function heroBow() {
  return '<svg viewBox="0 0 48 40" fill="none"><path d="M21 19C10 0 3 4 4 18c-1 13 9 16 18 6M27 20C37 5 46 9 43 23c-1 12-11 12-17 3" fill="#ff83b6" stroke="#b82d69" stroke-width="2.5"/><path d="m11 13 7 7m16-4-5 6" stroke="#f64b93" stroke-width="3" stroke-linecap="round"/><ellipse cx="24" cy="23" rx="7" ry="8" fill="#ff5b9d" stroke="#b82d69" stroke-width="2.5"/></svg>';
}

function heroHeart() {
  return '<svg viewBox="0 0 40 40"><path d="M20 34S3 24 3 13C3 3 16 2 20 11 24 2 37 3 37 13c0 11-17 21-17 21Z" fill="#ff91bd" stroke="#d54482" stroke-width="2.5"/><path d="M9 14c0-4 3-6 6-5" fill="none" stroke="#ffd5e7" stroke-width="3" stroke-linecap="round"/></svg>';
}

const pages = {
  home: () => publicShell(`<section class="hero"><div class="container hero-grid">
    <div class="hero-copy"><span class="eyebrow"><span aria-hidden="true">♡</span> Không cần chia sẻ mật khẩu<span class="hero-bow hero-bow--badge" aria-hidden="true">${heroBow()}</span></span><h1><span class="hero-title-line">Nâng trải nghiệm</span><span class="hero-title-line"><span class="hero-title-gold">Locket Gold<span class="hero-bow hero-bow--title" aria-hidden="true">${heroBow()}</span>,</span> giữ</span><span class="hero-title-line">trọn khoảnh khắc</span><span class="hero-heart hero-heart--one" aria-hidden="true">${heroHeart()}</span><span class="hero-heart hero-heart--two" aria-hidden="true">${heroHeart()}</span><span class="hero-heart hero-heart--three" aria-hidden="true">${heroHeart()}</span></h1><p>Chọn gói, nhập Tên người dùng và theo dõi đơn trên web. Hỗ trợ iPhone và Android.</p><div class="hero-actions"><a class="button" href="/len-gold/"><span class="hero-bow hero-bow--button" aria-hidden="true">${heroBow()}</span>Chọn gói Gold →</a><a class="button button--outline" href="/huong-dan/">Xem hướng dẫn <span class="hero-button-heart" aria-hidden="true">♥</span></a></div><div class="safe-note"><b>✓</b><span><strong>Quyền riêng tư là ưu tiên</strong><small>Không nhập mật khẩu, OTP hoặc mã khôi phục.</small></span></div></div>
    <div class="hero-art"><span class="float-chip float-chip--top">✓ Chỉ cần Tên người dùng</span><img src="/images/banner-locketpro.webp" alt="Banner Locket Gold tông hồng với các nhân vật mèo dễ thương" width="1536" height="1024" fetchpriority="high"><span class="float-chip float-chip--bottom">♡ Hỗ trợ iOS & Android</span></div>
  </div></section>
  <section class="feature-strip"><div class="container"><span>Không yêu cầu đăng nhập để mua</span><span>Mã giảm giá theo phần trăm</span><span>Hướng dẫn sau thanh toán</span><span>Hỗ trợ nhanh chóng</span></div></section>
  <section class="section image-benefits"><div class="container"><div class="section-heading"><span class="eyebrow">Từ bộ ảnh Locket Gold</span><h2>Đơn giản và dễ bắt đầu</h2><p>Những điều bạn cần biết trước khi chọn gói.</p></div><div class="image-benefits-grid">
    <article class="image-benefit"><img src="/images/noapp-transparent.png" alt="Không cần tải app" loading="lazy" decoding="async"><div><span class="benefit-label">Tiện lợi</span><h3>Không cần tải app</h3><p>Chọn gói và gửi đơn trực tiếp trên trình duyệt, không phải cài thêm ứng dụng để mua.</p></div></article>
    <article class="image-benefit image-benefit--white"><img src="/images/nodns-white.png" alt="Minh họa đặt gói trên trang web" loading="lazy" decoding="async"><div><span class="benefit-label">Thoải mái</span><h3>Không cần VPN</h3><p>Đặt đơn trên trang web mà không cần đổi VPN. Nếu gói bạn chọn cần cài DNS, hướng dẫn riêng sẽ hiện rõ.</p></div></article>
    <article class="image-benefit image-benefit--white"><img src="/images/username-white.png" alt="Chỉ cần Tên người dùng" loading="lazy" decoding="async"><div><span class="benefit-label">Riêng tư</span><h3>Chỉ cần Tên người dùng</h3><p>Chỉ cần nhập chính xác Tên người dùng Locket của bạn. Cam kết không bao giờ yêu cầu mật khẩu.</p></div></article>
    <article class="image-benefit"><img src="/images/antoan.png" alt="Không yêu cầu mật khẩu" loading="lazy" decoding="async"><div><span class="benefit-label">An toàn</span><h3>Không yêu cầu mật khẩu</h3><p>Chỉ cung cấp Tên người dùng. Luôn giữ riêng mật khẩu, OTP và mã khôi phục của bạn.</p></div></article>
  </div></div></section>
  <section class="section"><div class="container"><div class="section-heading"><span class="eyebrow">Bảng giá minh bạch</span><h2>Bốn lựa chọn cho từng nhu cầu</h2><p>Giá hiển thị trước khi xác nhận, không có chi phí ẩn.</p></div><div id="home-plans">${planCards()}</div></div></section>
  <section class="section section--tint"><div class="container two-col"><div><span class="eyebrow">Quy trình</span><h2>Bốn bước rõ ràng</h2><p>Không cần tạo tài khoản khách hàng. Bước xác nhận chỉ giúp bạn tự kiểm tra Tên người dùng đã nhập, chưa phải tra cứu tài khoản Locket.</p></div><ol class="step-list"><li><b>01</b><div><strong>Nhập thông tin</strong><span>Nhập Tên người dùng và kênh liên hệ; không nhập mật khẩu hay OTP.</span></div></li><li><b>02</b><div><strong>Tự xác nhận</strong><span>Kiểm tra lại Tên người dùng trước khi tạo đơn.</span></div></li><li><b>03</b><div><strong>Chọn gói</strong><span>Kiểm tra nền tảng, thời hạn và số tiền.</span></div></li><li><b>04</b><div><strong>Thanh toán & theo dõi</strong><span>Nhận mã đơn và hướng dẫn sau khi tạo đơn.</span></div></li></ol></div></section>
  <section class="section"><div class="container"><div class="section-heading"><span class="eyebrow">Tin mới</span><h2>Mẹo dùng Locket an toàn</h2></div><div class="post-grid">${postCards(fallbackPosts)}</div><div class="center"><a class="text-link" href="/bai-viet/">Xem tất cả bài viết →</a></div></div></section>`),

  pricing: () => publicShell(`${pageHero("Lên Gold", "Chọn gói phù hợp", "Bốn gói cho iOS và Android, mua trực tiếp mà không cần đăng nhập.")}<section class="section section--compact"><div class="container"><div id="all-plans">${planCards()}</div><p class="info-note">ⓘ Gói Android: nút tải APK và hướng dẫn cài đặt sẽ hiện trên trang đơn sau khi thanh toán.</p><section class="pricing-video" aria-labelledby="gold-video-title"><span class="eyebrow">Hướng dẫn Locket Gold</span><h2 id="gold-video-title">Video hướng dẫn</h2><div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/1KQWGs0dJgY" title="Video hướng dẫn Locket Gold" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><a class="text-link" href="https://www.youtube.com/watch?feature=shared&v=1KQWGs0dJgY" target="_blank" rel="noopener noreferrer">Mở video trên YouTube ↗</a></section></div></section>`),

  trust: () => publicShell(`${pageHero("Uy tín và phản hồi", "Trải nghiệm từ khách hàng", "Khám phá hình ảnh phản hồi và những cam kết khi đặt gói tại Locket Gold.")}${feedbackGallery()}<section class="section section--compact"><div class="container"><div class="trust-grid">
    <article><span>🔒</span><h2>Không thu mật khẩu</h2><p>Biểu mẫu chỉ nhận Tên người dùng Locket và thông tin liên hệ bạn chủ động cung cấp.</p></article>
    <article><span>🧾</span><h2>Có mã đơn đối soát</h2><p>Mỗi yêu cầu được gắn mã riêng để tra cứu trạng thái và khớp giao dịch.</p></article>
    <article><span>⚙</span><h2>Bí mật nằm ở máy chủ</h2><p>Khóa API và cấu hình thanh toán không được đưa vào mã frontend hay màn hình quản trị.</p></article>
    <article><span>✓</span><h2>Thông tin rõ ràng</h2><p>Thông tin gói và quy trình nâng cấp được hiển thị rõ ràng; Tên người dùng trên thông báo được che một phần.</p></article>
  </div><div class="warning-card"><strong>Lưu ý an toàn</strong><p>Nếu bất kỳ ai yêu cầu mật khẩu, OTP, mã khôi phục hoặc quyền điều khiển thiết bị, hãy dừng lại và liên hệ hỗ trợ.</p></div></div></section>`),

  posts: () => publicShell(`${pageHero("Blog & tin tức", "Kiến thức Locket dễ hiểu", "Bài viết do quản trị viên xuất bản sẽ tự động hiển thị tại đây.")}<section class="section section--compact"><div class="container"><div id="post-list" class="post-grid">${postCards(fallbackPosts)}</div></div></section>`),

  guide: () => publicShell(`${pageHero("Hướng dẫn", "Bốn bước đặt gói rõ ràng", "Làm theo đúng quy trình trên locketgold.info. Không dùng ảnh QR hay số tài khoản cố định từ bài hướng dẫn để chuyển tiền.")}<section class="section section--compact"><div class="container">
    <div id="guide-walkthrough" class="guide-walkthrough"><div class="guide-tabs" role="tablist" aria-label="Các bước đặt gói">
      <button id="guide-tab-1" class="guide-tab is-active" type="button" role="tab" aria-controls="guide-panel-1" aria-selected="true" tabindex="0" data-guide-tab="0"><b>01</b><span>Nhập thông tin</span></button>
      <button id="guide-tab-2" class="guide-tab" type="button" role="tab" aria-controls="guide-panel-2" aria-selected="false" tabindex="-1" data-guide-tab="1"><b>02</b><span>Tự xác nhận</span></button>
      <button id="guide-tab-3" class="guide-tab" type="button" role="tab" aria-controls="guide-panel-3" aria-selected="false" tabindex="-1" data-guide-tab="2"><b>03</b><span>Chọn gói</span></button>
      <button id="guide-tab-4" class="guide-tab" type="button" role="tab" aria-controls="guide-panel-4" aria-selected="false" tabindex="-1" data-guide-tab="3"><b>04</b><span>Thanh toán</span></button>
    </div><div class="guide-panels">
      <section id="guide-panel-1" class="guide-slide" role="tabpanel" aria-labelledby="guide-tab-1" tabindex="0" data-guide-panel="0"><div><span class="eyebrow">Bước 1 / 4</span><h2>Nhập Tên người dùng và liên hệ</h2><p>Mở ứng dụng Locket để xem đúng Tên người dùng của bạn, rồi nhập vào trang thanh toán cùng email hoặc số điện thoại hỗ trợ.</p><ul><li>Chỉ nhập Tên người dùng hoặc dán liên kết hồ sơ được hỗ trợ.</li><li>Không cung cấp mật khẩu, OTP hoặc mã khôi phục.</li></ul><a class="button button--small" href="/thanh-toan/">Bắt đầu đặt gói →</a></div><figure class="guide-illustration"><a href="/images/buoc1.png" target="_blank" rel="noopener noreferrer" aria-label="Xem ảnh hướng dẫn bước 1 ở kích thước đầy đủ"><img class="guide-slide-image" src="/images/buoc1.png" alt="Minh họa bước 1: nhập Tên người dùng Locket" width="1264" height="842" loading="lazy" decoding="async"></a><figcaption>Ảnh minh họa · Bấm để xem ảnh lớn.</figcaption></figure></section>
      <section id="guide-panel-2" class="guide-slide" role="tabpanel" aria-labelledby="guide-tab-2" tabindex="0" data-guide-panel="1" hidden><div><span class="eyebrow">Bước 2 / 4</span><h2>Tự kiểm tra trước khi tiếp tục</h2><p>Trang web hiển thị lại Tên người dùng bạn vừa nhập để bạn đối chiếu với ứng dụng Locket. Nếu sai, hãy quay lại sửa ngay.</p><p class="guide-honest-note">Trang tra cứu tên hiển thị, ảnh đại diện và trạng thái Gold qua NoDNS. Hãy đối chiếu thông tin với tài khoản trong ứng dụng Locket.</p></div><figure class="guide-illustration"><a href="/images/buoc2.png" target="_blank" rel="noopener noreferrer" aria-label="Xem ảnh hướng dẫn bước 2 ở kích thước đầy đủ"><img class="guide-slide-image" src="/images/buoc2.png" alt="Minh họa bước 2: kiểm tra thông tin tài khoản" width="1024" height="1024" loading="lazy" decoding="async"></a><figcaption>Ảnh minh họa · Bấm để xem ảnh lớn.</figcaption></figure></section>
      <section id="guide-panel-3" class="guide-slide" role="tabpanel" aria-labelledby="guide-tab-3" tabindex="0" data-guide-panel="2" hidden><div><span class="eyebrow">Bước 3 / 4</span><h2>Chọn nền tảng và thời hạn</h2><p>Chọn đúng gói iOS hoặc Android, xem thời hạn và giá tạm tính. Nếu có mã giảm giá, áp dụng trước khi sang bước rà soát đơn.</p><p>Ở bước cuối, kiểm tra lại Tên người dùng, gói và số tiền trước khi bấm tạo đơn.</p><a class="button button--outline button--small" href="/len-gold/">Xem bảng giá →</a></div><figure class="guide-illustration"><a href="/images/buoc3.png" target="_blank" rel="noopener noreferrer" aria-label="Xem ảnh hướng dẫn bước 3 ở kích thước đầy đủ"><img class="guide-slide-image" src="/images/buoc3.png" alt="Minh họa bước 3: thanh toán bằng VietQR" width="921" height="1152" loading="lazy" decoding="async"></a><figcaption>Ảnh minh họa · Bấm để xem ảnh lớn.</figcaption></figure></section>
      <section id="guide-panel-4" class="guide-slide" role="tabpanel" aria-labelledby="guide-tab-4" tabindex="0" data-guide-panel="3" hidden><div><span class="eyebrow">Bước 4 / 4</span><h2>Tạo đơn, rồi mới chuyển khoản</h2><p>Sau khi tạo đơn thành công, trang web mới hiển thị ngân hàng, số tiền, mã đơn và nội dung chuyển khoản của đơn đó. Chuyển đúng thông tin đang hiển thị trên trang đơn.</p><p>Giữ trang đơn để bấm <b>Kiểm tra thanh toán</b>. Nếu cần hỗ trợ, gửi mã đơn — không gửi mật khẩu hay OTP.</p></div><figure class="guide-illustration"><a href="/images/buoc4.png" target="_blank" rel="noopener noreferrer" aria-label="Xem ảnh hướng dẫn bước 4 ở kích thước đầy đủ"><img class="guide-slide-image" src="/images/buoc4.png" alt="Minh họa bước 4: kiểm tra Locket Gold sau kích hoạt" width="1195" height="896" loading="lazy" decoding="async"></a><figcaption>Ảnh minh họa · Bấm để xem ảnh lớn.</figcaption></figure></section>
    </div><div class="guide-controls"><button class="button button--outline button--small" type="button" data-guide-previous disabled>← Bước trước</button><span id="guide-position" aria-live="polite">Bước 1 / 4</span><button class="button button--small" type="button" data-guide-next>Bước tiếp →</button></div></div>
    <div class="guide-extra"><article><h2>Dùng iPhone?</h2><p>Một số gói cần hướng dẫn DNS riêng. Chỉ tải từ liên kết trên trang web và đọc kỹ các bước cài đặt.</p><a class="text-link" href="/tai-dns/">Xem hướng dẫn DNS →</a></article><article><h2>Dùng Android?</h2><p>Tải tệp APK trực tiếp trên trang đơn sau khi thanh toán được xác nhận. Làm theo hướng dẫn cài đặt hiển thị cùng nút tải.</p><a class="text-link" href="/len-gold/">Xem gói Android →</a></article></div>
    <section class="guide-faq" aria-labelledby="guide-faq-title"><div class="section-heading"><span class="eyebrow">Câu hỏi thường gặp</span><h2 id="guide-faq-title">Bạn cần biết trước khi mua</h2></div><div class="guide-faq-list">
      <details><summary>Có cần đưa mật khẩu hoặc OTP không?</summary><p>Không. Biểu mẫu đặt gói chỉ nhận Tên người dùng Locket và thông tin liên hệ hỗ trợ. Nếu ai yêu cầu mật khẩu hoặc OTP, hãy dừng lại.</p></details>
      <details><summary>Trang có xác minh tài khoản Locket của tôi không?</summary><p>Có. Trang tra cứu tài khoản qua NoDNS và hiển thị tên, ảnh đại diện cùng trạng thái Gold để bạn đối chiếu trước khi thanh toán.</p></details>
      <details><summary>Tôi chuyển khoản theo ảnh hướng dẫn được không?</summary><p>Không. Chỉ chuyển theo ngân hàng, số tiền và nội dung xuất hiện trên đơn của chính bạn sau khi bấm tạo đơn. Không dùng QR hoặc số tài khoản trong ảnh minh họa.</p></details>
      <details><summary>Thanh toán rồi nhưng chưa thấy trạng thái thay đổi?</summary><p>Giữ trang đơn mở và bấm “Kiểm tra thanh toán”. Nếu giao dịch chưa được ghi nhận sau một thời gian hợp lý, liên hệ hỗ trợ kèm mã đơn và thông tin giao dịch đã che dữ liệu riêng tư.</p></details>
      <details><summary>Nếu chọn nhầm Tên người dùng hoặc gói thì sao?</summary><p>Trước khi tạo đơn, dùng nút “Quay lại” để sửa. Nếu đã tạo đơn hoặc chuyển tiền, hãy liên hệ hỗ trợ và cung cấp mã đơn; đừng tự chuyển thêm lần nữa.</p></details>
    </div></section>
  </div></section>`),

  dns: () => publicShell(`${pageHero("Tải DNS", "Cài DNS cho iPhone", "Chỉ cần cài một lần. Sau khi hoàn tất, quay lại trang web để mua gói và nâng cấp Gold.")}<section class="section section--compact"><div class="container dns-panel">
    <div class="dns-download"><span class="step-badge">1</span><div><small>Liên kết tải (mở bằng Safari)</small><strong id="dns-url">Chưa được cấu hình</strong></div><a id="dns-download" class="button is-disabled" href="#" aria-disabled="true">Tải tệp DNS</a></div>
    <div class="browser-warning">⚠ Bắt buộc mở liên kết bằng Safari trên iPhone. Trình duyệt khác có thể không tải được hồ sơ cấu hình.</div>
    <div class="dns-step"><span class="step-badge">2</span><div><h2>Cài hồ sơ trong Cài đặt</h2><ol><li>Mở <b>Cài đặt</b> trên iPhone.</li><li>Chọn <b>Cài đặt chung → VPN & Quản lý thiết bị</b>.</li><li>Chọn hồ sơ Locket Gold vừa tải và nhấn <b>Cài đặt</b>.</li></ol></div></div>
    <div class="dns-step"><span class="step-badge step-badge--gold">3</span><div><h2>Bật tin cậy chứng chỉ</h2><ol><li>Vào <b>Cài đặt chung → Giới thiệu</b>.</li><li>Mở <b>Cài đặt tin cậy chứng chỉ</b>.</li><li>Bật công tắc của chứng chỉ vừa cài và xác nhận.</li></ol></div></div>
    <div class="warning-card"><strong>Đừng bỏ qua bước tin cậy chứng chỉ</strong><p>Sau khi hoàn tất DNS, hãy mua gói trên trang web để hệ thống thực hiện nâng cấp Gold.</p></div>
    <div class="center"><a class="button" href="/len-gold/">Chọn gói Gold →</a></div>
  </div></section>`),

  contact: () => publicShell(`${pageHero("Liên hệ", "Bạn cần hỗ trợ?", "Liên hệ qua các kênh chính thức dưới đây; không gửi mật khẩu hoặc OTP qua bất kỳ kênh nào.")}<section class="section section--compact"><div class="container"><img class="contact-banner" src="/images/lienhe.webp" alt="Banner liên hệ hỗ trợ Locket Gold" width="2048" height="768" decoding="async"><div id="contact-links" class="contact-grid"><article><span class="social-icon social-icon--zalo" aria-hidden="true">Zalo</span><h2>Zalo</h2><p><a class="contact-link" target="_blank" rel="noopener noreferrer" data-contact="support_zalo" href="https://zalo.me/g/3mdkix3pinjmxtozcjjp">https://zalo.me/g/3mdkix3pinjmxtozcjjp</a></p></article><article><span class="social-icon social-icon--facebook" aria-hidden="true">f</span><h2>Facebook</h2><p><a class="contact-link" target="_blank" rel="noopener noreferrer" data-contact="support_facebook" href="https://www.facebook.com/duckcozy">https://www.facebook.com/duckcozy</a></p></article><article><span class="social-icon social-icon--telegram" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21.6 4.3 18.4 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.3L5.8 13.4.9 11.9c-1.1-.3-1.1-1 .2-1.5L20.2 3c.9-.3 1.7.2 1.4 1.3Z"/></svg></span><h2>Telegram</h2><p><a class="contact-link" target="_blank" rel="noopener noreferrer" data-contact="support_telegram" href="https://t.me/anhduckkkk">t.me/anhduckkkk</a></p></article></div></div></section>`),

  checkout: checkoutPage,
  ctv: ctvPage,
  admin: adminPage,
};

function postCards(posts) {
  const images = {
    "bao-ve-tai-khoan": "/images/antoan.png",
    "kiem-tra-sau-nang-cap": "/images/noapp.png",
    "chon-goi-phu-hop": "/images/logo.png",
  };
  return posts.map((rawPost) => {
    const post = postForDisplay(rawPost);
    const href = `/bai-viet/?bai=${encodeURIComponent(post.slug || "")}`;
    const image = /^\/images\/imported-posts\/[a-f0-9]{24}\.(png|jpe?g|webp|gif)$/.test(post.thumbnail || "") ? post.thumbnail : images[post.slug] || "/images/logo.png";
    return `<article class="post-card"><a class="post-card-image" href="${href}" aria-label="${escapeHtml(post.title)}"><img src="${image}" alt="${escapeHtml(post.title)}" width="1536" height="1024" loading="lazy" decoding="async"></a><span>${escapeHtml(formatDate(post.published_at))}</span><h2><a href="${href}">${escapeHtml(post.title)}</a></h2><p>${escapeHtml(post.excerpt || "")}</p><a href="${href}">Đọc bài →</a></article>`;
  }).join("");
}

function formatDate(value) {
  if (!value) return "Mới cập nhật";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN").format(date);
}

function checkoutPage() {
  const selected = new URLSearchParams(location.search).get("plan") || "ios-lifetime";
  return publicShell(`${pageHero("Thanh toán", "Đặt gói không cần đăng nhập", "Bốn bước rõ ràng. Chỉ nhập Tên người dùng Locket; tuyệt đối không cung cấp mật khẩu hoặc OTP.")}<section class="section section--compact"><div class="container checkout-flow">
    <ol id="checkout-progress" class="checkout-progress" aria-label="Tiến trình đặt hàng"><li aria-current="step"><b>1</b><span>Thông tin</span></li><li><b>2</b><span>Xác nhận</span></li><li><b>3</b><span>Chọn gói</span></li><li><b>4</b><span>Thanh toán</span></li></ol>
    <div class="checkout-layout"><form id="checkout-form" class="form-card" novalidate>
      <section class="checkout-step" data-checkout-step="1"><span class="eyebrow">Bước 1 / 4</span><h2 tabindex="-1">Nhập thông tin</h2><p>Thông tin này dùng để tạo đơn và liên hệ khi cần hỗ trợ.</p><label>Tên người dùng Locket<span class="input-with-action"><input name="username" autocomplete="off" minlength="2" maxlength="65" required placeholder="Ví dụ: @username"><button class="button button--outline button--small" type="button" id="paste-username">Dán</button></span><small>Dán đường dẫn hồ sơ Locket để tự tách Tên người dùng nếu đường dẫn có định dạng được hỗ trợ.</small></label><label>Thư điện tử hoặc số điện thoại hỗ trợ<input name="contact" autocomplete="email" maxlength="120" required placeholder="Để nhận trạng thái đơn"></label><p id="checkout-account-message" class="form-message" aria-live="polite"></p><div class="checkout-step-actions"><button class="button" type="button" data-checkout-next>Tiếp tục →</button></div></section>
      <section class="checkout-step" data-checkout-step="2" hidden><span class="eyebrow">Bước 2 / 4</span><h2 tabindex="-1">Xác nhận tài khoản Locket</h2><div class="checkout-confirm"><div id="locket-profile" class="locket-profile"></div><small>Tên người dùng bạn đã nhập</small><strong id="confirm-username">—</strong><small>Liên hệ: <span id="confirm-contact">—</span></small></div><p class="checkout-disclaimer">Thông tin tài khoản được tra cứu qua NoDNS. Hãy đối chiếu tên, ảnh và Tên người dùng với tài khoản của bạn trước khi tiếp tục.</p><label class="consent"><input name="username_confirmed" type="checkbox"> Tôi đã kiểm tra đúng Tên người dùng của mình.</label><p id="checkout-confirm-message" class="form-message" aria-live="polite"></p><div class="checkout-step-actions"><button class="button button--outline" type="button" data-checkout-back>← Quay lại</button><button class="button" type="button" data-checkout-next>Tiếp tục →</button></div></section>
      <section class="checkout-step" data-checkout-step="3" hidden><span class="eyebrow">Bước 3 / 4</span><h2 tabindex="-1">Chọn gói Gold</h2><p>Kiểm tra nền tảng, thời hạn và giá trước khi tạo đơn.</p><fieldset class="checkout-plan-fieldset"><legend class="sr-only">Chọn gói Gold</legend><div id="checkout-plan-options" class="checkout-plan-options">${checkoutPlanOptions(fallbackPlans, selected)}</div></fieldset><div class="promo-row"><label>Mã giảm giá<input name="promo_code" maxlength="32" placeholder="Nhập mã nếu có"></label><button class="button button--outline" type="button" id="apply-promo">Áp dụng</button></div><p id="quote-message" class="form-message" aria-live="polite"></p><div class="checkout-step-actions"><button class="button button--outline" type="button" data-checkout-back>← Quay lại</button><button class="button" type="button" data-checkout-next>Kiểm tra đơn →</button></div></section>
      <section class="checkout-step" data-checkout-step="4" hidden><span class="eyebrow">Bước 4 / 4</span><h2 tabindex="-1">Kiểm tra & tạo đơn</h2><dl class="checkout-review"><div><dt>Tên người dùng</dt><dd id="review-username">—</dd></div><div><dt>Liên hệ</dt><dd id="review-contact">—</dd></div><div><dt>Gói Gold</dt><dd id="review-plan">—</dd></div><div><dt>Số tiền</dt><dd id="review-total">—</dd></div></dl><p class="checkout-disclaimer">Bấm tạo đơn chưa chuyển tiền. Thông tin ngân hàng và mã nội dung chuyển khoản chỉ xuất hiện sau khi đơn được tạo thành công.</p><label class="consent"><input name="order_confirmed" type="checkbox"> Tôi xác nhận thông tin và gói đã chọn là chính xác.</label><p id="checkout-submit-message" class="form-message" aria-live="polite"></p><div class="checkout-step-actions"><button class="button button--outline" type="button" data-checkout-back>← Quay lại</button><button class="button" type="submit">Tạo đơn thanh toán</button></div></section>
      <p class="privacy-line">🔒 Không yêu cầu đăng nhập, mật khẩu hay OTP.</p></form>
      <aside id="order-summary" class="summary-card"><h2>Tóm tắt tạm tính</h2><p>Gói đã chọn</p><strong id="summary-plan">—</strong><dl><div><dt>Giá gói</dt><dd id="summary-price">—</dd></div><div><dt>Giảm giá</dt><dd id="summary-discount">0đ</dd></div><div class="summary-total"><dt>Dự kiến</dt><dd id="summary-total">—</dd></div></dl><p class="summary-help">Số tiền chính thức và thông tin chuyển khoản được xác nhận khi tạo đơn.</p></aside>
    </div><div id="payment-result" class="payment-result" hidden></div></section>`);
}

function ctvPage() {
  return publicShell(`${pageHero("Cộng tác viên", "Quản lý đơn gọn trong một nơi", "Đăng nhập tài khoản do quản trị viên cấp để xem số dư và tạo đơn CTV.")}<section class="section section--compact"><div class="container portal-wrap"><form id="ctv-login" class="form-card form-card--narrow"><h2>Đăng nhập CTV</h2><label>Tên đăng nhập<input name="username" autocomplete="username" required></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required></label><button class="button" type="submit">Đăng nhập</button><p id="ctv-message" class="form-message" aria-live="polite"></p></form><div id="ctv-dashboard" class="portal-dashboard" hidden></div></div></section>`);
}

function adminPage() {
  return `<main class="admin-shell"><section id="admin-login-wrap" class="admin-login"><div>${brand()}<form id="admin-login" class="form-card form-card--narrow"><span class="eyebrow">Khu vực bảo mật</span><h1>Đăng nhập quản trị</h1><label>Tên đăng nhập<input name="username" autocomplete="username" required value="admin"></label><label>Mật khẩu quản trị<input name="password" type="password" autocomplete="current-password" required></label><button class="button" type="submit">Đăng nhập</button><p id="admin-message" class="form-message" aria-live="polite"></p></form></div></section><section id="admin-dashboard" class="admin-dashboard" hidden></section></main>`;
}

app.innerHTML = (pages[page] || pages.home)();
document.querySelector("#current-year")?.replaceChildren(String(new Date().getFullYear()));

function initNavigation() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");
  const backdrop = document.querySelector(".nav-backdrop");
  if (!toggle || !nav || !backdrop) return;
  const mobile = window.matchMedia("(max-width: 1100px)");
  const outside = [...document.querySelectorAll("main, .site-footer, .floating-support")];
  const setOpen = (open) => {
    open = open && mobile.matches;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
    nav.classList.toggle("is-open", open);
    backdrop.hidden = !open;
    document.body.classList.toggle("nav-open", open);
    nav.inert = mobile.matches && !open;
    outside.forEach((element) => { element.inert = open; });
    if (open) nav.querySelector(".nav-close").focus();
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  backdrop.addEventListener("click", () => setOpen(false));
  nav.querySelector(".nav-close").addEventListener("click", () => { setOpen(false); toggle.focus(); });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (event) => {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (event.key === "Escape") { setOpen(false); toggle.focus(); }
    if (event.key === "Tab") {
      const controls = [toggle, ...nav.querySelectorAll("button, a")];
      const current = controls.indexOf(document.activeElement);
      if ((event.shiftKey && current === 0) || (!event.shiftKey && current === controls.length - 1)) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
    }
  });
  mobile.addEventListener("change", () => setOpen(false));
  setOpen(false);
}

function initFeedbackGallery() {
  const viewer = document.querySelector("#feedback-viewer");
  if (!viewer) return;
  document.querySelectorAll("[data-feedback-src]").forEach((button) => button.addEventListener("click", () => {
    viewer.querySelector("img").src = button.dataset.feedbackSrc;
    viewer.querySelector("img").alt = button.dataset.feedbackCaption;
    viewer.querySelector("p").textContent = button.dataset.feedbackCaption;
    viewer.showModal();
  }));
  viewer.querySelector("button").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (event) => { if (event.target === viewer) viewer.close(); });
}

function initGuide() {
  const root = document.querySelector("#guide-walkthrough");
  if (!root) return;
  const tabs = [...root.querySelectorAll("[data-guide-tab]")];
  const panels = [...root.querySelectorAll("[data-guide-panel]")];
  const previous = root.querySelector("[data-guide-previous]");
  const next = root.querySelector("[data-guide-next]");
  const position = root.querySelector("#guide-position");
  let activeIndex = 0;

  const showStep = (index, focusTab = false) => {
    if (index < 0 || index >= tabs.length) return;
    activeIndex = index;
    tabs.forEach((tab, tabIndex) => {
      const active = tabIndex === index;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[tabIndex].hidden = !active;
    });
    previous.disabled = index === 0;
    next.disabled = index === tabs.length - 1;
    position.textContent = `Bước ${index + 1} / ${tabs.length}`;
    if (focusTab) tabs[index].focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showStep(index));
    tab.addEventListener("keydown", (event) => {
      const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      showStep((target + tabs.length) % tabs.length, true);
    });
  });
  previous.addEventListener("click", () => showStep(activeIndex - 1));
  next.addEventListener("click", () => showStep(activeIndex + 1));
  showStep(0);

  const questions = [...document.querySelectorAll(".guide-faq-list details")];
  questions.forEach((question) => question.addEventListener("toggle", () => {
    if (question.open) questions.forEach((other) => { if (other !== question) other.open = false; });
  }));
}

async function api(path, options = {}) {
  let response;
  try { response = await fetch(path, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); }
  catch { throw new Error("Không thể kết nối hệ thống. Vui lòng kiểm tra mạng và thử lại."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Không thể kết nối hệ thống.");
  return data;
}

async function loadPlans() {
  if (!document.querySelector("#all-plans, #home-plans")) return;
  try {
    const { plans } = await api("/api/plans");
    if (!plans?.length) return;
    document.querySelector("#all-plans")?.replaceChildren();
    const html = planCards(plans);
    if (document.querySelector("#all-plans")) document.querySelector("#all-plans").innerHTML = html;
    if (document.querySelector("#home-plans")) document.querySelector("#home-plans").innerHTML = html;
  } catch { /* Static fallback remains visible before backend setup. */ }
}

async function loadPosts() {
  const list = document.querySelector("#post-list");
  if (!list) return;
  const slug = new URLSearchParams(location.search).get("bai");
  const localPost = fallbackPosts.find((post) => post.slug === slug);
  const renderPost = (rawPost) => {
    const post = postForDisplay(rawPost);
    list.className = "article-view";
    const cover = /^\/images\/imported-posts\/[a-f0-9]{24}\.(png|jpe?g|webp|gif)$/.test(post.cover || "") ? `<img class="article-cover" src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}" decoding="async">` : "";
    list.innerHTML = `<article><a class="text-link" href="/bai-viet/">← Tất cả bài viết</a><span>${escapeHtml(formatDate(post.published_at))}${post.category ? ` · ${escapeHtml(post.category)}` : ""}</span><h2>${escapeHtml(post.title)}</h2>${cover}<p class="article-lead">${escapeHtml(post.excerpt)}</p><div class="article-body">${renderPostContent(post.content, post.content_blocks)}</div></article>`;
    document.title = `${post.title} | Locket Gold`;
  };
  if (localPost) renderPost(localPost);
  else if (slug) { list.className = "article-view"; list.innerHTML = '<p role="status">Đang tải bài viết…</p>'; }
  try {
    if (slug) {
      let post;
      try { post = await api(`/api/posts/${encodeURIComponent(slug)}`); }
      catch (error) {
        if (!/^[a-z0-9-]{1,200}$/.test(slug)) throw error;
        post = await api(`/imported-posts/${slug}.json`);
      }
      if (!post.title || !post.content) throw new Error("Bài viết chưa có nội dung.");
      renderPost(post);
      return;
    }
    const [live, archive] = await Promise.allSettled([api("/api/posts"), api("/imported-posts/index.json")]);
    const livePosts = live.status === "fulfilled" && Array.isArray(live.value.posts) && live.value.posts.length ? live.value.posts : fallbackPosts;
    const imported = archive.status === "fulfilled" && Array.isArray(archive.value) ? archive.value : [];
    const posts = mergePostArchive(livePosts, imported);
    const selected = postArchivePage(posts, new URLSearchParams(location.search).get("trang"));
    list.innerHTML = postCards(selected.posts);
    const controls = document.createElement("div");
    controls.className = "post-archive-controls";
    const pageLink = (number, label = number) => `<a class="button button--small button--outline" href="/bai-viet/?trang=${number}"${number === selected.page ? ' aria-current="page"' : ""}>${label}</a>`;
    const visiblePages = [...new Set([1, selected.page - 1, selected.page, selected.page + 1, selected.totalPages])].filter((number) => number >= 1 && number <= selected.totalPages).sort((a, b) => a - b);
    controls.innerHTML = `<p>Hiển thị ${selected.total ? selected.start + 1 : 0}–${selected.start + selected.posts.length} trong ${selected.total.toLocaleString("vi-VN")} bài viết</p><nav class="post-pagination" aria-label="Phân trang bài viết">${selected.page > 1 ? pageLink(selected.page - 1, "← Trước") : ""}${visiblePages.map((number, index) => `${index && number > visiblePages[index - 1] + 1 ? '<span aria-hidden="true">…</span>' : ""}${pageLink(number)}`).join("")}${selected.page < selected.totalPages ? pageLink(selected.page + 1, "Sau →") : ""}</nav>`;
    list.after(controls);
  } catch {
    if (slug && !localPost) list.innerHTML = '<article><h2>Chưa tìm thấy bài viết</h2><p>Bài viết có thể chưa được xuất bản hoặc tạm thời không tải được.</p><a class="text-link" href="/bai-viet/">← Tất cả bài viết</a></article>';
  }
}

async function loadDownloads() {
  enableDownload("#dns-download", defaultDnsUrl, "Mở hướng dẫn cài DNS ↗");
  document.querySelector("#dns-url")?.replaceChildren(defaultDnsUrl);
  try {
    const config = await api("/api/public-config");
    if (config.dns_url) enableDownload("#dns-download", config.dns_url, "Mở hướng dẫn cài DNS ↗");
    if (config.dns_url && document.querySelector("#dns-url")) document.querySelector("#dns-url").textContent = config.dns_url;
    const contact = document.querySelector("#contact-links");
    if (contact) {
      for (const link of contact.querySelectorAll("[data-contact]")) {
        const url = config[link.dataset.contact];
        if (url) {
          link.href = url;
          link.textContent = url;
        }
      }
    }
  } catch { /* Keep controls disabled until configured. */ }
}

async function initWelcomeModal() {
  const modal = document.querySelector("#welcome-modal");
  if (!modal) return;
  let config;
  try { config = await api("/api/welcome"); } catch { return; }
  let dismissed;
  try { dismissed = sessionStorage.getItem("welcome-modal-dismissed"); } catch { /* Storage may be disabled. */ }
  if (!shouldShowWelcome(config, dismissed)) return;
  modal.innerHTML = welcomeMarkup(config);
  const close = () => { modal.close(); try { sessionStorage.setItem("welcome-modal-dismissed", config.revision); } catch { /* Storage may be disabled. */ } };
  modal.querySelector(".modal-close").addEventListener("click", close);
  modal.addEventListener("cancel", close);
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  modal.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  window.requestAnimationFrame(() => { if (!modal.open) modal.showModal(); });
}

function enableDownload(selector, url, label) {
  const link = document.querySelector(selector);
  if (!link) return;
  link.href = url;
  link.textContent = label;
  link.classList.remove("is-disabled");
  link.removeAttribute("aria-disabled");
}

function initCheckout() {
  const form = document.querySelector("#checkout-form");
  if (!form) return;
  const steps = [...form.querySelectorAll("[data-checkout-step]")];
  const progress = [...document.querySelectorAll("#checkout-progress li")];
  const usernameInput = form.elements.username;
  const contactInput = form.elements.contact;
  const usernameConfirmed = form.elements.username_confirmed;
  const orderConfirmed = form.elements.order_confirmed;
  const promo = form.elements.promo_code;
  const quoteMessage = document.querySelector("#quote-message");
  const accountMessage = document.querySelector("#checkout-account-message");
  const confirmMessage = document.querySelector("#checkout-confirm-message");
  const submitMessage = document.querySelector("#checkout-submit-message");
  const planOptions = document.querySelector("#checkout-plan-options");
  const selectedFromUrl = new URLSearchParams(location.search).get("plan") || "ios-lifetime";
  let plans = fallbackPlans;
  let quote = null;
  let activeStep = 1;

  const applyPastedUsername = (value) => {
    const username = parsePastedUsername(value);
    if (!username) return false;
    usernameInput.value = username;
    usernameInput.setCustomValidity("");
    usernameConfirmed.checked = false;
    orderConfirmed.checked = false;
    accountMessage.textContent = `Đã lấy Tên người dùng @${username}; vui lòng đối chiếu trước khi tiếp tục.`;
    accountMessage.className = "form-message is-success";
    return true;
  };

  usernameInput.addEventListener("paste", (event) => {
    const pasted = event.clipboardData?.getData("text/plain");
    if (pasted && applyPastedUsername(pasted)) event.preventDefault();
  });

  document.querySelector("#paste-username")?.addEventListener("click", async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error("Trình duyệt chưa cho phép đọc bộ nhớ tạm; hãy dán trực tiếp vào ô tên người dùng.");
      const pasted = await navigator.clipboard.readText();
      if (!applyPastedUsername(pasted)) throw new Error("Không tìm thấy Tên người dùng hợp lệ trong nội dung vừa dán.");
      usernameInput.focus();
    } catch (error) {
      accountMessage.textContent = error.message;
      accountMessage.className = "form-message is-error";
    }
  });

  const chosenPlan = () => plans.find((plan) => plan.id === planOptions.querySelector('input[name="plan_id"]:checked')?.value);

  const showStep = (step, focus = true) => {
    activeStep = step;
    if (step === 4) submitMessage.textContent = "";
    steps.forEach((section) => { section.hidden = Number(section.dataset.checkoutStep) !== step; });
    progress.forEach((item, index) => {
      item.classList.toggle("is-active", index + 1 === step);
      item.classList.toggle("is-complete", index + 1 < step);
      if (index + 1 === step) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    if (focus) {
      const heading = steps[step - 1]?.querySelector("h2");
      heading?.focus({ preventScroll: true });
      steps[step - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const renderSummary = () => {
    const plan = chosenPlan();
    document.querySelector("#summary-plan").textContent = plan ? `${plan.platform} · ${plan.name}` : "Chưa chọn gói";
    document.querySelector("#summary-price").textContent = plan ? money(quote?.subtotal ?? plan.price) : "—";
    document.querySelector("#summary-discount").textContent = money(quote?.discount_amount || 0);
    document.querySelector("#summary-total").textContent = plan ? money(quote?.total ?? plan.price) : "—";
  };

  const validateAccount = () => {
    if (!normalizeUsername(usernameInput.value)) applyPastedUsername(usernameInput.value);
    const username = normalizeUsername(usernameInput.value);
    usernameInput.setCustomValidity(username ? "" : "Chỉ nhập Tên người dùng hợp lệ, không dán đường dẫn Locket.");
    if (!usernameInput.reportValidity()) return false;
    const contact = contactInput.value.trim();
    contactInput.setCustomValidity(contact.length >= 3 ? "" : "Vui lòng nhập email hoặc số điện thoại hỗ trợ.");
    if (!contactInput.reportValidity()) return false;
    contactInput.value = contact;
    accountMessage.textContent = "";
    return true;
  };

  const updateQuote = async () => {
    const plan = chosenPlan();
    if (!plan) {
      quoteMessage.textContent = "Vui lòng chọn một gói Gold.";
      quoteMessage.className = "form-message is-error";
      return false;
    }
    const promoCode = promo.value.trim();
    try {
      const latestQuote = await api("/api/quote", { method: "POST", body: JSON.stringify({ plan_id: plan.id, promo_code: promoCode }) });
      if (chosenPlan()?.id !== plan.id || promo.value.trim() !== promoCode) return false;
      quote = latestQuote;
      quoteMessage.textContent = promoCode ? `Đã áp dụng giảm ${quote.discount_percent}%.` : "Đã cập nhật giá gói.";
      quoteMessage.className = "form-message is-success";
    } catch (error) {
      if (promoCode) {
        quote = null;
        quoteMessage.textContent = error.message;
        quoteMessage.className = "form-message is-error";
        renderSummary();
        return false;
      }
      quote = { subtotal: plan.price, discount_amount: 0, total: plan.price };
      quoteMessage.textContent = "Đang hiển thị giá tạm tính. Giá chính thức sẽ được xác nhận khi tạo đơn.";
      quoteMessage.className = "form-message";
    }
    renderSummary();
    return true;
  };

  const renderReview = () => {
    const plan = chosenPlan();
    document.querySelector("#review-username").textContent = `@${normalizeUsername(usernameInput.value)}`;
    document.querySelector("#review-contact").textContent = contactInput.value.trim();
    document.querySelector("#review-plan").textContent = plan ? `${plan.platform} · ${plan.name} · ${plan.period}` : "—";
    document.querySelector("#review-total").textContent = money(quote?.total ?? plan?.price);
  };

  usernameInput.addEventListener("input", (event) => {
    usernameInput.setCustomValidity("");
    usernameConfirmed.checked = false;
    orderConfirmed.checked = false;
    accountMessage.textContent = "";
    if (event.inputType === "insertFromPaste") applyPastedUsername(usernameInput.value);
  });
  usernameInput.addEventListener("blur", () => {
    if (/^https:\/\//i.test(usernameInput.value.trim())) applyPastedUsername(usernameInput.value);
  });
  contactInput.addEventListener("input", () => { contactInput.setCustomValidity(""); usernameConfirmed.checked = false; orderConfirmed.checked = false; });
  planOptions.addEventListener("change", () => { quote = null; orderConfirmed.checked = false; quoteMessage.textContent = ""; renderSummary(); });
  promo.addEventListener("input", () => { quote = null; orderConfirmed.checked = false; quoteMessage.textContent = ""; renderSummary(); });
  renderSummary();
  showStep(1, false);

  api("/api/plans").then(({ plans: available }) => {
    if (!available?.length || activeStep === 4) return;
    const previous = planOptions.querySelector('input[name="plan_id"]:checked')?.value || selectedFromUrl;
    plans = available;
    planOptions.innerHTML = checkoutPlanOptions(plans, plans.some((plan) => plan.id === previous) ? previous : plans[0].id);
    quote = null;
    renderSummary();
  }).catch(() => { /* Keep local plan choices until API is available. */ });

  document.querySelector("#apply-promo").addEventListener("click", async () => {
    if (!promo.value.trim()) { quoteMessage.textContent = "Nhập mã trước khi áp dụng."; return; }
    await updateQuote();
  });

  form.querySelectorAll("[data-checkout-next]").forEach((button) => button.addEventListener("click", async () => {
    if (button.disabled) return;
    if (activeStep === 1) {
      if (!validateAccount()) return;
      button.disabled = true;
      accountMessage.textContent = "Đang tra cứu tài khoản Locket…";
      const username = normalizeUsername(usernameInput.value);
      try {
        const profile = await api(`/api/locket/userinfo?user=${encodeURIComponent(username)}`);
        if (normalizeUsername(usernameInput.value) !== username) return;
        document.querySelector("#confirm-username").textContent = `@${profile.username}`;
        document.querySelector("#confirm-contact").textContent = contactInput.value.trim();
        const profilePanel = document.querySelector("#locket-profile");
        profilePanel.innerHTML = `<img src="${escapeHtml(profile.avatar || "/images/avatar-placeholder.svg")}" alt="Ảnh đại diện Locket" width="64" height="64" referrerpolicy="no-referrer"><div><b>${escapeHtml(profile.full_name || profile.username)}</b><p>${profile.gold?.has_gold ? "Đang có Gold" : "Chưa có Gold"}</p></div>`;
        profilePanel.querySelector("img").addEventListener("error", (event) => {
          event.currentTarget.src = "/images/avatar-placeholder.svg";
          event.currentTarget.alt = "Chưa tải được ảnh đại diện Locket";
        }, { once: true });
        accountMessage.textContent = "";
        usernameConfirmed.checked = false;
        showStep(2);
      } catch (error) {
        accountMessage.textContent = error.message;
        accountMessage.className = "form-message is-error";
      } finally { button.disabled = false; }
    } else if (activeStep === 2) {
      if (!usernameConfirmed.checked) {
        confirmMessage.textContent = "Hãy tự kiểm tra Tên người dùng trong ứng dụng Locket trước khi tiếp tục.";
        confirmMessage.className = "form-message is-error";
        return;
      }
      confirmMessage.textContent = "";
      showStep(3);
    } else if (activeStep === 3) {
      button.disabled = true;
      try {
        if (!await updateQuote()) return;
        renderReview();
        showStep(4);
      } finally { button.disabled = false; }
    }
  }));

  form.querySelectorAll("[data-checkout-back]").forEach((button) => button.addEventListener("click", () => {
    if (activeStep > 1) showStep(activeStep - 1);
  }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (activeStep !== 4) return;
    if (!validateAccount()) { showStep(1); return; }
    if (!usernameConfirmed.checked) { showStep(2); return; }
    const plan = chosenPlan();
    if (!plan) { showStep(3); return; }
    if (!orderConfirmed.checked) {
      submitMessage.textContent = "Vui lòng xác nhận thông tin đơn hàng.";
      submitMessage.className = "form-message is-error";
      return;
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Đang tạo đơn…";
    try {
      const values = { username: normalizeUsername(usernameInput.value), contact: contactInput.value.trim(), plan_id: plan.id, promo_code: promo.value.trim() };
      const result = await api("/api/orders", { method: "POST", body: JSON.stringify(values) });
      form.closest(".checkout-layout").hidden = true;
      progress.forEach((item) => { item.classList.add("is-complete"); item.classList.remove("is-active"); item.removeAttribute("aria-current"); });
      showPayment(result);
      document.querySelector("#payment-result").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      submitMessage.textContent = error.message;
      submitMessage.className = "form-message is-error";
    } finally { button.disabled = false; button.textContent = "Tạo đơn thanh toán"; }
  });
}

let paymentPollTimer;
let activePaymentCode;
let paymentCheckRunning = false;
let paymentGuideShown = "";
let paymentFinished = false;
let stopPaymentCountdown = () => {};

function schedulePaymentCheck() {
  window.clearTimeout(paymentPollTimer);
  if (activePaymentCode && !paymentFinished) {
    paymentPollTimer = window.setTimeout(() => checkOrder(activePaymentCode), 5000);
  }
}

window.addEventListener("pagehide", () => { window.clearTimeout(paymentPollTimer); stopPaymentCountdown(); });
document.addEventListener("visibilitychange", () => {
  if (!activePaymentCode || paymentFinished) return;
  if (document.hidden) window.clearTimeout(paymentPollTimer);
  else checkOrder(activePaymentCode);
});

function showPayment(order) {
  window.clearTimeout(paymentPollTimer);
  stopPaymentCountdown();
  activePaymentCode = order.code;
  paymentGuideShown = "";
  paymentFinished = false;
  const result = document.querySelector("#payment-result");
  result.classList.remove("payment-result--success");
  result.classList.remove("payment-result--expired");
  result.hidden = false;
  const qrUrl = paymentQrUrl(order);
  result.innerHTML = `<div><span class="eyebrow">Mã đơn ${escapeHtml(order.code)}</span><h2>Chuyển khoản đúng nội dung</h2><div class="bank-box"><p>${escapeHtml(order.bank_name || "Ngân hàng sẽ được cấu hình")}</p><strong>${escapeHtml(order.bank_account || "—")}</strong><span>${escapeHtml(order.account_name || "")}</span></div>${qrUrl ? `<div class="payment-qr"><img src="${qrUrl}" alt="Mã QR thanh toán đơn ${escapeHtml(order.code)}" loading="lazy"><small>Quét mã để điền sẵn số tiền và nội dung chuyển khoản. Kiểm tra đúng tên người nhận trước khi xác nhận.</small></div>` : ""}<dl><div><dt>Số tiền</dt><dd>${money(order.amount)}</dd></div><div><dt>Nội dung</dt><dd><code>${escapeHtml(order.transfer_content)}</code></dd></div></dl><button class="button button--outline" id="check-order" type="button">Kiểm tra thanh toán</button><p id="order-status" class="form-message" role="status" aria-live="polite">Đang chờ SePay xác nhận thanh toán. Trang sẽ tự cập nhật…</p><div id="post-payment-guide" hidden></div></div>`;
  document.querySelector("#check-order").addEventListener("click", () => checkOrder(order.code));
  stopPaymentCountdown = mountPaymentDeadline(result, order, () => checkOrder(order.code));
  schedulePaymentCheck();
}

async function checkOrder(code) {
  const status = document.querySelector("#order-status");
  if (!status || paymentCheckRunning || code !== activePaymentCode) return;
  window.clearTimeout(paymentPollTimer);
  if (document.hidden) return;
  paymentCheckRunning = true;
  const button = document.querySelector("#check-order");
  button.disabled = true;
  try {
    const order = await api(`/api/orders/${encodeURIComponent(code)}`);
    if (code !== activePaymentCode) return;
    const state = postPurchaseState(order);
    paymentFinished = state.terminal;
    if (order.status !== "pending") stopPaymentCountdown();
    if (order.expired_at) {
      const result = document.querySelector("#payment-result");
      result.classList.add("payment-result--expired");
      if (!result.querySelector("[data-reorder]")) {
        const link = document.createElement("a");
        link.href = "/thanh-toan/"; link.className = "button button--outline"; link.dataset.reorder = ""; link.textContent = "Tạo đơn mới";
        status.after(link);
      }
    }
    status.textContent = state.message;
    status.className = `form-message${state.paid ? " is-success" : ""}`;
    const guide = document.querySelector("#post-payment-guide");
    const guideType = state.showApkGuide ? "apk" : state.showGoldGuide ? "gold" : state.paid && !order.gold_revoked_at && order.platform === "iOS" ? "gold-pending" : "";
    if (guideType && guideType !== paymentGuideShown) {
      guide.innerHTML = guideType === "apk" ? apkInstallationGuide(order) : goldCompletionGuide(order);
      document.querySelector("#payment-result").classList.toggle("payment-result--success", guideType !== "apk");
      guide.hidden = false;
      paymentGuideShown = guideType;
      guide.scrollIntoView({ behavior: "smooth", block: "start" });
      if (guideType === "gold") {
        api("/api/public-config").then((config) => {
          const link = guide.querySelector("[data-gold-dns]");
          if (link && /^https:\/\//i.test(config.dns_url)) link.href = config.dns_url;
        }).catch(() => {});
      }
      if (guideType === "apk") {
        api("/api/public-config").then((config) => {
          const link = guide.querySelector("[data-apk-zalo]");
          if (link && config.support_zalo && /^https:\/\//i.test(config.support_zalo)) {
            link.href = config.support_zalo;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }
        }).catch(() => {});
      }
    } else if (!guideType) {
      document.querySelector("#payment-result").classList.remove("payment-result--success");
      guide.hidden = true;
      guide.replaceChildren();
      paymentGuideShown = "";
    }
  } catch (error) {
    status.textContent = `${error.message} Trang sẽ thử kiểm tra lại; bạn cũng có thể bấm Kiểm tra thanh toán.`;
  } finally {
    paymentCheckRunning = false;
    button.disabled = false;
    button.hidden = paymentFinished;
    if (!document.hidden) schedulePaymentCheck();
  }
}

function initCtv() {
  const form = document.querySelector("#ctv-login");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#ctv-message");
    try {
      const result = await api("/api/ctv/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const account = result.user ? result : await api("/api/ctv/me");
      await renderCtv(account.user, account.remote);
    } catch (error) { message.textContent = error.message; message.className = "form-message is-error"; }
  });
  api("/api/ctv/me").then(({ user, remote }) => renderCtv(user, remote)).catch(() => {});
}

async function renderCtv(user, remote = false) {
  document.querySelector("#ctv-login").hidden = true;
  const dashboard = document.querySelector("#ctv-dashboard");
  dashboard.hidden = false;
  dashboard.innerHTML = `<div class="portal-head"><div><span class="eyebrow">CTV đang hoạt động</span><h2>Xin chào, ${escapeHtml(user.username)}</h2></div><button id="ctv-logout" class="button button--outline button--small">Đăng xuất</button></div><div class="metric-grid"><article><span>Số dư</span><strong id="ctv-balance">${money(user.balance)}</strong></article><article><span>Tổng đơn</span><strong id="ctv-order-count">${Number(user.order_count || 0)}</strong></article><article><span>Đơn hoàn tất</span><strong id="ctv-completed-count">${Number(user.completed_count || 0)}</strong></article></div><div class="ctv-grid"><form id="ctv-order-form" class="form-card"><h2>Tạo đơn CTV</h2><label>Gói<select name="plan_id">${fallbackPlans.map((plan) => `<option value="${plan.id}">${plan.platform} · ${plan.name} · ${money(plan.price)}</option>`).join("")}</select></label><label>Tên người dùng Locket<input name="username" required maxlength="64" autocomplete="off"></label><button class="button" type="submit">Tạo đơn từ số dư</button><p class="form-message" aria-live="polite"></p></form><section class="history-card"><h2>Lịch sử đơn</h2><div id="ctv-orders"><p>Đang tải…</p></div></section></div>`;
  if (remote) {
    dashboard.dataset.remote = "true";
    dashboard.querySelector('.metric-grid article:nth-child(2) span').textContent = "Đơn trong lịch sử";
    document.querySelector("#ctv-order-count").textContent = "—";
    dashboard.querySelector('.metric-grid article:nth-child(3)').innerHTML = `<span>Lượt còn lại</span><strong id="ctv-completed-count">${Number(user.remaining || 0)}</strong>`;
    const select = dashboard.querySelector('select[name="plan_id"]');
    select.querySelector('option[value="android-lifetime"]')?.remove();
    [...select.options].forEach((option) => {
      const plan = fallbackPlans.find((item) => item.id === option.value);
      option.textContent = `${plan.platform} · ${plan.name}`;
    });
    const submit = dashboard.querySelector('#ctv-order-form button[type="submit"]');
    submit.textContent = "Cấp Gold bằng lượt NoDNS";
    const hint = document.createElement("p");
    hint.textContent = "Tài khoản và lượt được quản lý tại NoDNS. Gói vĩnh viễn có thể trừ 2 lượt theo cấu hình nhà cung cấp.";
    submit.before(hint);
  }
  document.querySelector("#ctv-logout").addEventListener("click", async () => { await api("/api/ctv/logout", { method: "POST" }); location.reload(); });
  document.querySelector("#ctv-order-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const orderForm = event.currentTarget;
    const message = orderForm.querySelector(".form-message");
    const submit = orderForm.querySelector('button[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      const result = await api("/api/ctv/orders", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(orderForm))) });
      message.textContent = `${result.message} Mã: ${result.code}`;
      message.className = "form-message is-success";
      orderForm.reset();
      const [{ user: freshUser }] = await Promise.all([api("/api/ctv/me"), loadCtvOrders()]);
      document.querySelector("#ctv-balance").textContent = money(freshUser.balance);
      if (!remote) document.querySelector("#ctv-order-count").textContent = freshUser.order_count;
      document.querySelector("#ctv-completed-count").textContent = remote ? freshUser.remaining : freshUser.completed_count;
    } catch (error) { message.textContent = error.message; message.className = "form-message is-error"; }
    finally { submit.disabled = false; }
  });
  loadCtvOrders();
}

async function loadCtvOrders() {
  const target = document.querySelector("#ctv-orders");
  if (!target) return;
  try {
    const { orders } = await api("/api/ctv/orders");
    if (document.querySelector("#ctv-dashboard")?.dataset.remote === "true") document.querySelector("#ctv-order-count").textContent = orders.length;
    target.innerHTML = orders.length ? `<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên người dùng</th><th>Gói</th><th>Trạng thái</th></tr></thead><tbody>${orders.map((order) => `<tr><td>${escapeHtml(order.code)}</td><td>${escapeHtml(order.username)}</td><td>${escapeHtml(planNameLabel(order.plan_name))}</td><td><span class="status status--${escapeHtml(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span></td></tr>`).join("")}</tbody></table></div>` : "<p>Chưa có đơn nào.</p>";
  } catch (error) { target.innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
}

function initAdmin() {
  const form = document.querySelector("#admin-login");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#admin-message");
    try { await api("/api/admin/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); await renderAdmin(); }
    catch (error) { message.textContent = error.message; message.className = "form-message is-error"; }
  });
  api("/api/admin/session").then(renderAdmin).catch(() => {});
}

async function renderAdmin() {
  const data = await api("/api/admin/overview");
  document.querySelector("#admin-login-wrap").hidden = true;
  const dash = document.querySelector("#admin-dashboard");
  dash.hidden = false;
  dash.innerHTML = `<aside class="admin-sidebar">${brand()}<nav><a href="#overview">▦ Bảng điều khiển</a><a href="#orders-admin">▤ Đơn hàng</a><a href="#plans-admin">⌑ Bảng giá</a><a href="#posts">✎ Bài viết</a><a href="#promos">％ Mã giảm giá</a><a href="#settings">⚙ Cấu hình công khai</a><a href="#ctv-admin">♙ Cộng tác viên</a></nav><button id="admin-logout">Đăng xuất</button></aside><div class="admin-main"><div class="admin-top"><div><small>QUẢN TRỊ / Bảng điều khiển</small><h1>Quản lý Locket Gold</h1></div><a class="button button--small" href="/">Xem trang web ↗</a></div><section id="overview" class="metric-grid"><article><span>Đơn khách lẻ</span><strong>${Number(data.orders || 0)}</strong></article><article><span>Đã thanh toán</span><strong>${Number(data.paid_orders || 0)}</strong></article><article><span>Cộng tác viên</span><strong>${Number(data.ctv_users || 0)}</strong></article><article><span>Bài viết</span><strong>${Number(data.posts || 0)}</strong></article></section>${adminForms()}</div>`;
  document.querySelector("#admin-logout").addEventListener("click", async () => { await api("/api/admin/logout", { method: "POST" }); location.reload(); });
  const integration = data.integration || {};
  const provider = document.createElement("section");
  provider.id = "provider-admin";
  provider.className = "admin-panel";
  provider.innerHTML = `<h2>Kết nối NoDNS</h2><p>API cấp Gold: <strong>${integration.nodns_key ? "Đã cấu hình khóa" : "Chưa cấu hình khóa API"}</strong> · Cơ sở dữ liệu: <strong>${integration.database ? "Đã kết nối" : "Chưa kết nối"}</strong></p><p>CTV: ${integration.remote_ctv ? "Tài khoản và lượt trên NoDNS" : "Tài khoản và số dư trong cơ sở dữ liệu"}. Đơn khách lẻ, giá, bài viết và mã giảm giá được quản lý trong cơ sở dữ liệu của trang web.</p><button id="provider-refresh" class="button button--outline" type="button">Kiểm tra API và lịch sử cấp Gold</button><div id="provider-result" aria-live="polite"></div>`;
  dash.querySelector("#overview").after(provider);
  addProviderKeyForm(provider, api);
  addAdminNoDns(dash, api, integration.remote_admin);
  addAdminSepay(dash, api, { escapeHtml, money });
  addAdminGold(dash, api, { escapeHtml });
  addAdminAccount(dash, api);
  addAdminWelcome(dash, api);
  addAdminPromos(dash, api, { escapeHtml, money });
  const providerLink = document.createElement("a");
  providerLink.href = "#provider-admin";
  providerLink.textContent = "⇄ API NoDNS";
  dash.querySelector(".admin-sidebar nav").append(providerLink);
  if (integration.remote_ctv) {
    dash.querySelector("#ctv-admin").innerHTML = '<h2>Tài khoản CTV NoDNS</h2><p>Cổng CTV sử dụng tài khoản, số dư và lượt trên NoDNS. Tài liệu hiện có chưa cung cấp chức năng quản trị để tạo tài khoản hoặc điều chỉnh số dư CTV.</p><a class="button button--outline" href="https://ctv.nodns.vn" target="_blank" rel="noopener">Mở hệ thống NoDNS ↗</a>';
  }
  document.querySelector("#provider-refresh").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    const target = document.querySelector("#provider-result");
    target.textContent = "Đang kiểm tra…";
    try {
      const { account, orders } = await api("/api/admin/provider");
      target.innerHTML = `<p>Tài khoản: <b>${escapeHtml(account.username)}</b> · Lượt còn lại: <b>${Number(account.remaining)}</b> · Đã dùng: ${Number(account.used)}</p>${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Tài khoản Locket</th><th>Trạng thái Gold</th><th>Ngày hết hạn</th></tr></thead><tbody>${orders.map((order) => `<tr><td>${escapeHtml(order.username)}</td><td>${escapeHtml(goldStatusLabel(order.status))}</td><td>${order.expiresAt ? escapeHtml(formatDate(order.expiresAt)) : order.lifetime ? "Vĩnh viễn" : "Chưa xác định"}</td></tr>`).join("")}</tbody></table></div>` : "<p>Chưa có lịch sử cấp Gold.</p>"}`;
    } catch (error) { target.textContent = error.message; }
    finally { button.disabled = false; }
  });
  const navLinks = [...dash.querySelectorAll(".admin-sidebar nav a")];
  const panels = [...dash.querySelectorAll(".admin-main > section")];
  const activate = (hash) => {
    const selected = panels.find((panel) => `#${panel.id}` === hash) || panels[0];
    panels.forEach((panel) => { panel.hidden = panel !== selected; });
    navLinks.forEach((link) => {
      const active = link.hash === `#${selected.id}`;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (selected.id === "orders-admin") loadAdminOrders();
    if (selected.id === "promos") selected.dispatchEvent(new Event("promos-refresh"));
  };
  navLinks.forEach((link) => link.addEventListener("click", () => activate(link.hash)));
  window.addEventListener("hashchange", () => activate(location.hash));
  activate(location.hash || "#overview");
  bindAdminForms();
  initPostImages(dash, api);
}

function adminForms() {
  return `<section id="orders-admin" class="admin-panel"><h2>Đơn hàng mới nhất</h2><div id="admin-orders"><p>Đang tải…</p></div></section>
  <section id="plans-admin" class="admin-panel"><h2>Cập nhật bảng giá</h2><p>Giá cũ chỉ hiển thị khi nhập mức giá thật cao hơn giá đang bán; để trống nếu không có khuyến mãi.</p><form data-admin-endpoint="/api/admin/plans"><div class="form-row"><label>Gói<select name="id">${fallbackPlans.map((plan) => `<option value="${plan.id}">${plan.platform} · ${plan.name}</option>`).join("")}</select></label><label>Giá hiện tại (VNĐ)<input name="price" type="number" min="0" step="1000" required></label></div><label>Giá cũ (tùy chọn)<input name="old_price" type="number" min="0" step="1000"></label><button class="button" type="submit">Lưu giá</button><p class="form-message"></p></form></section>
  <section id="posts" class="admin-panel"><h2>Đăng bài viết</h2><form data-admin-endpoint="/api/admin/posts"><label>Tiêu đề<input name="title" required maxlength="140"></label><label>Đoạn giới thiệu<textarea name="excerpt" required maxlength="320"></textarea></label><label>Nội dung<textarea name="content" required rows="8"></textarea></label><button class="button" type="submit">Xuất bản</button><p class="form-message"></p></form></section>
  <section id="promos" class="admin-panel"><h2>Tạo mã giảm giá</h2><form data-admin-endpoint="/api/admin/promos"><div class="form-row"><label>Mã<input name="code" required maxlength="32"></label><label>Phần trăm<input name="percent" type="number" min="1" max="100" required></label></div><label>Ngày hết hạn<input name="expires_at" type="datetime-local"></label><button class="button" type="submit">Lưu mã</button><p class="form-message"></p></form></section>
  <section id="settings" class="admin-panel"><h2>Cấu hình đường dẫn</h2><p>Đổi khóa NoDNS tại mục API NoDNS. Khóa xác thực SePay được quản lý trong cấu hình máy chủ.</p><form data-admin-endpoint="/api/admin/settings"><label>Đường dẫn tải DNS<input name="dns_url" type="url"></label><label>Đường dẫn APK Android<input name="apk_url" type="url"></label><label>API kích hoạt (URL, không phải khóa API)<input name="upstream_api_url" type="url"></label><label>Nhóm hỗ trợ Zalo<input name="support_zalo" type="url" placeholder="https://zalo.me/..."></label><label>Trang hỗ trợ Facebook<input name="support_facebook" type="url" placeholder="https://facebook.com/..."></label><label>Telegram hỗ trợ<input name="support_telegram" type="url" placeholder="https://t.me/ten_tai_khoan"></label><button class="button" type="submit">Lưu cấu hình</button><p class="form-message"></p></form></section>
  <section id="ctv-admin" class="admin-panel"><h2>Tạo tài khoản CTV</h2><form data-admin-endpoint="/api/admin/ctv"><div class="form-row"><label>Tên đăng nhập<input name="username" required></label><label>Mật khẩu ban đầu<input name="password" type="password" minlength="10" required></label></div><label>Số dư ban đầu<input name="initial_balance" type="number" min="0" step="1000" value="0"></label><button class="button" type="submit">Tạo CTV</button><p class="form-message"></p></form><hr><h2>Điều chỉnh số dư</h2><form data-admin-endpoint="/api/admin/ctv/balance"><div class="form-row"><label>Tên đăng nhập CTV<input name="username" required></label><label>Số tiền thay đổi<input name="delta" type="number" step="1000" required placeholder="50000 hoặc -50000"></label></div><button class="button" type="submit">Cập nhật số dư</button><p class="form-message"></p></form></section>`;
}

async function loadAdminOrders() {
  const target = document.querySelector("#admin-orders");
  if (!target) return;
  try {
    const { orders } = await api("/api/admin/orders");
    target.innerHTML = orders.length ? `<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên người dùng</th><th>Liên hệ</th><th>Gói</th><th>Số tiền</th><th>Trạng thái</th></tr></thead><tbody>${orders.map((order) => `<tr><td>${escapeHtml(order.code)}</td><td>${escapeHtml(order.username)}</td><td>${escapeHtml(order.contact)}</td><td>${escapeHtml(planNameLabel(order.plan_name))}</td><td>${money(order.amount)}</td><td><span class="status status--${escapeHtml(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span></td></tr>`).join("")}</tbody></table></div>` : "<p>Chưa có đơn hàng.</p>";
    target.querySelectorAll("tbody tr").forEach((row, index) => {
      if (orders[index]?.gold_revoked_at) {
        const badge = row.querySelector(".status");
        badge.textContent = "Gold đã hủy";
        badge.className = "status status--cancelled";
      } else if (orders[index]?.expired_at) {
        const badge = row.querySelector(".status");
        badge.textContent = "Hết hạn thanh toán";
        badge.className = "status status--cancelled";
      }
    });
  } catch (error) { target.innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
}

function bindAdminForms() {
  document.querySelectorAll("[data-admin-endpoint]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = form.querySelector(".form-message");
    try {
      const result = await api(form.dataset.adminEndpoint, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      message.textContent = result.message || "Đã lưu.";
      message.className = "form-message is-success";
      form.reset();
    } catch (error) { message.textContent = error.message; message.className = "form-message is-error"; }
  }));
}

let activityAudio;

function initActivitySound() {
  if (!document.querySelector("#activity-toast")) return;
  const unlock = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      activityAudio ||= new AudioContext();
      if (activityAudio.state === "suspended") activityAudio.resume().catch(() => {});
    } catch { /* The notification still works when audio is unavailable. */ }
  };
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", unlock);
}

function playActivitySound() {
  if (activityAudio?.state !== "running") return;
  const start = activityAudio.currentTime;
  [0, 0.22].forEach((offset, index) => {
    const tone = activityAudio.createOscillator();
    const volume = activityAudio.createGain();
    tone.type = "sine";
    tone.frequency.value = index ? 1318.51 : 1046.5;
    volume.gain.setValueAtTime(0, start + offset);
    volume.gain.linearRampToValueAtTime(0.1, start + offset + 0.01);
    volume.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.35);
    tone.connect(volume);
    volume.connect(activityAudio.destination);
    tone.start(start + offset);
    tone.stop(start + offset + 0.36);
    tone.onended = () => { tone.disconnect(); volume.disconnect(); };
  });
}

async function showActivity() {
  const toast = document.querySelector("#activity-toast");
  if (!toast) return;
  const welcome = document.querySelector("#welcome-modal");
  if (welcome?.open) {
    welcome.addEventListener("close", showActivity, { once: true });
    return;
  }
  const names = ["belin", "minhanh", "ngoc", "thao", "linh", "quynh", "baongoc", "huy", "khanh", "tuan", "phuong", "trang"];
  const plans = [...new Set(fallbackPlans.map((plan) => plan.name))];
  const pick = (items) => items[Math.floor(Math.random() * items.length)];
  let dismissed = false;
  const render = (item) => {
    if (dismissed) return;
    const activity = item || { username: `@${pick(names)}***`, plan_name: pick(plans) };
    const avatar = '<span class="activity-icon" aria-hidden="true"><img src="/images/huyhieu.png" alt="" width="48" height="48"></span>';
    toast.innerHTML = `<button type="button" aria-label="Đóng">×</button>${avatar}<div class="activity-copy"><div><strong>Giao dịch đã xác thực</strong><span class="activity-dot" aria-hidden="true">·</span></div><p><b>${escapeHtml(activity.username)}</b> vừa nâng cấp <b class="activity-plan">${escapeHtml(activity.plan_name)}</b></p></div>`;
    toast.hidden = false;
    playActivitySound();
    toast.querySelector("button").addEventListener("click", () => { dismissed = true; toast.hidden = true; });
  };
  render(null);
  window.setTimeout(() => { dismissed = true; toast.hidden = true; }, 9000);
}

function relativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "mới đây";
  const elapsedSeconds = Math.max(0, (Date.now() - timestamp) / 1000);
  const formatter = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
  if (elapsedSeconds >= 86400 * 30) return new Intl.DateTimeFormat("vi", { day: "numeric", month: "short" }).format(timestamp);
  if (elapsedSeconds >= 86400) return formatter.format(-Math.floor(elapsedSeconds / 86400), "day");
  if (elapsedSeconds >= 3600) return formatter.format(-Math.floor(elapsedSeconds / 3600), "hour");
  if (elapsedSeconds >= 60) return formatter.format(-Math.floor(elapsedSeconds / 60), "minute");
  return "vừa xong";
}

initNavigation();
initFeedbackGallery();
initGuide();
loadPlans();
loadPosts();
loadDownloads();
initWelcomeModal();
initCheckout();
initCtv();
initAdmin();
initActivitySound();
window.setTimeout(showActivity, 15000);
