import { normalizeUsername } from "../src/username.js";

const DEFAULT_PLANS = [
  { id: "ios-month", name: "Gói 1 tháng", platform: "iOS", price: 29000, period: "1 tháng", featured: 0 },
  { id: "ios-year", name: "Gói 1 năm", platform: "iOS", price: 60000, period: "1 năm", featured: 0 },
  { id: "ios-lifetime", name: "Gói vĩnh viễn", platform: "iOS", price: 149000, period: "trọn đời", featured: 1 },
  { id: "android-lifetime", name: "Gói vĩnh viễn", platform: "Android", price: 180000, period: "trọn đời", featured: 0 },
];

const loginAttempts = new Map();
const encoder = new TextEncoder();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: securityHeaders() });
      if (request.method !== "GET" && url.pathname !== "/api/sepay/webhook") assertSameOrigin(request, env);
      const response = await route(request, env, ctx, url);
      return secure(response);
    } catch (error) {
      const status = Number(error.status) || 500;
      if (status >= 500) console.error("API error", error);
      return secure(json({ error: status >= 500 ? "Hệ thống đang bận hoặc chưa được cấu hình." : error.message }, status));
    }
  },
};

async function route(request, env, ctx, url) {
  const { pathname } = url;
  if (pathname === "/api/plans" && request.method === "GET") return getPlans(env);
  if (pathname === "/api/posts" && request.method === "GET") return getPosts(env);
  if (pathname.startsWith("/api/posts/") && request.method === "GET") return getPost(env, decodeURIComponent(pathname.slice(11)));
  if (pathname === "/api/public-config" && request.method === "GET") return getPublicConfig(env);
  if (pathname === "/api/activity" && request.method === "GET") return getActivity(env);
  if (pathname === "/api/quote" && request.method === "POST") return quoteOrder(request, env);
  if (pathname === "/api/orders" && request.method === "POST") return createOrder(request, env);
  if (pathname.startsWith("/api/orders/") && request.method === "GET") return getOrder(env, decodeURIComponent(pathname.slice(12)));
  if (pathname === "/api/sepay/webhook" && request.method === "POST") return sepayWebhook(request, env, ctx);

  if (pathname === "/api/admin/login" && request.method === "POST") return adminLogin(request, env);
  if (pathname === "/api/admin/logout" && request.method === "POST") return logout("lg_admin");
  if (pathname === "/api/admin/session" && request.method === "GET") { await requireSession(request, env, "admin"); return json({ authenticated: true }); }
  if (pathname === "/api/admin/overview" && request.method === "GET") return adminOverview(request, env);
  if (pathname === "/api/admin/orders" && request.method === "GET") return adminOrders(request, env);
  if (pathname === "/api/admin/posts" && request.method === "POST") return adminCreatePost(request, env);
  if (pathname === "/api/admin/promos" && request.method === "POST") return adminCreatePromo(request, env);
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
  const { results } = await env.DB.prepare("SELECT slug, title, excerpt, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 30").all();
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
  return json({
    dns_url: settings.dns_url || env.DNS_DOWNLOAD_URL || "https://ctv.nodns.vn/cai-dns",
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
  if (!username) throw httpError(400, "Username chỉ gồm 2–64 chữ, số, dấu chấm, gạch dưới hoặc gạch ngang; không dán link.");
  if (contact.length < 3) throw httpError(400, "Vui lòng nhập thông tin liên hệ.");
  const plan = await findPlan(env, body.plan_id);
  if (!plan) throw httpError(400, "Gói đã chọn không tồn tại.");
  const promo = body.promo_code ? await findPromo(env, body.promo_code) : null;
  if (body.promo_code && !promo) throw httpError(400, "Mã giảm giá không hợp lệ hoặc đã hết hạn.");
  const discount = promo ? Math.floor(Number(plan.price) * Number(promo.percent) / 100) : 0;
  const amount = Number(plan.price) - discount;
  const code = `LG${randomCode(8)}`;
  await env.DB.prepare("INSERT INTO orders (code, username, contact, plan_id, plan_name, platform, subtotal, discount_amount, amount, promo_code, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')")
    .bind(code, username, contact, plan.id, plan.name, plan.platform, Number(plan.price), discount, amount, promo?.code || null).run();
  return json({ code, amount, transfer_content: code, bank_name: env.BANK_NAME || "", bank_bin: env.BANK_BIN || "", bank_account: env.BANK_ACCOUNT || "", account_name: env.BANK_ACCOUNT_NAME || "" }, 201);
}

async function getOrder(env, code) {
  requireDb(env);
  if (!/^LG[A-Z0-9]{8}$/.test(code)) throw httpError(400, "Mã đơn không hợp lệ.");
  const order = await env.DB.prepare("SELECT code, plan_name, amount, status, created_at, paid_at FROM orders WHERE code = ?").bind(code).first();
  if (!order) throw httpError(404, "Không tìm thấy đơn.");
  return json(order);
}

async function sepayWebhook(request, env, ctx) {
  requireDb(env);
  if (!env.SEPAY_WEBHOOK_API_KEY) throw httpError(503, "Webhook chưa được cấu hình.");
  const authorization = request.headers.get("Authorization") || "";
  if (!(await constantTimeEqual(authorization, `Apikey ${env.SEPAY_WEBHOOK_API_KEY}`))) throw httpError(401, "Webhook không hợp lệ.");
  const payload = await readJson(request);
  if (payload.transferType !== "in" || !Number.isFinite(Number(payload.transferAmount))) return json({ success: true });
  const transactionId = String(payload.id || "");
  if (!transactionId) throw httpError(400, "Thiếu mã giao dịch.");
  const content = `${payload.code || ""} ${payload.content || ""} ${payload.description || ""}`.toUpperCase();
  const code = content.match(/LG[A-Z0-9]{8}/)?.[0];
  if (!code) return json({ success: true });

  const inserted = await env.DB.prepare("INSERT OR IGNORE INTO payment_events (provider, transaction_id, amount, payload_json) VALUES ('sepay', ?, ?, ?)")
    .bind(transactionId, Number(payload.transferAmount), JSON.stringify(payload).slice(0, 20000)).run();
  if (!inserted.meta?.changes) return json({ success: true });

  const order = await env.DB.prepare("SELECT * FROM orders WHERE code = ?").bind(code).first();
  if (!order || Number(payload.transferAmount) < Number(order.amount)) return json({ success: true });
  const updated = await env.DB.prepare("UPDATE orders SET status = 'paid', payment_ref = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE code = ? AND status = 'pending'")
    .bind(String(payload.referenceCode || transactionId), code).run();
  if (updated.meta?.changes === 1) ctx.waitUntil(activateOrder(env, { ...order, status: "paid" }));
  return json({ success: true });
}

async function activateOrder(env, order) {
  const settings = await readSettings(env, ["upstream_api_url"]);
  const apiUrl = settings.upstream_api_url || env.UPSTREAM_API_URL;
  if (!apiUrl || !env.UPSTREAM_API_KEY) return;
  try {
    const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.UPSTREAM_API_KEY}` }, body: JSON.stringify({ order_code: order.code, username: order.username, plan_id: order.plan_id, platform: order.platform }) });
    if (!response.ok) throw new Error(`Upstream ${response.status}`);
    await env.DB.prepare("UPDATE orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE code = ?").bind(order.code).run();
  } catch (error) { console.error("Activation failed", order.code, error); }
}

async function adminLogin(request, env) {
  rateLimit(request, "admin-login", 6, 15 * 60_000);
  if (!env.ADMIN_PASSWORD_SHA256 || !env.SESSION_SECRET) throw httpError(503, "Tài khoản quản trị chưa được cấu hình.");
  const { password } = await readJson(request);
  const digest = await sha256Hex(String(password || ""));
  if (!(await constantTimeEqual(digest, env.ADMIN_PASSWORD_SHA256.toLowerCase()))) throw httpError(401, "Mật khẩu không đúng.");
  const token = await signSession({ role: "admin", sub: "admin", exp: Date.now() + 8 * 60 * 60_000 }, env.SESSION_SECRET);
  return withCookie(json({ authenticated: true }), `lg_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
}

async function adminOverview(request, env) {
  await requireSession(request, env, "admin");
  requireDb(env);
  const [orders, paid, ctv, posts] = await Promise.all([
    count(env, "SELECT COUNT(*) count FROM orders WHERE ctv_id IS NULL"),
    count(env, "SELECT COUNT(*) count FROM orders WHERE status IN ('paid','completed')"),
    count(env, "SELECT COUNT(*) count FROM ctv_users WHERE active = 1"),
    count(env, "SELECT COUNT(*) count FROM posts WHERE status = 'published'"),
  ]);
  return json({ orders, paid_orders: paid, ctv_users: ctv, posts });
}

async function adminOrders(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const { results } = await env.DB.prepare("SELECT code, username, contact, plan_name, amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 100").all();
  return json({ orders: results || [] });
}

async function adminCreatePost(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const body = await readJson(request);
  const title = cleanText(body.title, 140), excerpt = cleanText(body.excerpt, 320), content = cleanText(body.content, 20000);
  if (!title || !excerpt || !content) throw httpError(400, "Vui lòng nhập đủ nội dung bài viết.");
  let slug = slugify(title) || `bai-viet-${Date.now()}`;
  const exists = await env.DB.prepare("SELECT 1 FROM posts WHERE slug = ?").bind(slug).first();
  if (exists) slug += `-${randomCode(4).toLowerCase()}`;
  await env.DB.prepare("INSERT INTO posts (slug, title, excerpt, content, status, published_at) VALUES (?, ?, ?, ?, 'published', CURRENT_TIMESTAMP)").bind(slug, title, excerpt, content).run();
  return json({ message: "Đã xuất bản bài viết.", slug }, 201);
}

async function adminCreatePromo(request, env) {
  await requireSession(request, env, "admin"); requireDb(env);
  const body = await readJson(request);
  const code = cleanText(body.code, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const percent = Number(body.percent);
  if (!code || !Number.isInteger(percent) || percent < 1 || percent > 100) throw httpError(400, "Mã hoặc phần trăm không hợp lệ.");
  const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;
  await env.DB.prepare("INSERT INTO promo_codes (code, percent, expires_at, active) VALUES (?, ?, ?, 1) ON CONFLICT(code) DO UPDATE SET percent = excluded.percent, expires_at = excluded.expires_at, active = 1").bind(code, percent, expiresAt).run();
  return json({ message: "Đã lưu mã giảm giá." });
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
  if (!username || !plan) throw httpError(400, "Username hoặc gói chưa hợp lệ.");
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
  return env.DB.prepare("SELECT code, percent FROM promo_codes WHERE code = ? AND active = 1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)").bind(normalized).first();
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
  return payload;
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
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }
function requireDb(env) { if (!env.DB) throw httpError(503, "Cơ sở dữ liệu D1 chưa được kết nối."); }
async function count(env, sql) { const row = await env.DB.prepare(sql).first(); return Number(row?.count || 0); }
function logout(name) { return withCookie(json({ success: true }), `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`); }
function withCookie(response, cookie) { const headers = new Headers(response.headers); headers.append("Set-Cookie", cookie); return new Response(response.body, { status: response.status, headers }); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
function secure(response) { const headers = new Headers(response.headers); for (const [key, value] of Object.entries(securityHeaders())) headers.set(key, value); return new Response(response.body, { status: response.status, statusText: response.statusText, headers }); }
function securityHeaders() { return { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Cross-Origin-Resource-Policy": "same-origin" }; }
