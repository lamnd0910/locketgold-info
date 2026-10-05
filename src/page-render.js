import { DEFAULT_PLANS as fallbackPlans } from "./plans.js";
import { FALLBACK_POSTS as fallbackPosts } from "./fallback-posts.js";
import { welcomeMarkup } from "./welcome-notice.js";
import { postCards, formatDate } from "./post-view.js";

export function createPageRenderer(page, search = "") {
  const defaultDnsUrl = "https://ctv.nodns.vn/cai-dns";


  const navItems = [
    ["home", "/", "Trang chủ", "⌂"],
    ["pricing", "/len-gold/", "Lên Gold", "♛"],
    ["trust", "/uy-tin/", "Uy tín", "✧"],
    ["posts", "/bai-viet/", "Bài viết", "▤"],
    ["guide", "/huong-dan/", "Hướng dẫn", "▣"],
    ["ctv", "/cong-tac-vien/", "Cộng tác viên", "♙"],
    ["contact", "/lien-he/", "Liên hệ", "☎"],
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
    </div><div class="container footer-bottom"><span>© <span id="current-year">${new Date().getFullYear()}</span> Locket Gold</span><span>Không liên kết hoặc đại diện cho Locket Labs, Inc.</span></div></footer>`;
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

  function checkoutPage() {
    const selected = new URLSearchParams(search).get("plan") || "ios-lifetime";
    return publicShell(`${pageHero("Thanh toán", "Đặt gói không cần đăng nhập", "Bốn bước rõ ràng. Chỉ nhập Tên người dùng Locket; tuyệt đối không cung cấp mật khẩu hoặc OTP.")}<section class="section section--compact"><div class="container checkout-flow">
      <ol id="checkout-progress" class="checkout-progress" aria-label="Tiến trình đặt hàng"><li aria-current="step"><b>1</b><span>Thông tin</span></li><li><b>2</b><span>Xác nhận</span></li><li><b>3</b><span>Chọn gói</span></li><li><b>4</b><span>Thanh toán</span></li></ol>
      <div class="checkout-layout"><form id="checkout-form" class="form-card" novalidate>
        <section class="checkout-step" data-checkout-step="1"><span class="eyebrow">Bước 1 / 4</span><h2 tabindex="-1">Nhập thông tin</h2><p>Thông tin này dùng để tạo đơn và liên hệ khi cần hỗ trợ.</p><label>Tên người dùng Locket<span class="input-with-action"><input name="username" autocomplete="off" minlength="2" maxlength="65" required placeholder="Ví dụ: @username"><button class="button button--outline button--small" type="button" id="paste-username">Dán</button></span><small>Dán đường dẫn hồ sơ Locket để tự tách Tên người dùng nếu đường dẫn có định dạng được hỗ trợ.</small></label><label>Thư điện tử hoặc số điện thoại hỗ trợ<input name="contact" autocomplete="email" maxlength="120" required placeholder="Để nhận trạng thái đơn"></label><p id="checkout-account-message" class="form-message" aria-live="polite"></p><div class="checkout-step-actions"><button class="button" type="button" data-checkout-next>Tiếp tục →</button></div></section>
        <section class="checkout-step" data-checkout-step="2" hidden><span class="eyebrow">Bước 2 / 4</span><h2 tabindex="-1">Xác nhận tài khoản Locket</h2><div class="checkout-confirm"><div id="locket-profile" class="locket-profile"></div><small>Tên người dùng bạn đã nhập</small><strong id="confirm-username">—</strong><small>Liên hệ: <span id="confirm-contact">—</span></small></div><p class="checkout-disclaimer">Thông tin tài khoản được tra cứu qua Locketgold.info. Hãy đối chiếu tên, ảnh và Tên người dùng với tài khoản của bạn trước khi tiếp tục.</p><label class="consent"><input name="username_confirmed" type="checkbox"> Tôi đã kiểm tra đúng Tên người dùng của mình.</label><p id="checkout-confirm-message" class="form-message" aria-live="polite"></p><div class="checkout-step-actions"><button class="button button--outline" type="button" data-checkout-back>← Quay lại</button><button class="button" type="button" data-checkout-next>Tiếp tục →</button></div></section>
        <section class="checkout-step" data-checkout-step="3" hidden><span class="eyebrow">Bước 3 / 4</span><h2 tabindex="-1">Chọn gói Gold</h2><p>Kiểm tra nền tảng, thời hạn và giá trước khi tạo đơn.</p><fieldset class="checkout-plan-fieldset"><legend class="sr-only">Chọn gói Gold</legend><div id="checkout-plan-options" class="checkout-plan-options">${checkoutPlanOptions(fallbackPlans, selected)}</div></fieldset><div class="promo-row"><label>Mã giảm giá<input name="promo_code" maxlength="32" placeholder="Nhập mã nếu có"></label><button class="button button--outline" type="button" id="apply-promo">Áp dụng</button></div><p id="quote-message" class="form-message" aria-live="polite"></p><div class="checkout-step-actions"><button class="button button--outline" type="button" data-checkout-back>← Quay lại</button><button class="button" type="button" data-checkout-next>Kiểm tra đơn →</button></div></section>
        <section class="checkout-step" data-checkout-step="4" hidden><span class="eyebrow">Bước 4 / 4</span><h2 tabindex="-1">Kiểm tra & tạo đơn</h2><dl class="checkout-review"><div><dt>Tên người dùng</dt><dd id="review-username">—</dd></div><div><dt>Liên hệ</dt><dd id="review-contact">—</dd></div><div><dt>Gói Gold</dt><dd id="review-plan">—</dd></div><div><dt>Số tiền</dt><dd id="review-total">—</dd></div></dl><p class="checkout-disclaimer">Bấm tạo đơn chưa chuyển tiền. Thông tin ngân hàng và mã nội dung chuyển khoản chỉ xuất hiện sau khi đơn được tạo thành công.</p><label class="consent"><input name="order_confirmed" type="checkbox"> Tôi xác nhận thông tin và gói đã chọn là chính xác.</label><p id="checkout-submit-message" class="form-message" aria-live="polite"></p><div class="checkout-step-actions"><button class="button button--outline" type="button" data-checkout-back>← Quay lại</button><button class="button" type="submit">Tạo đơn thanh toán</button></div></section>
        <p class="privacy-line">🔒 Không yêu cầu đăng nhập, mật khẩu hay OTP.</p></form>
        <aside id="order-summary" class="summary-card"><h2>Tóm tắt tạm tính</h2><p>Gói đã chọn</p><strong id="summary-plan">—</strong><dl><div><dt>Giá gói</dt><dd id="summary-price">—</dd></div><div><dt>Giảm giá</dt><dd id="summary-discount">0đ</dd></div><div class="summary-total"><dt>Dự kiến</dt><dd id="summary-total">—</dd></div></dl><p class="summary-help">Số tiền chính thức và thông tin chuyển khoản được xác nhận khi tạo đơn.</p></aside>
      </div><div id="payment-result" class="payment-result" hidden></div></section>`);
  }

  function ctvPage() {
    return publicShell(`${pageHero("Cộng tác viên", "Quản lý đơn gọn trong một nơi", "Đăng nhập tài khoản do quản trị viên cấp để xem số dư và tạo đơn CTV.")}<section class="section section--compact"><div class="container portal-wrap"><form id="ctv-login" method="post" class="form-card form-card--narrow"><h2>Đăng nhập CTV</h2><label>Tên đăng nhập<input name="username" autocomplete="username" required></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required></label><button class="button" type="submit">Đăng nhập</button><p id="ctv-message" class="form-message" aria-live="polite"></p></form><div id="ctv-dashboard" class="portal-dashboard" hidden></div></div></section>`);
  }

  function adminPage() {
    return `<main class="admin-shell"><section id="admin-login-wrap" class="admin-login"><div>${brand()}<form id="admin-login" class="form-card form-card--narrow"><span class="eyebrow">Khu vực bảo mật</span><h1>Đăng nhập quản trị</h1><label>Tên đăng nhập<input name="username" autocomplete="username" required value="admin"></label><label>Mật khẩu quản trị<input name="password" type="password" autocomplete="current-password" required></label><button class="button" type="submit">Đăng nhập</button><p id="admin-message" class="form-message" aria-live="polite"></p></form></div></section><section id="admin-dashboard" class="admin-dashboard" hidden></section></main>`;
  }


  return { render: () => (pages[page] || pages.home)(), defaultDnsUrl, money, escapeHtml, brand, publicShell, planCards, checkoutPlanOptions, postCards, formatDate };
}
