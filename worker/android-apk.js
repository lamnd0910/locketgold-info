import manifest from "./android-apk-manifest.js";

export async function downloadAndroidApk(request, env, code) {
  if (!/^LG[A-Z0-9]{8}$/.test(code)) return new Response("Mã đơn không hợp lệ.", { status: 400 });
  if (!env.DB) return new Response("Hệ thống chưa được cấu hình.", { status: 503 });
  const order = await env.DB.prepare("SELECT platform, status, gold_revoked_at FROM orders WHERE code = ?").bind(code).first();
  if (!order) return new Response("Không tìm thấy đơn.", { status: 404 });
  if (order.platform !== "Android" || !["paid", "completed"].includes(order.status) || order.gold_revoked_at) {
    return new Response("Tệp APK chỉ được tải sau khi đơn Android được xác nhận thanh toán.", { status: 403 });
  }
  const getPart = async (path) => {
    const response = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
    if (!response.ok || !response.body || response.headers.get("Content-Type")?.includes("text/html")) throw new Error("APK part unavailable");
    return response.body.getReader();
  };
  let reader = await getPart(manifest.parts[0]);
  let index = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (!done) { controller.enqueue(value); return; }
          reader.releaseLock();
          if (++index === manifest.parts.length) { controller.close(); return; }
          reader = await getPart(manifest.parts[index]);
        }
      } catch (error) { controller.error(error); }
    },
    async cancel(reason) { await reader.cancel(reason); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": `attachment; filename="${manifest.filename}"`,
    "Content-Length": String(manifest.size),
    "Cache-Control": "private, no-store",
  } });
}
