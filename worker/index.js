import { normalizeUsername } from "../src/username.js";
import { DEFAULT_PLANS } from "../src/plans.js";
import { activationConfirmed } from "./activation.js";
import { adminCredential, passwordHash, verifyAdminPassword } from "./admin-account.js";
import { DEFAULT_WELCOME, validateWelcome } from "../src/welcome-notice.js";
import { downloadAndroidApk } from "./android-apk.js";
import { sitemapResponse, postsResponse } from "./seo.js";
import { providerRequest, unwrap, grantPayload, remoteCookie, remoteLogin, clearRemoteCookie, publicCtv, portalOrders, resolveNoDnsEnv, encryptNoDnsKey, sameGoldExpiry, purchasedGoldExpiry, providerGoldOrder } from "./nodns.js";

const loginAttempts = new Map();
const encoder = new TextEncoder();

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(Promise.all([expirePendingOrders(env), repairQueuedGoldExpiries(env)])); },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/sitemap.xml") return sitemapResponse(request, env);
    if (url.pathname === "/bai-viet/" && ["GET", "HEAD"].includes(request.method)) {
      try { return await postsResponse(request, env); }
      catch (error) {
        console.error("Article metadata unavailable", error);
        return new Response("Temporarily unavailable", { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
      }
    }
    if (url.pathname.startsWith("/downloads/android/")) return secure(new Response("Not found", { status: 404 }));
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: securityHeaders() });
      if (request.method !== "GET" && url.pathname !== "/api/sepay/webhook") assertSameOrigin(request, env);
      if (["/api/public-config", "/api/sepay/webhook", "/api/ctv/orders", "/api/admin/provider", "/api/admin/gold/cancel"].includes(url.pathname)) {
        if (url.pathname.startsWith("/api/admin/")) await requireSession(request, env, "admin");
        env = await resolveNoDnsEnv(env);
      }
      const response = await route(request, env, ctx, url);
      return secure(response);
    } catch (error) {
      const status = Number(error.status) || 500;
      if (status >= 500) console.error("API error", error);
      return secure(json({ error: status >= 500 ? error.publicMessage || "Hệ thống đang bận hoặc chưa được cấu hình." : error.message }, status));
    }
  },
};

async function route(request, env, ctx, url) {
  const { pathname } = url;
  if (pathname === "/api/locket/userinfo" && request.method === "GET") {
    rateLimit(request, "lookup", 30, 60_000);
    const username = normalizeUsername(url.searchParams.get("user"));
    if (!username) throw httpError(400, "Tên người dùng không hợp lệ.");
    const { result } = await providerRequest(env, `/api/v1/userinfo?user=${encodeURIComponent(username)}`);
    const data = unwrap(result);
    if (!data.uid) throw httpError(404, "Không tìm thấy tài khoản Locket.");
    return json({ username: data.username || username, uid: data.uid, full_name: data.full_name || data.fullName || "", avatar: cleanUrl(data.profile_picture_url || data.avatar), gold: { has_gold: data.gold?.has_gold === true, expiry_date: data.gold?.expiry_date || null } });
  }
  if (env.NODNS_CTV_PORTAL === "true" && pathname.startsWith("/api/ctv/")) return remoteCtvRoute(request, env, pathname);
  if (pathname === "/api/plans" && request.method === "GET") return getPlans(env);
  if (pathname === "/api/posts" && request.method === "GET") return getPosts(env);
  if (pathname.startsWith("/api/posts/") && request.method === "GET") return getPost(env, decodeURIComponent(pathname.slice(11)));
  if (pathname === "/api/public-config" && request.method === "GET") return getPublicConfig(env);
  if (pathname === "/api/welcome" && request.method === "GET") return json(await getWelcome(env));
  if (pathname === "/api/activity" && request.method === "GET") return getActivity(env);
  if (pathname === "/api/quote" && request.method === "POST") return quoteOrder(request, env);
  if (pathname === "/api/orders" && request.method === "POST") return createOrder(request, env);
  const apkDownload = pathname.match(/^\/api\/orders\/([^/]+)\/apk$/);
  if (apkDownload && request.method === "GET") return downloadAndroidApk(request, env, apkDownload[1]);
  if (pathname.startsWith("/api/orders/") && request.method === "GET") return getOrder(env, decodeURIComponent(pathname.slice(12)));
  if (pathname === "/api/sepay/webhook" && request.method === "POST") return sepayWebhook(request, env, ctx);

  if (pathname === "/api/admin/login" && request.method === "POST") return adminLogin(request, env);
  if (pathname === "/api/admin/account") return adminAccount(request, env);
  if (pathname === "/api/admin/welcome") return adminWelcome(request, env);
  if (pathname === "/api/admin/logout" && request.method === "POST") return logout("lg_admin");
  if (pathname === "/api/admin/session" && request.method === "GET") { await requireSession(request, env, "admin"); return json({ authenticated: true }); }
  if (pathname === "/api/admin/overview" && request.method === "GET") return adminOverview(request, env);
  if (pathname.startsWith("/api/admin/nodns/")) return adminNoDnsAuth(request, env, pathname);
  if (pathname === "/api/admin/provider" && request.method === "GET") {
    await requireSession(request, env, "admin");
    const [{ result: account }, { result: history }] = await Promise.all([
      providerRequest(env, "/api/v1/me", { apiKey: true }),
      providerRequest(env, "/api/v1/orders?limit=100", { apiKey: true }),
    ]);
    const data = unwrap(account);
    const rows = unwrap(history);
    return json({ account: { username: data.username, remaining: Number(data.remaining || 0), total: Number(data.total || 0), used: Number(data.used || 0), active: data.active === true }, orders: (Array.isArray(rows) ? rows : rows.orders || []).map(providerGoldOrder) });
  }
  if (pathname === "/api/admin/orders" && request.method === "GET") return adminOrders(request, env);
  if (pathname === "/api/admin/images" && request.method === "POST") return uploadPostImage(request, env);
  if (pathname.startsWith("/api/images/") && request.method === "GET") return getPostImage(env, pathname.slice(12));
  if (pathname === "/api/admin/provider/key") return adminProviderKey(request, env);
  if (pathname === "/api/admin/sepay" && request.method === "GET") return adminSepay(request, env);
  if (pathname === "/api/admin/gold/cancel" && request.method === "POST") return adminCancelGold(request, env);
  if (pathname === "/api/admin/gold/cancellations" && request.method === "GET") {
    await requireSession(request, env, "admin"); requireDb(env);
    const { results } = await env.DB.prepare("SELECT username, admin_username, refunded, remaining, created_at FROM gold_cancellations ORDER BY id DESC LIMIT 50").all();
    return json({ cancellations: results || [] });
  }
  if (pathname === "/api/admin/posts" && request.method === "POST") return adminCreatePost(request, env);
  if (pathname === "/api/admin/promos" && request.method === "POST") return adminCreatePromo(request, env);
  if (pathname === "/api/admin/promos" && request.method === "GET") return adminListPromos(request, env);
  if (pathname === "/api/admin/promos/cancel" && request.method === "POST") return adminCancelPromo(request, env);
  if (pathname === "/api/admin/plans" && request.method === "POST") return adminSavePlan(request, env);
  if (pathname === "/api/admin/settings" && request.method === "POST") return adminSaveSettings(request, env);
  if (pathname === "/api/admin/ctv" && request.method === "POST") return adminCreateCtv(request, env);
  if (pathname === "/api/admin/ctv/balance" && request.method === "POST") return adminUpdateCtvBalance(request, env);

  if (pathname === "/api/ctv/login" && request.method === "POST") return ctvLogin(request, env);
  if (pathname === "/api/ctv/logout" && request.method === "POST") return logout("lg_ctv");
  if (pathname === "/api/ctv/me" && request.method === "GET") return ctvMe(request, env);
  if (pathname === "/api/ctv/orders" && request.method === "GET") return ctvOrders(request, env);
  if (pathname === "/api/ctv/orders" && request.method === "POST") return ctvCreateOrder(request, env, ctx);
  throw httpError(404, "Không tìm thấy API.");
}

async function adminNoDnsAuth(request, env, pathname) {
  await requireSession(request, env, "admin");
  if (pathname === "/api/admin/nodns/login" && request.method === "POST") {
    rateLimit(request, "nodns-admin-login", 6, 15 * 60_000);
    const body = await readJson(request);
    if (!body || typeof body.username !== "string" || !body.username.trim() || body.username.length > 100 || typeof body.password !== "string" || !body.password || body.password.length > 1000) throw httpError(400, "Cần nhập tên đăng nhập và mật khẩu admin NoDNS.");
    const cookie = await remoteLogin(request, env, "admin", { username: body.username.trim(), password: body.password });
    return withCookie(json({ authenticated: true }), cookie);
  }
  if (pathname === "/api/admin/nodns/me" && request.method === "GET") {
    const cookie = await remoteCookie(request, env, "admin");
    const { result } = await providerRequest(env, "/api/auth/me", { cookie });
    const data = unwrap(result);
    if (result.authenticated === false || data.authenticated === false) throw httpError(401, "Phiên admin NoDNS đã hết hạn.");
    const user = data.user ?? data.admin ?? data;
    return json({ authenticated: true, username: typeof user.username === "string" ? user.username : null });
  }
  if (pathname === "/api/admin/nodns/logout" && request.method === "POST") {
    const cookie = await remoteCookie(request, env, "admin");
    await providerRequest(env, "/api/auth/logout", { method: "POST", cookie });
    const response = withCookie(json({ authenticated: false }), clearRemoteCookie("admin"));
    return env.NODNS_ADMIN_AUTH === "true" ? withCookie(response, "lg_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0") : response;
  }
  throw httpError(404, "Không tìm thấy API admin NoDNS.");
}

async function getPlans(env) {
  if (!env.DB) return json({ plans: DEFAULT_PLANS.map(normalizePlan) });
  const { results } = await env.DB.prepare("SELECT id, name, platform, price, old_price, period, featured FROM plans WHERE enabled = 1 ORDER BY sort_order, price").all();
  return json({ plans: (results?.length ? results : DEFAULT_PLANS).map(normalizePlan) });
}

function normalizePlan(plan) {
  return { ...plan, price: Number(plan.price), featured: Boolean(plan.featured) };
}

async function getPosts(env) {
  if (!env.DB) return json({ posts: [] });
  const { results } = await env.DB.prepare("SELECT slug, title, excerpt, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC").all();
  return json({ posts: results || [] });
}

async function getPost(env, slug) {
  if (!env.DB) throw httpError(404, "Bài viết chưa được xuất bản.");
  const safeSlug = cleanText(slug, 120).replace(/[^a-z0-9-]/g, "");
  const post = await env.DB.prepare("SELECT slug, title, excerpt, content, published_at FROM posts WHERE slug = ? AND status = 'published'").bind(safeSlug).first();
  if (!post) throw httpError(404, "Không tìm thấy bài viết.");
  return json(post);
}

async function getPublicConfig(env) {
  const settings = await readSettings(env, ["dns_url", "apk_url", "support_email", "support_zalo", "support_facebook", "support_telegram"]);
  let profileUrl = "";
  if (!settings.dns_url && !env.DNS_DOWNLOAD_URL && env.NODNS_API_KEY) {
    try {
      const { result } = await providerRequest(env, "/api/v1/profile", { apiKey: true });
      profileUrl = cleanUrl(unwrap(result).profile_url);
    } catch { /* Keep the configured default download when NoDNS is unavailable. */ }
  }
  return json({
    dns_url: settings.dns_url || env.DNS_DOWNLOAD_URL || profileUrl || "https://ctv.nodns.vn/cai-dns",
    apk_url: settings.apk_url || env.ANDROID_APK_URL || "",
    support_email: settings.support_email || env.SUPPORT_EMAIL || "",
    support_zalo: settings.support_zalo || env.SUPPORT_ZALO_URL || "",
    support_facebook: settings.support_facebook || env.SUPPORT_FACEBOOK_URL || "",
    support_telegram: settings.support_telegram || env.SUPPORT_TELEGRAM_URL || "",
  });
}

async function getActivity(env) {
  if (!env.DB) return json({ activities: [] });
  const { results } = await env.DB.prepare("SELECT username, plan_name, paid_at FROM orders WHERE status IN ('paid','completed') AND paid_at IS NOT NULL ORDER BY paid_at DESC LIMIT 8").all();
  return json({ activities: (results || []).map((item) => ({ username: maskUsername(item.username), plan_name: item.plan_name, paid_at: item.paid_at })) });
}

async function quoteOrder(request, env) {
  const body = await readJson(request);
  const plan = await findPlan(env, body.plan_id);
  if (!plan) throw httpError(400, "Gói đã chọn không tồn tại.");
  const promoCode = cleanText(body.promo_code, 32);
  const promo = promoCode ? await findPromo(env, promoCode) : null;
  if (promoCode && !promo) throw httpError(400, "Mã giảm giá không hợp lệ hoặc đã hết hạn.");
  const discountAmount = promo ? Math.floor(Number(plan.price) * Number(promo.percent) / 100) : 0;
  return json({ subtotal: Number(plan.price), discount_percent: Number(promo?.percent || 0), discount_amount: discountAmount, total: Number(plan.price) - discountAmount });
}

async function createOrder(request, env) {
  requireDb(env);
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const contact = cleanText(body.contact, 120);
  if (!username) throw httpError(400, "Tên người dùng chỉ gồm 2–64 chữ, số, dấu chấm, gạch dưới hoặc gạch ngang; không dán đường dẫn.");
  if (contact.length < 3) throw httpError(400, "Vui lòng nhập thông tin liên hệ.");
  const plan = await findPlan(env, body.plan_id);
  if (!plan) throw httpError(400, "Gói đã chọn không tồn tại.");
  const promo = body.promo_code ? await findPromo(env, body.promo_code) : null;
  if (body.promo_code && !promo) throw httpError(400, "Mã giảm giá không hợp lệ hoặc đã hết hạn.");
  const discount = promo ? Math.floor(Number(plan.price) * Number(promo.percent) / 100) : 0;
  const amount = Number(plan.price) - discount;
  const code = `LG${randomCode(8)}`;
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  await env.DB.prepare("INSERT INTO orders (code, username, contact, plan_id, plan_name, platform, subtotal, discount_amount, amount, promo_code, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')")
    .bind(code, username, contact, plan.id, plan.name, plan.platform, Number(plan.price), discount, amount, promo?.code || null, expiresAt).run();
  return json({ code, amount, expires_at: expiresAt, ...transferDetails(env, code) }, 201);
}

async function expirePendingOrders(env) {
  if (!env.DB) return;
  return env.DB.prepare("UPDATE orders SET status = 'cancelled', expired_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= ?")
    .bind(new Date().toISOString()).run();
}

function transferDetails(env, code) {
  return { transfer_content: code, bank_name: env.BANK_NAME || "", bank_bin: env.BANK_BIN || "", bank_account: env.BANK_ACCOUNT || "", account_name: env.BANK_ACCOUNT_NAME || "" };
}

async function getOrder(env, code) {
  requireDb(env);
  if (!/^LG[A-Z0-9]{8}$/.test(code)) throw httpError(400, "Mã đơn không hợp lệ.");
  await expirePendingOrders(env);
  const order = await env.DB.prepare("SELECT code, username, plan_name, platform, amount, status, expires_at, expired_at, gold_revoked_at, created_at, paid_at, completed_at FROM orders WHERE code = ?").bind(code).first();
  if (!order) throw httpError(404, "Không tìm thấy đơn.");
  return json({ ...order, ...transferDetails(env, code) });
}

async function sepayWebhook(request, env, ctx) {
  requireDb(env);
  if (!env.SEPAY_WEBHOOK_API_KEY) throw httpError(503, "Webhook chưa được cấu hình.");
  const authorization = request.headers.get("Authorization") || "";
  if (!(await constantTimeEqual(authorization, `Apikey ${env.SEPAY_WEBHOOK_API_KEY}`))) throw httpError(401, "Webhook không hợp lệ.");
  const payload = await readJson(request);
  if (!Number.isFinite(Number(payload.transferAmount)) || Number(payload.transferAmount) < 0) throw httpError(400, "Số tiền giao dịch không hợp lệ.");
  const transactionId = String(payload.id || "");
  if (!transactionId) throw httpError(400, "Thiếu mã giao dịch.");
  const content = `${payload.code || ""} ${payload.content || ""} ${payload.description || ""}`.toUpperCase();
  const code = content.match(/LG[A-Z0-9]{8}/)?.[0];

  const inserted = await env.DB.prepare("INSERT OR IGNORE INTO payment_events (provider, transaction_id, amount, payload_json, outcome) VALUES ('sepay', ?, ?, ?, 'received')")
    .bind(transactionId, Number(payload.transferAmount), JSON.stringify(payload).slice(0, 20000)).run();
  if (!inserted.meta?.changes) return json({ success: true });

  const finish = async (outcome) => {
    await env.DB.prepare("UPDATE payment_events SET order_code = ?, outcome = ? WHERE provider = 'sepay' AND transaction_id = ?")
      .bind(code || null, outcome, transactionId).run();
    return json({ success: true });
  };
  if (payload.transferType !== "in") return finish("outgoing");
  if (env.BANK_ACCOUNT && String(payload.accountNumber || "").trim() !== env.BANK_ACCOUNT) return finish("wrong_account");
  if (!code) return finish("no_order_code");

  await expirePendingOrders(env);
  const order = await env.DB.prepare("SELECT * FROM orders WHERE code = ?").bind(code).first();
  if (!order) return finish("order_not_found");
  if (order.expired_at || (order.status === "pending" && order.expires_at && Date.parse(order.expires_at) <= Date.now())) return finish("expired_order");
  if (Number(payload.transferAmount) < Number(order.amount)) return finish("underpaid");
  const updated = await env.DB.prepare("UPDATE orders SET status = 'paid', payment_ref = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE code = ? AND status = 'pending' AND (expires_at IS NULL OR expires_at > ?)")
    .bind(String(payload.referenceCode || transactionId), code, new Date().toISOString()).run();
  if (!updated.meta?.changes && order.status === "pending" && order.expires_at && Date.parse(order.expires_at) <= Date.now()) return finish("expired_order");
  if (updated.meta?.changes === 1) ctx.waitUntil(activateOrder(env, { ...order, status: "paid" }));
  return finish(updated.meta?.changes === 1 ? "matched" : "order_not_pending");
}

export async function repairQueuedGoldExpiries(env) {
  if (!env.DB) return;
  const { results } = await env.DB.prepare("SELECT order_code FROM gold_expiry_repairs WHERE status = 'pending' ORDER BY created_at LIMIT 5").all();
  if (!results?.length) return;
  env = await resolveNoDnsEnv(env);
  for (const job of results) {
    try {
      const order = await env.DB.prepare("SELECT * FROM orders WHERE code = ?").bind(job.order_code).first();
      const expected = order && purchasedGoldExpiry(order);
      if (!expected || order.status !== "completed" || order.platform !== "iOS" || order.gold_revoked_at) throw new Error("Đơn không đủ điều kiện sửa thời hạn.");
      const latest = await env.DB.prepare("SELECT code FROM orders WHERE lower(username) = lower(?) AND platform = 'iOS' AND status = 'completed' ORDER BY completed_at DESC, id DESC LIMIT 1").bind(order.username).first();
      if (latest?.code !== order.code) throw new Error("Tài khoản đã có đơn kích hoạt mới hơn.");
      const { result: lookup } = await providerRequest(env, `/api/v1/lookup?user=${encodeURIComponent(order.username)}`, { apiKey: true });
      const uid = unwrap(lookup).uid;
      if (!uid) throw new Error("Không xác định được UID tài khoản.");
      const { result: status } = await providerRequest(env, `/api/v1/status?user=${encodeURIComponent(uid)}`, { apiKey: true });
      const current = unwrap(status);
      if (current.owned_by_you !== true || current.has_gold !== true) throw new Error("Gold không thuộc API hiện tại hoặc đã bị hủy.");
      if (!sameGoldExpiry(current.expiresAt, expected)) {
        if (current.expiresAt !== null) throw new Error("Thời hạn đã được thay đổi; cần kiểm tra trước khi sửa.");
        const { result: history } = await providerRequest(env, "/api/v1/orders?limit=500", { apiKey: true });
        const data = unwrap(history);
        const rows = Array.isArray(data) ? data : data.orders || [];
        if (!rows.some(row => row.uid === uid && row.note === order.code)) throw new Error("Không khớp mã đơn với lịch sử NoDNS.");
        const { result: updated } = await providerRequest(env, "/api/v1/update", { method: "POST", apiKey: true, body: { user: uid, expiresAt: expected } });
        if (updated.status !== "success" || !sameGoldExpiry(unwrap(updated).expiresAt, expected)) throw new Error("NoDNS chưa xác nhận đúng ngày hết hạn.");
      }
      await env.DB.prepare("UPDATE gold_expiry_repairs SET status = 'repaired', expires_at = ?, error = NULL, updated_at = CURRENT_TIMESTAMP WHERE order_code = ?").bind(expected, order.code).run();
    } catch (error) {
      console.error("Gold expiry repair failed", job.order_code, error.status || "validation");
      await env.DB.prepare("UPDATE gold_expiry_repairs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE order_code = ?").bind(error.status ? `NoDNS trả về lỗi HTTP ${error.status}.` : error.message, job.order_code).run();
    }
  }
}

async function activateOrder(env, order) {
  if (env.NODNS_API_KEY) {
    const body = grantPayload(order);
    if (!body) return;
    try {
      const { result } = await providerRequest(env, "/api/v1/grant", { method: "POST", body, apiKey: true });
      if (result.status !== "success" || unwrap(result).active !== true) return;
      if (body.expiresAt && !sameGoldExpiry(unwrap(result).expiresAt, body.expiresAt)) {
        const { result: corrected } = await providerRequest(env, "/api/v1/update", { method: "POST", apiKey: true, body: { user: order.username, expiresAt: body.expiresAt } });
        if (corrected.status !== "success" || !sameGoldExpiry(unwrap(corrected).expiresAt, body.expiresAt)) throw httpError(502, "NoDNS chưa xác nhận đúng thời hạn Gold.");
      }
      await env.DB.prepare("UPDATE orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE code = ? AND status = 'paid'").bind(order.code).run();
    } catch (error) { console.error("NoDNS activation failed", order.code, error.status); }
    return;
  }
  const settings = await readSettings(env, ["upstream_api_url"]);
  const apiUrl = settings.upstream_api_url || env.UPSTREAM_API_URL;
  if (!apiUrl || !env.UPSTREAM_API_KEY) return;
  try {
    const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.UPSTREAM_API_KEY}` }, body: JSON.stringify({ order_code: order.code, username: order.username, plan_id: order.plan_id, platform: order.platform }) });
    if (!response.ok) throw new Error(`Upstream ${response.status}`);
    const result = await response.json();
    if (!activationConfirmed(result)) return;
    await env.DB.prepare("UPDATE orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE code = ? AND status = 'paid'").bind(order.code).run();
  } catch (error) { console.error("Activation failed", order.code, error); }
}

async function adminLogin(request, env) {
  rateLimit(request, "admin-login", 6, 15 * 60_000);
  if (!env.SESSION_SECRET) throw httpError(503, "Chưa cấu hình SESSION_SECRET trên Worker đang phục vụ website.");
  if (env.NODNS_ADMIN_AUTH === "true") {
    const body = await readJson(request);
    if (!body.username || !body.password) throw httpError(400, "Nhập tên đăng nhập và mật khẩu.");
    const cookie = await remoteLogin(request, env, "admin", { username: body.username, password: body.password });
    const token = await signSession({ role: "admin", sub: "nodns-admin", exp: Date.now() + 8 * 60 * 60_000 }, env.SESSION_SECRET);
    return withCookie(withCookie(json({ authenticated: true }), cookie), `lg_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
  }
  const credential = await adminCredential(env);
  if (!credential && !env.ADMIN_PASSWORD_SHA256) throw httpError(503, "Tài khoản quản trị chưa được cấu hình.");
  const { username, password } = await readJson(request);
  const validPassword = await verifyAdminPassword(env, credential, password);
  const accountName = credential?.username || env.ADMIN_USERNAME || "admin";
  if (username !== accountName || !validPassword) throw httpError(401, "Tên đăng nhập hoặc mật khẩu không đúng.");
  const token = await signSession({ role: "admin", sub: accountName, ...(credential ? { revision: credential.revision } : {}), exp: Date.now() + 8 * 60 * 60_000 }, env.SESSION_SECRET);
  return withCookie(json({ authenticated: true }), `lg_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
}

async function adminAccount(request, env) {
  const session = await requireSession(request, env, "admin");
  const credential = await adminCredential(env);
  if (request.method === "GET") return json({ username: credential?.username || env.ADMIN_USERNAME || "admin", editable: env.NODNS_ADMIN_AUTH !== "true" && session.sub !== "nodns-admin" });
  if (request.method !== "POST") throw httpError(405, "Phương thức không được hỗ trợ.");
  if (env.NODNS_ADMIN_AUTH === "true" || session.sub === "nodns-admin") throw httpError(400, "Vui lòng đổi tài khoản NoDNS trực tiếp trên hệ thống NoDNS.");
  requireDb(env);
  if (env.ADMIN_CREDENTIALS_ENABLED !== "true") throw httpError(503, "Chưa bật quản lý tài khoản quản trị.");
  rateLimit(request, "admin-account", 5, 60_000);
  const body = await readJson(request);
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const newPassword = body.new_password ?? "";
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) throw httpError(400, "Tên đăng nhập cần từ 3 đến 64 ký tự, gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.");
  if (typeof newPassword !== "string" || (newPassword && (newPassword.length < 10 || newPassword.length > 128))) throw httpError(400, "Mật khẩu mới cần từ 10 đến 128 ký tự.");
  if (newPassword !== (body.confirm_password ?? "")) throw httpError(400, "Mật khẩu xác nhận không khớp.");
  if (!(await verifyAdminPassword(env, credential, body.current_password))) throw httpError(401, "Mật khẩu hiện tại không đúng.");
  const salt = crypto.randomUUID(), revision = crypto.randomUUID();
  const hash = await passwordHash(newPassword || body.current_password, salt);
  const result = await env.DB.prepare("INSERT INTO admin_credentials (id, username, password_hash, password_salt, revision) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username = excluded.username, password_hash = excluded.password_hash, password_salt = excluded.password_salt, revision = excluded.revision, updated_at = CURRENT_TIMESTAMP WHERE admin_credentials.revision = ?")
    .bind(username, hash, salt, revision, credential?.revision || "").run();
  if (result.meta?.changes !== 1) throw httpError(409, "Tài khoản vừa được thay đổi ở phiên khác. Vui lòng đăng nhập lại.");
  const token = await signSession({ role: "admin", sub: username, revision, exp: Date.now() + 8 * 60 * 60_000 }, env.SESSION_SECRET);
  return withCookie(json({ username, message: "Đã cập nhật tài khoản. Các phiên đăng nhập khác đã được đăng xuất." }), `lg_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
}

async function adminOverview(request, env) {
  await requireSession(request, env, "admin");
  await expirePendingOrders(env);
  const storedKey = env.NODNS_CREDENTIALS_ENABLED === "true" && env.DB ? await env.DB.prepare("SELECT provider FROM provider_credentials WHERE provider = 'nodns'").first() : null;
  const integration = { database: Boolean(env.DB), remote_ctv: env.NODNS_CTV_PORTAL === "true", nodns_key: Boolean(storedKey || env.NODNS_API_KEY), remote_admin: env.NODNS_ADMIN_AUTH === "true" };
  if (!env.DB) return json({ orders: 0, paid_orders: 0, ctv_users: 0, posts: 0, integration });
  const [orders, paid, ctv, posts] = await Promise.all([
    count(env, "SELECT COUNT(*) count FROM orders WHERE ctv_id IS NULL"),
    count(env, "SELECT COUNT(*) count FROM orders WHERE status IN ('paid','completed')"),
    count(env, "SELECT COUNT(*) count FROM ctv_users WHERE active = 1"),
    count(env, "SELECT COUNT(*) count FROM posts WHERE status = 'published'"),
  ]);
  return json({ orders, paid_orders: paid, ctv_users: ctv, posts, integration });
}

async function adminOrders(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  await expirePendingOrders(env);
  const { results } = await env.DB.prepare("SELECT code, username, contact, plan_name, amount, status, expires_at, expired_at, gold_revoked_at, created_at FROM orders ORDER BY created_at DESC LIMIT 100").all();
  return json({ orders: results || [] });
}

async function adminProviderKey(request, env) {
  const admin = await requireSession(request, env, "admin"); requireDb(env);
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT updated_at, updated_by FROM provider_credentials WHERE provider = 'nodns'").first();
    return json({ configured: Boolean(row || env.NODNS_API_KEY), source: row ? "admin" : "cloudflare", updated_at: row?.updated_at || null });
  }
  if (request.method !== "POST") throw httpError(405, "Phương thức không được hỗ trợ.");
  const body = await readJson(request);
  const key = typeof body.api_key === "string" ? body.api_key.trim() : "";
  if (!key || key.length > 4096 || /\s|[\u0000-\u001f\u007f]/.test(key)) throw httpError(400, "Nhập khóa API NoDNS hợp lệ, không kèm khoảng trắng hoặc tiền tố.");
  // Verify the candidate directly; never replace the current key on failure.
  const { result } = await providerRequest({ ...env, NODNS_API_KEY: key }, "/api/v1/me", { apiKey: true });
  const account = unwrap(result);
  if (result.status !== "success" || !account.username || account.active === false) throw httpError(400, "NoDNS chưa xác nhận khóa của tài khoản đang hoạt động.");
  const encrypted = await encryptNoDnsKey(env, key);
  await env.DB.prepare("INSERT INTO provider_credentials (provider, encrypted_key, updated_by) VALUES ('nodns', ?, ?) ON CONFLICT(provider) DO UPDATE SET encrypted_key = excluded.encrypted_key, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP")
    .bind(encrypted, String(admin.sub || "admin")).run();
  return json({ message: "Đã kiểm tra và lưu khóa API NoDNS mới.", account: { username: cleanText(account.username, 100), remaining: Number(account.remaining || 0) } });
}

async function adminCancelGold(request, env) {
  const admin = await requireSession(request, env, "admin"); requireDb(env);
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  if (!username) throw httpError(400, "Tên người dùng Locket không hợp lệ.");
  if (body.confirmed !== true) throw httpError(400, "Vui lòng xác nhận hủy Gold của tài khoản này.");
  if (!env.NODNS_API_KEY) throw httpError(503, "Chưa cấu hình khóa API NoDNS để hủy Gold.");
  const { result } = await providerRequest(env, "/api/v1/cancel", { method: "POST", apiKey: true, body: { user: username } });
  if (result.status !== "success") throw Object.assign(httpError(502, "NoDNS chưa xác nhận hủy Gold."), { publicMessage: "NoDNS chưa xác nhận hủy Gold. Kiểm tra trên NoDNS trước khi thử lại." });
  const data = unwrap(result);
  const refunded = data.refunded === true;
  const remaining = Number.isFinite(data.remaining) ? data.remaining : null;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO gold_cancellations (username, uid, admin_username, refunded, remaining) VALUES (?, ?, ?, ?, ?)")
      .bind(username, cleanText(data.uid, 128) || null, String(admin.sub || "admin"), refunded ? 1 : 0, remaining),
    env.DB.prepare("UPDATE orders SET gold_revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE username = ? COLLATE NOCASE AND platform = 'iOS' AND status IN ('paid', 'completed') AND gold_revoked_at IS NULL").bind(username),
  ]);
  return json({ username, cancelled: true, refunded, remaining, message: refunded ? "Đã hủy Gold và được NoDNS hoàn lượt." : "Đã hủy Gold. NoDNS không hoàn lượt cho lần hủy này." });
}

async function adminSepay(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const [{ results }, summary] = await Promise.all([
    env.DB.prepare("SELECT p.transaction_id, p.amount, p.payload_json, p.created_at, p.order_code, p.outcome, o.status AS order_status, o.amount AS order_amount FROM payment_events p LEFT JOIN orders o ON o.code = p.order_code WHERE p.provider = 'sepay' ORDER BY p.id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN outcome = 'matched' THEN amount ELSE 0 END), 0) AS matched_amount, MAX(created_at) AS last_received FROM payment_events WHERE provider = 'sepay'").first(),
  ]);
  return json({
    config: { webhook_url: `${new URL(env.SITE_URL || request.url).origin}/api/sepay/webhook`, key_configured: Boolean(env.SEPAY_WEBHOOK_API_KEY), bank_name: env.BANK_NAME || "", bank_account: env.BANK_ACCOUNT || "" },
    summary: summary || { total: 0, matched_amount: 0, last_received: null },
    transactions: (results || []).map((row) => {
      let payload = {};
      try { payload = JSON.parse(row.payload_json); } catch { /* Old malformed payloads remain visible. */ }
      return { transaction_id: row.transaction_id, amount: row.amount, received_at: row.created_at, order_code: row.order_code || null, outcome: row.outcome, order_status: row.order_status || null, order_amount: row.order_amount ?? null, bank: cleanText(payload.gateway, 80), account: cleanText(payload.accountNumber, 30), direction: payload.transferType === "in" ? "in" : "out", content: cleanText(payload.content || payload.description || payload.code, 500), reference: cleanText(payload.referenceCode, 100) };
    }),
  });
}

async function adminCreatePost(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const body = await readJson(request);
  const title = cleanText(body.title, 140), excerpt = cleanText(body.excerpt, 320);
  const content = typeof body.content === "string" ? body.content.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "") : "";
  if (content.length > 20000) throw httpError(400, "Nội dung tối đa 20.000 ký tự.");
  if (!title || !excerpt || !content) throw httpError(400, "Vui lòng nhập đủ nội dung bài viết.");
  let slug = slugify(title) || `bai-viet-${Date.now()}`;
  const exists = await env.DB.prepare("SELECT 1 FROM posts WHERE slug = ?").bind(slug).first();
  if (exists) slug += `-${randomCode(4).toLowerCase()}`;
  await env.DB.prepare("INSERT INTO posts (slug, title, excerpt, content, status, published_at) VALUES (?, ?, ?, ?, 'published', CURRENT_TIMESTAMP)").bind(slug, title, excerpt, content).run();
  return json({ message: "Đã xuất bản bài viết.", slug }, 201);
}

async function uploadPostImage(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const limit = 1024 * 1024;
  if (Number(request.headers.get("Content-Length") || 0) > limit) throw httpError(413, "Ảnh tối đa 1 MB sau tối ưu.");
  if (!request.body) throw httpError(400, "Chưa chọn ảnh.");
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw httpError(413, "Ảnh tối đa 1 MB sau tối ưu."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  const mime = bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP" ? "image/webp"
    : bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v) ? "image/png"
    : bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg" : "";
  if (!mime) throw httpError(400, "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.");
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO post_images (id, mime_type, image_data) VALUES (?, ?, ?)").bind(id, mime, bytes.buffer).run();
  return json({ url: `/api/images/${id}` }, 201);
}

async function getPostImage(env, id) {
  requireDb(env);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw httpError(404, "Không tìm thấy ảnh.");
  const row = await env.DB.prepare("SELECT mime_type, image_data FROM post_images WHERE id = ?").bind(id).first();
  if (!row) throw httpError(404, "Không tìm thấy ảnh.");
  return new Response(new Uint8Array(row.image_data), { headers: { "Content-Type": row.mime_type, "Cache-Control": "public, max-age=31536000, immutable" } });
}

async function adminCreatePromo(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const body = await readJson(request);
  const code = cleanText(body.code, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const percent = Number(body.percent);
  if (!code || !Number.isInteger(percent) || percent < 1 || percent > 100) throw httpError(400, "Mã hoặc phần trăm không hợp lệ.");
  const expiry = body.expires_at ? new Date(body.expires_at) : null;
  if (expiry && !Number.isFinite(expiry.getTime())) throw httpError(400, "Ngày hết hạn không hợp lệ.");
  const expiresAt = expiry ? expiry.toISOString() : null;
  await env.DB.prepare("INSERT INTO promo_codes (code, percent, expires_at, active) VALUES (?, ?, ?, 1) ON CONFLICT(code) DO UPDATE SET percent = excluded.percent, expires_at = excluded.expires_at, active = 1").bind(code, percent, expiresAt).run();
  return json({ message: "Đã lưu mã giảm giá." });
}

export function promoStatus(promo, now = Date.now()) {
  if (!Number(promo.active)) return "cancelled";
  if (promo.expires_at && (!Number.isFinite(Date.parse(promo.expires_at)) || Date.parse(promo.expires_at) <= now)) return "expired";
  return "active";
}

async function adminListPromos(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const { results } = await env.DB.prepare("SELECT p.code, p.percent, p.active, p.expires_at, p.created_at, COALESCE(u.paid_orders, 0) AS paid_orders, COALESCE(u.discount_total, 0) AS discount_total FROM promo_codes p LEFT JOIN (SELECT promo_code, COUNT(*) AS paid_orders, SUM(discount_amount) AS discount_total FROM orders WHERE status IN ('paid', 'completed') GROUP BY promo_code) u ON u.promo_code = p.code ORDER BY p.created_at DESC, p.code ASC").all();
  const promos = (results || []).map(row => ({ ...row, status: promoStatus(row) }));
  return json({ promos, summary: { total: promos.length, active: promos.filter(p => p.status === "active").length, expired: promos.filter(p => p.status === "expired").length, cancelled: promos.filter(p => p.status === "cancelled").length } });
}

async function adminCancelPromo(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const body = await readJson(request);
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{1,32}$/.test(code)) throw httpError(400, "Mã giảm giá không hợp lệ.");
  const promo = await env.DB.prepare("SELECT code, active FROM promo_codes WHERE code = ?").bind(code).first();
  if (!promo) throw httpError(404, "Không tìm thấy mã giảm giá.");
  await env.DB.prepare("UPDATE promo_codes SET active = 0 WHERE code = ? AND active = 1").bind(code).run();
  return json({ message: `Đã hủy mã ${code}. Mã không thể dùng cho đơn mới; các đơn đã tạo giữ nguyên số tiền.` });
}

async function adminSavePlan(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const body = await readJson(request);
  const id = cleanText(body.id, 50);
  const price = Number(body.price);
  const oldPrice = body.old_price === "" || body.old_price == null ? null : Number(body.old_price);
  if (!DEFAULT_PLANS.some((plan) => plan.id === id) || !Number.isSafeInteger(price) || price < 0 || price > 100_000_000 || (oldPrice !== null && (!Number.isSafeInteger(oldPrice) || oldPrice <= price || oldPrice > 100_000_000))) throw httpError(400, "Gói hoặc mức giá không hợp lệ. Giá cũ phải cao hơn giá hiện tại.");
  await env.DB.prepare("UPDATE plans SET price = ?, old_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(price, oldPrice, id).run();
  return json({ message: "Đã cập nhật bảng giá." });
}

async function getWelcome(env) {
  const settings = await readSettings(env, ["welcome_notice"]);
  if (!settings.welcome_notice) return DEFAULT_WELCOME;
  try {
    const saved = JSON.parse(settings.welcome_notice);
    return { ...validateWelcome(saved), revision: String(saved.revision || "initial").slice(0, 64) };
  } catch { return DEFAULT_WELCOME; }
}

async function adminWelcome(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  if (request.method === "GET") return json(await getWelcome(env));
  if (request.method !== "POST") throw httpError(405, "Phương thức không được hỗ trợ.");
  const notice = { ...validateWelcome(await readJson(request)), revision: crypto.randomUUID() };
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('welcome_notice', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(JSON.stringify(notice)).run();
  return json({ message: "Đã lưu thông báo khi vào trang.", notice });
}

async function adminSaveSettings(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const body = await readJson(request);
  const allowed = ["dns_url", "apk_url", "upstream_api_url", "support_zalo", "support_facebook", "support_telegram"];
  for (const key of allowed) {
    const value = cleanUrl(body[key]);
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(key, value).run();
  }
  return json({ message: "Đã lưu cấu hình công khai. Khóa bí mật không bị thay đổi." });
}

async function adminCreateCtv(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const body = await readJson(request);
  const username = cleanText(body.username, 50).toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  const password = String(body.password || "");
  const initialBalance = Number(body.initial_balance || 0);
  if (username.length < 3 || password.length < 10) throw httpError(400, "Tên đăng nhập hoặc mật khẩu chưa đạt yêu cầu.");
  if (!Number.isSafeInteger(initialBalance) || initialBalance < 0 || initialBalance > 1_000_000_000) throw httpError(400, "Số dư ban đầu không hợp lệ.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await pbkdf2(password, salt);
  await env.DB.prepare("INSERT INTO ctv_users (username, password_hash, password_salt, balance, active) VALUES (?, ?, ?, ?, 1)").bind(username, passwordHash, toBase64Url(salt), initialBalance).run();
  return json({ message: "Đã tạo tài khoản CTV." }, 201);
}

async function adminUpdateCtvBalance(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const body = await readJson(request);
  const username = cleanText(body.username, 50).toLowerCase();
  const delta = Number(body.delta);
  if (!username || !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000_000) throw httpError(400, "Tên CTV hoặc số tiền thay đổi không hợp lệ.");
  const result = await env.DB.prepare("UPDATE ctv_users SET balance = balance + ? WHERE username = ? COLLATE NOCASE AND active = 1 AND balance + ? >= 0").bind(delta, username, delta).run();
  if (!result.meta?.changes) throw httpError(404, "Không tìm thấy CTV hoặc số dư sau điều chỉnh bị âm.");
  return json({ message: "Đã cập nhật số dư CTV." });
}

async function ctvLogin(request, env) {
  rateLimit(request, "ctv-login", 8, 15 * 60_000); requireDb(env);
  if (!env.SESSION_SECRET) throw httpError(503, "Phiên đăng nhập chưa được cấu hình.");
  const body = await readJson(request);
  const username = cleanText(body.username, 50).toLowerCase();
  const user = await env.DB.prepare("SELECT id, username, password_hash, password_salt, balance FROM ctv_users WHERE username = ? AND active = 1").bind(username).first();
  if (!user || !(await constantTimeEqual(await pbkdf2(String(body.password || ""), fromBase64Url(user.password_salt)), user.password_hash))) throw httpError(401, "Thông tin đăng nhập không đúng.");
  const token = await signSession({ role: "ctv", sub: String(user.id), exp: Date.now() + 12 * 60 * 60_000 }, env.SESSION_SECRET);
  const response = json({ user: await ctvPublicUser(env, user) });
  return withCookie(response, `lg_ctv=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
}

async function ctvMe(request, env) {
  requireDb(env);
  const session = await requireSession(request, env, "ctv");
  const user = await env.DB.prepare("SELECT id, username, balance FROM ctv_users WHERE id = ? AND active = 1").bind(Number(session.sub)).first();
  if (!user) throw httpError(401, "Tài khoản không còn hoạt động.");
  return json({ user: await ctvPublicUser(env, user) });
}

async function ctvOrders(request, env) {
  requireDb(env);
  const session = await requireSession(request, env, "ctv");
  const { results } = await env.DB.prepare("SELECT code, username, plan_name, amount, status, created_at FROM orders WHERE ctv_id = ? ORDER BY created_at DESC LIMIT 50").bind(Number(session.sub)).all();
  return json({ orders: results || [] });
}

async function ctvCreateOrder(request, env, ctx) {
  requireDb(env);
  const session = await requireSession(request, env, "ctv");
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const plan = await findPlan(env, body.plan_id);
  if (!username || !plan) throw httpError(400, "Tên người dùng hoặc gói chưa hợp lệ.");
  const user = await env.DB.prepare("SELECT id, username, balance FROM ctv_users WHERE id = ? AND active = 1").bind(Number(session.sub)).first();
  if (!user) throw httpError(401, "Tài khoản không còn hoạt động.");
  if (Number(user.balance) < Number(plan.price)) throw httpError(400, "Số dư CTV không đủ để tạo đơn.");
  const code = `LG${randomCode(8)}`;
  const insert = env.DB.prepare("INSERT INTO orders (code, username, contact, plan_id, plan_name, platform, subtotal, discount_amount, amount, ctv_id, status, paid_at) SELECT ?, ?, ?, ?, ?, ?, ?, 0, ?, id, 'paid', CURRENT_TIMESTAMP FROM ctv_users WHERE id = ? AND active = 1 AND balance >= ?")
    .bind(code, username, `CTV:${user.username}`, plan.id, plan.name, plan.platform, Number(plan.price), Number(plan.price), user.id, Number(plan.price));
  const debit = env.DB.prepare("UPDATE ctv_users SET balance = balance - ? WHERE id = ? AND EXISTS (SELECT 1 FROM orders WHERE code = ? AND ctv_id = ?)").bind(Number(plan.price), user.id, code, user.id);
  const results = await env.DB.batch([insert, debit]);
  if (!results[0].meta?.changes) throw httpError(409, "Số dư vừa thay đổi, vui lòng thử lại.");
  ctx.waitUntil(activateOrder(env, { code, username, plan_id: plan.id, platform: plan.platform }));
  return json({ message: "Đã tạo đơn CTV.", code }, 201);
}

async function ctvPublicUser(env, user) {
  const totals = await env.DB.prepare("SELECT COUNT(*) order_count, SUM(CASE WHEN status IN ('paid','completed') THEN 1 ELSE 0 END) completed_count FROM orders WHERE ctv_id = ?").bind(user.id).first();
  return { username: user.username, balance: Number(user.balance || 0), order_count: Number(totals?.order_count || 0), completed_count: Number(totals?.completed_count || 0) };
}

async function findPlan(env, id) {
  const safeId = cleanText(id, 50);
  if (env.DB) {
    const plan = await env.DB.prepare("SELECT id, name, platform, price, period, featured FROM plans WHERE id = ? AND enabled = 1").bind(safeId).first();
    if (plan) return normalizePlan(plan);
  }
  return DEFAULT_PLANS.find((plan) => plan.id === safeId) || null;
}

async function findPromo(env, code) {
  if (!env.DB) return null;
  const normalized = cleanText(code, 32).toUpperCase();
  if (!normalized) return null;
  return env.DB.prepare("SELECT code, percent FROM promo_codes WHERE code = ? AND active = 1 AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))").bind(normalized).first();
}

async function readSettings(env, keys) {
  if (!env.DB || !keys.length) return {};
  const placeholders = keys.map(() => "?").join(",");
  const { results } = await env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).bind(...keys).all();
  return Object.fromEntries((results || []).map((row) => [row.key, row.value]));
}

async function requireSession(request, env, role) {
  if (!env.SESSION_SECRET) throw httpError(503, "Phiên đăng nhập chưa được cấu hình.");
  const cookieName = role === "admin" ? "lg_admin" : "lg_ctv";
  const token = parseCookies(request.headers.get("Cookie") || "")[cookieName];
  if (!token) throw httpError(401, "Bạn chưa đăng nhập.");
  const [payloadPart, signature] = token.split(".");
  if (!payloadPart || !signature) throw httpError(401, "Phiên không hợp lệ.");
  const expected = await hmac(payloadPart, env.SESSION_SECRET);
  if (!(await constantTimeEqual(signature, expected))) throw httpError(401, "Phiên không hợp lệ.");
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart))); } catch { throw httpError(401, "Phiên không hợp lệ."); }
  if (payload.role !== role || Number(payload.exp) < Date.now()) throw httpError(401, "Phiên đã hết hạn.");
  if (role === "admin" && payload.sub !== "nodns-admin") {
    const credential = await adminCredential(env);
    if (credential && (payload.revision !== credential.revision || payload.sub !== credential.username)) throw httpError(401, "Tài khoản đã thay đổi. Vui lòng đăng nhập lại.");
  }
  if (role === "admin" && payload.sub === "nodns-admin") {
    const cookie = await remoteCookie(request, env, "admin");
    const { result } = await providerRequest(env, "/api/auth/me", { cookie });
    if (result.authenticated === false || unwrap(result).authenticated === false) throw httpError(401, "Phiên quản trị đã hết hạn.");
  }
  return payload;
}

async function remoteCtvRoute(request, env, pathname) {
  const method = request.method;
  if (pathname === "/api/ctv/login" && method === "POST") {
    rateLimit(request, "remote-ctv-login", 8, 15 * 60_000);
    const body = await readJson(request);
    if (!body.username || !body.password) throw httpError(400, "Nhập tên đăng nhập và mật khẩu.");
    const cookie = await remoteLogin(request, env, "ctv", { username: body.username, password: body.password });
    // Fetch account details on the next request using the encrypted cookie.
    return withCookie(json({ authenticated: true }), cookie);
  }
  const cookie = await remoteCookie(request, env, "ctv");
  if (pathname === "/api/ctv/logout" && method === "POST") {
    try { await providerRequest(env, "/api/ctv/auth/logout", { method: "POST", cookie }); }
    catch { /* Clear the local session even when upstream is unavailable. */ }
    return withCookie(json({ success: true }), clearRemoteCookie("ctv"));
  }
  if (pathname === "/api/ctv/me" && method === "GET") {
    const { result } = await providerRequest(env, "/api/ctv/me", { cookie });
    return json({ user: publicCtv(result), remote: true });
  }
  if (pathname === "/api/ctv/orders" && method === "GET") {
    const { result } = await providerRequest(env, "/api/ctv/orders", { cookie });
    return json({ orders: portalOrders(result) });
  }
  if (pathname === "/api/ctv/orders" && method === "POST") {
    const body = await readJson(request);
    const username = normalizeUsername(body.username);
    const packages = { "ios-month": "1month", "ios-year": "1year", "ios-lifetime": "lifetime" };
    const packageId = packages[body.plan_id];
    if (!username || !packageId) throw httpError(400, "Chỉ hỗ trợ gói iOS qua API NoDNS.");
    const { result: lookup } = await providerRequest(env, "/api/ctv/lookup", { method: "POST", body: { username }, cookie });
    const user = unwrap(lookup);
    if (!user.uid) throw httpError(404, "Không tìm thấy UID của tài khoản.");
    const { result } = await providerRequest(env, "/api/ctv/upgrade", { method: "POST", body: { userUpgraded: username, userId: user.uid, packageId, testflight: false }, cookie });
    const data = unwrap(result);
    return json({ message: result.message || "Đã gửi yêu cầu cấp Gold.", code: data.orderId || data.id || user.uid }, 201);
  }
  throw httpError(404, "Không tìm thấy API CTV.");
}

async function signSession(payload, secret) {
  const data = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${data}.${await hmac(data, secret)}`;
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function pbkdf2(password, salt) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 }, material, 256);
  return toBase64Url(new Uint8Array(bits));
}

async function sha256Hex(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function constantTimeEqual(a, b) {
  const left = encoder.encode(String(a)), right = encoder.encode(String(b));
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) diff |= (left[i] || 0) ^ (right[i] || 0);
  return diff === 0;
}

function rateLimit(request, bucket, max, windowMs) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `${bucket}:${ip}`, now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.reset < now) { loginAttempts.set(key, { count: 1, reset: now + windowMs }); return; }
  entry.count += 1;
  if (entry.count > max) throw httpError(429, "Thử quá nhiều lần. Vui lòng quay lại sau.");
}

function assertSameOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  const expected = env.SITE_URL || new URL(request.url).origin;
  if (origin !== expected && origin !== new URL(request.url).origin) throw httpError(403, "Nguồn yêu cầu không hợp lệ.");
}

async function readJson(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 100_000) throw httpError(413, "Dữ liệu quá lớn.");
  try { return await request.json(); } catch { throw httpError(400, "Dữ liệu JSON không hợp lệ."); }
}

function cleanText(value, max) { return String(value || "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max); }
function cleanUrl(value) { const text = cleanText(value, 500); if (!text) return ""; try { const url = new URL(text); return url.protocol === "https:" ? url.href : ""; } catch { return ""; } }
function slugify(value) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100); }
function maskUsername(value) { const text = String(value || ""); if (text.length <= 3) return `${text[0] || "u"}***`; return `@${text.slice(0, 2)}${"*".repeat(Math.min(6, text.length - 2))}`; }
function randomCode(length) { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes = crypto.getRandomValues(new Uint8Array(length)); return [...bytes].map((byte) => chars[byte % chars.length]).join(""); }
function parseCookies(value) { return Object.fromEntries(value.split(";").map((part) => part.trim().split(/=(.*)/s)).filter(([key]) => key)); }
function toBase64Url(bytes) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromBase64Url(value) { const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="); return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)); }
function httpError(status, message) { const error = new Error(message); error.status = status; if (status === 503) error.publicMessage = message; return error; }
function requireDb(env) { if (!env.DB) throw httpError(503, "Cơ sở dữ liệu D1 chưa được kết nối."); }
async function count(env, sql) { const row = await env.DB.prepare(sql).first(); return Number(row?.count || 0); }
function logout(name) { return withCookie(withCookie(json({ success: true }), `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`), clearRemoteCookie(name === "lg_admin" ? "admin" : "ctv")); }
function withCookie(response, cookie) { const headers = new Headers(response.headers); headers.append("Set-Cookie", cookie); return new Response(response.body, { status: response.status, headers }); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
function secure(response) { const headers = new Headers(response.headers); for (const [key, value] of Object.entries(securityHeaders())) headers.set(key, value); return new Response(response.body, { status: response.status, statusText: response.statusText, headers }); }
function securityHeaders() { return { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Cross-Origin-Resource-Policy": "same-origin" }; }
