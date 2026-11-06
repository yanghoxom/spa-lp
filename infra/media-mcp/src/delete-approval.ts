import type { AuthProps } from "./auth";
import { readBoundedBody } from "./download";
import { safeError, unwrap } from "./errors";
import { validateKey, MediaError } from "./validation";

const HEADERS = {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff"};
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]!));

export async function authorizeDelete(request: Request, identity: AuthProps, env: Env) {
  try {
    const url = new URL(request.url);
    if (url.origin !== env.SERVER_ORIGIN) throw new MediaError("INVALID_ORIGIN", "Invalid origin.");
    const key = validateKey(url.searchParams.get("key") ?? "");
    const ticket = url.searchParams.get("ticket") ?? "";
    if (url.searchParams.getAll("key").length !== 1 || url.searchParams.getAll("ticket").length !== 1 || !/^[a-f0-9-]{36}$/.test(ticket)) throw new MediaError("INVALID_CONFIRMATION", "Invalid confirmation link.");
    const stub = env.MEDIA_COORDINATOR.getByName(key);
    let csrf: string | undefined;
    if (request.method === "POST") {
      if (request.headers.get("Origin") !== env.SERVER_ORIGIN) throw new MediaError("INVALID_ORIGIN", "Invalid confirmation origin.");
      if (request.headers.get("Content-Type")?.split(";")[0] !== "application/x-www-form-urlencoded") throw new MediaError("INVALID_FORM", "Invalid confirmation form.");
      const raw = await readBoundedBody(new Response(request.body), 4096);
      const form = new URLSearchParams(new TextDecoder().decode(raw));
      csrf = form.get("csrf") ?? "";
      const cookie = request.headers.get("Cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith("__Host-media-delete="))?.slice("__Host-media-delete=".length);
      if (!csrf || csrf !== cookie || form.get("decision") !== "approve" || form.getAll("csrf").length !== 1) throw new MediaError("INVALID_CONFIRMATION", "Invalid browser confirmation.");
    } else if (request.method !== "GET") return new Response(null, {status: 405, headers: {Allow: "GET, POST"}});
    const result = unwrap(await stub.approve(key, ticket, identity.subject, csrf));
    const headers = new Headers(HEADERS);
    headers.append("Set-Cookie", `__Host-media-delete=${result.approved ? "" : result.csrf}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${result.approved ? 0 : 600}`);
    const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xác nhận xóa ảnh · Phùng Hà Korea</title><style>body{font:17px/1.6 system-ui;background:#fbf7f1;color:#392d30;padding:24px}main{max-width:650px;margin:4vh auto;background:white;border:1px solid #eaded0;border-radius:18px;padding:28px}h1{font-size:26px}code{overflow-wrap:anywhere}button{font:inherit;background:#8d3838;color:white;border:0;border-radius:9px;padding:12px 20px}small{color:#66585d}</style><main><p>PHÙNG HÀ KOREA</p><h1>${result.approved ? "Đã ghi nhận xác nhận của chị" : "Chị có muốn xóa ảnh này?"}</h1><p><code>${escape(key)}</code></p><p>Dung lượng: ${result.byte_size} byte</p><p><small>SHA-256: <code>${escape(result.sha256)}</code></small></p>${result.approved ? "<p>Quay lại ChatGPT và yêu cầu tiếp tục xóa. Xác nhận chỉ có hiệu lực cho đúng ảnh này trong 10 phút kể từ lúc tạo yêu cầu.</p>" : `<p>Ảnh sẽ bị xóa khỏi kho KV. Bản đã lưu trong CDN hoặc trình duyệt có thể vẫn xuất hiện cho tới khi cache hết hạn. Đường dẫn này sẽ không thể dùng lại.</p><form method="post"><input type="hidden" name="csrf" value="${escape(result.csrf)}"><button name="decision" value="approve">Cho phép xóa đúng ảnh này</button></form><p><small>Đóng trang để hủy. Không có ảnh nào bị xóa khi chị chỉ mở trang này.</small></p>`}</main></html>`;
    return new Response(html, {headers});
  } catch (error) {
    return Response.json({error: safeError(error)}, {status: 400, headers: {"Cache-Control": "no-store"}});
  }
}
