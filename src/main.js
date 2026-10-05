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
import { createPageRenderer } from "./page-render.js";
import { articleMarkup, archiveView } from "./post-view.js";
import { mergePostArchive } from "./post-archive.js";
import { FALLBACK_POSTS as fallbackPosts } from "./fallback-posts.js";
import { postUrl } from "./sitemap.js";
import { postForDisplay } from "./post-brand.js";
import { mountPaymentDeadline } from "./payment-deadline.js";
import { addAdminAccount } from "./admin-account.js";
import { addAdminWelcome } from "./admin-welcome.js";
import { addAdminPromos } from "./admin-promos.js";
import { welcomeMarkup, shouldShowWelcome } from "./welcome-notice.js";
import { orderStatusLabel, goldStatusLabel, planNameLabel } from "./vietnamese.js";

const page = document.body.dataset.page || "home";
const app = document.querySelector("#app");
const { render, defaultDnsUrl, money, escapeHtml, brand, planCards, checkoutPlanOptions, formatDate } = createPageRenderer(page, location.search);

if (!app.hasChildNodes()) app.innerHTML = render();
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
    list.innerHTML = articleMarkup(post);
    document.querySelector(".page-hero")?.remove();
    document.title = `${post.title} | Locket Gold`;
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", postUrl(post.slug));
    document.querySelector('meta[name="description"]')?.setAttribute("content", post.excerpt || post.title);
  };
  if (localPost) renderPost(localPost);
  else if (slug && !list.hasAttribute("data-rendered-post")) { list.className = "article-view"; list.innerHTML = '<p role="status">Đang tải bài viết…</p>'; }
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
    const view = archiveView(posts, new URLSearchParams(location.search).get("trang"));
    list.innerHTML = view.cards;
    document.querySelector(".post-archive-controls")?.remove();
    list.insertAdjacentHTML("afterend", view.controls);
  } catch {
    if (slug && !localPost && !list.hasAttribute("data-rendered-post")) list.innerHTML = '<article><h2>Chưa tìm thấy bài viết</h2><p>Bài viết có thể chưa được xuất bản hoặc tạm thời không tải được.</p><a class="text-link" href="/bai-viet/">← Tất cả bài viết</a></article>';
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
