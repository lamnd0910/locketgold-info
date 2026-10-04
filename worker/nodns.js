const DEFAULT_BASE = "https://ctv.nodns.vn";
const encoder = new TextEncoder();

export function providerBase(env) {
  const url = new URL(env.NODNS_API_BASE_URL || DEFAULT_BASE);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw failure(503, "URL API NoDNS không hợp lệ.");
  return url.origin;
}

export async function providerRequest(env, path, { method = "GET", body, cookie, apiKey = false } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (apiKey) {
    const key = env.NODNS_API_KEY || env.UPSTREAM_API_KEY;
    if (!key) throw failure(503, "Chưa cấu hình NODNS_API_KEY.");
    headers["x-api-key"] = key;
  }
  let response;
  try {
    response = await fetch(`${providerBase(env)}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(20000) });
  } catch { throw failure(502, "Không thể kết nối API NoDNS. Vui lòng thử lại."); }
  const result = await response.json().catch(() => null);
  if (!result) throw failure(502, "API NoDNS trả về dữ liệu không hợp lệ.");
  if (!response.ok || result.success === false || result.status === "error") {
    const message = typeof result.error === "string" ? result.error : result.message;
    throw failure(response.ok ? 400 : response.status, message || "Yêu cầu NoDNS không thành công.");
  }
  return { result, response };
}

export function unwrap(result) { return result.data ?? result; }

export function grantPayload(order) {
  const durations = { "ios-month": 30, "ios-year": 365, "ios-lifetime": null };
  if (!Object.hasOwn(durations, order.plan_id) || order.platform !== "iOS") return null;
  return { user: order.username, ...(durations[order.plan_id] ? { days: durations[order.plan_id] } : {}), note: order.code };
}

// Remote session cookies stay inside an encrypted HttpOnly cookie on this site.
// Neither upstream cookies nor API keys are exposed in JSON responses.
async function cookieKey(env) {
  if (!env.SESSION_SECRET) throw failure(503, "Chưa cấu hình SESSION_SECRET.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(env.SESSION_SECRET));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const encode = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decode = (text) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export async function remoteCookie(request, env, role) {
  const name = `lg_remote_${role}`;
  const value = (request.headers.get("Cookie") || "").split(";").map((p) => p.trim()).find((p) => p.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value) throw failure(401, "Bạn chưa đăng nhập.");
  try {
    const [iv, ciphertext] = value.split(".");
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv), additionalData: encoder.encode(role) }, await cookieKey(env), decode(ciphertext));
    const payload = JSON.parse(new TextDecoder().decode(plain));
    if (payload.exp <= Date.now()) throw new Error("expired");
    return payload.cookie;
  } catch { throw failure(401, "Phiên đã hết hạn. Vui lòng đăng nhập lại."); }
}

export async function remoteLogin(request, env, role, credentials) {
  const { response } = await providerRequest(env, role === "admin" ? "/api/auth/login" : "/api/ctv/auth/login", { method: "POST", body: credentials });
  const lines = response.headers.getSetCookie?.() || [response.headers.get("Set-Cookie") || ""];
  const cookies = lines.flatMap((line) => line.split(/,(?=\s*[^;,\s]+=)/)).map((line) => line.trim().split(";")[0]).filter(Boolean).join("; ");
  if (!cookies) throw failure(502, "API đăng nhập không trả về cookie phiên.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = encoder.encode(JSON.stringify({ cookie: cookies, exp: Date.now() + 8 * 60 * 60_000 }));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(role) }, await cookieKey(env), plain);
  return `lg_remote_${role}=${encode(iv)}.${encode(new Uint8Array(ciphertext))}; Path=/api/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

export function clearRemoteCookie(role) { return `lg_remote_${role}=; Path=/api/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`; }
export function publicCtv(result) {
  const user = unwrap(result).user ?? unwrap(result).ctv ?? unwrap(result);
  return { username: user.username || user.displayName || "CTV", balance: Number(user.balance || 0), remaining: Number(user.remainingRequests ?? user.remaining ?? user.quota ?? 0), order_count: Number(user.order_count || 0), completed_count: Number(user.completed_count || 0) };
}
export function portalOrders(result) {
  const data = unwrap(result);
  const orders = Array.isArray(data) ? data : data.orders || [];
  return orders.map((order) => ({ code: order.code || order.id || order.orderId || "—", username: order.username || order.userUpgraded || order.displayName || order.userId || "—", plan_name: order.plan_name || order.packageId || "Gold", status: order.status || (order.gold?.active === true ? "completed" : "pending"), amount: Number(order.amount || order.price || 0) }));
}
function failure(status, message) { return Object.assign(new Error(message), { status }); }
