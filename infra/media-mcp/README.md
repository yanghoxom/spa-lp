# Phùng Hà Korea Media MCP

Custom MCP Server để ChatGPT quản lý ảnh của **Phùng Hà Korea** trên Cloudflare. Server chỉ cung cấp năm tool về ảnh, dùng **Streamable HTTP tại `/mcp`**, xác thực **OAuth 2.1 với PKCE S256**, và ghi ảnh vào namespace KV hiện có qua binding `MEDIA`.

## 1. Endpoint và phạm vi

| Thành phần | Cấu hình |
| --- | --- |
| MCP server | `https://phungha-media-mcp.tieugia969719.workers.dev/mcp` |
| Health check | `https://phungha-media-mcp.tieugia969719.workers.dev/healthz` |
| CDN công khai | `https://cdn.phunghakorea.com` |
| Worker quản lý ảnh | `phungha-media-mcp` |
| Worker phục vụ ảnh hiện có | `phungha-media` |
| Namespace ảnh | `f9b9b8a418bd440ca0f6841852292a82` — binding `MEDIA` |
| Namespace OAuth riêng | `d239ba4760bb482eb0679bc92216cec0` — binding `OAUTH_KV` |
| Thực thi MCP theo chủ sở hữu | Durable Object `McpRuntime` — binding `MCP_RUNTIME` |
| Điều phối ghi/xóa | Durable Object `MediaCoordinator` — binding `MEDIA_COORDINATOR` |
| Mã nguồn | Thư mục `infra/media-mcp` trong `yanghoxom/spa-lp` |

**Đã triển khai ngày 06/11/2026 UTC.** Worker MCP, hai Durable Object, namespace OAuth và Access app đã được cấu hình. Kiểm tra trực tiếp xác nhận health `200`, hai endpoint OAuth discovery `200`, MCP chưa đăng nhập hoặc dùng token sai trả `401` với `WWW-Authenticate`, và `/authorize` chuyển hướng tới Cloudflare Access. Worker đọc ảnh cũng đã được cập nhật để dùng `metadata.cacheControl`; ảnh CDN hiện có vẫn khớp byte size và SHA-256 trong manifest.

Có thể kiểm tra lại bằng các lệnh ở mục 4. Health `200` xác nhận cấu hình và binding đã có; phiên đăng nhập thật từ ChatGPT cần chủ tài khoản tự hoàn tất OAuth. Luồng OAuth và cả năm tool đã được kiểm thử trên workerd local; chưa khẳng định một phiên ChatGPT production đã kết nối hoặc kiểm chứng CPU của phiên đăng nhập đó.

Mỗi key phải nằm trong `/assets/`. MCP không có tool quản trị DNS, tài khoản, billing, API token, secrets, namespace, hay mã nguồn website. Website tiếp tục dùng URL CDN; GitHub chỉ chứa mã nguồn, URL và metadata, **không chứa binary hoặc base64 của ảnh sản phẩm/ảnh minh họa**.

## 2. Kiến trúc và xác thực

| Thành phần | Nhiệm vụ và giới hạn quyền |
| --- | --- |
| OAuth authorization server | Cấp access token cho đúng resource `/mcp`, hỗ trợ discovery, DCR, CIMD, PKCE S256 và refresh token. Dữ liệu OAuth dùng namespace riêng. |
| Cloudflare Access | Xác thực chủ tài khoản trên trang `/authorize` và trang xác nhận xóa `/authorize/delete`. Chính sách hiện tại dùng mã đăng nhập gửi tới email chủ tài khoản. |
| OAuth resource server | Kiểm tra access token trước mỗi yêu cầu MCP; đối chiếu audience, thời hạn và quyền. |
| Durable Object `McpRuntime` theo chủ sở hữu | Nhận request đã xác thực qua binding riêng; parse JSON, chạy tool, xử lý ảnh và tạo response. Chỉ xử lý một request tại một thời điểm, tối đa tám request đang chạy/chờ. Không lưu ảnh, token hoặc phiên MCP vào SQLite. |
| Durable Object theo key | Tuần tự hóa các lần upload/xóa cùng một key; lưu trạng thái idempotency và phiếu xác nhận xóa. |
| Binding `MEDIA` | Đọc/ghi binary và metadata trong đúng namespace ảnh được chỉ định. |

Worker công khai xử lý OAuth, Access và health check. Sau khi xác minh OAuth cho `/mcp`, Worker chuyển stream của request sang `McpRuntime` bằng binding nội bộ, gắn lại danh tính/quyền từ token đã xác minh và loại bỏ Authorization, Access JWT, cookie. Header danh tính do client tự gửi luôn bị ghi đè. Durable Object kiểm tra lại hình dạng danh tính, email được phép, scope và đường dẫn; nó không có URL public riêng. Mỗi request tạo MCP handler với danh tính của chính request đó, nên một lần refresh thu hẹp scope không giữ lại quyền của request trước. Xem [mô hình truy cập Durable Objects](https://developers.cloudflare.com/durable-objects/get-started/#3-instantiate-and-communicate-with-a-durable-object).

### Hai lớp quyền khác nhau

**Khi triển khai:** Cloudflare CLI hoặc connector xác thực với Cloudflare bằng OAuth hoặc API token được cấu hình ở máy triển khai/CI. Không đưa credential vào mã nguồn.

**Khi MCP chạy:** Worker dùng capability binding `MEDIA` đến namespace cố định. Không cần và không lưu Cloudflare management API token trong Worker. ChatGPT nhận OAuth access token của MCP; token này chỉ được server chấp nhận cho các tool ảnh đã công bố. Đây là cách giới hạn quyền runtime vào đúng kho ảnh mà không phát một API token quản lý Cloudflare cho ChatGPT.

Các scope:

| Scope | Quyền |
| --- | --- |
| `media:read` | `verify_media`, `get_media_metadata`, `list_media`; cũng là quyền nền tảng để gọi MCP. |
| `media:write` | `upload_media`, ngoài `media:read`. |
| `media:delete` | `delete_media`, ngoài `media:read`; vẫn phải xác nhận từng ảnh trong trình duyệt. |
| `offline_access` | Cho phép duy trì kết nối bằng refresh token. |

Trang consent hiển thị tên ứng dụng, hostname nhận mã OAuth và các quyền được yêu cầu. Xác nhận được gắn với cookie trình duyệt, danh tính đăng nhập và yêu cầu OAuth; không cấp thêm scope ngoài các scope đã hiển thị. Access JWT được xác minh chữ ký, issuer, audience, thời hạn, subject và email được cho phép. Header email chưa xác minh không được dùng để đăng nhập.

Access token có thời hạn 1 giờ; refresh grant có thời hạn tối đa 30 ngày trong cấu hình hiện tại. Refresh token được SDK xoay vòng. Sau khi hết hạn hoặc thu hồi kết nối, đăng nhập lại từ ChatGPT.

### Cấu hình Cloudflare Access

Trong Zero Trust, ứng dụng self-hosted phải bảo vệ:

```text
phungha-media-mcp.tieugia969719.workers.dev/authorize
```

Chính sách này cần áp dụng cả đường dẫn con `/authorize/delete`. Cho phép đúng email trong `ALLOWED_EMAIL`; dùng One-time PIN hoặc identity provider đã được kiểm soát. Điền AUD của chính ứng dụng Access này vào `ACCESS_AUD`.

`/mcp` được bảo vệ bằng OAuth của MCP. Các endpoint discovery, `/oauth/register` và `/oauth/token` phải phục vụ giao thức OAuth trực tiếp; không đặt màn hình đăng nhập Access trước các endpoint đó. DCR chỉ đăng ký OAuth client, không cấp quyền đọc/ghi ảnh khi chưa có chủ tài khoản đăng nhập và consent.

## 3. Biến môi trường và binding

Giá trị công khai hiện có nằm trong `wrangler.jsonc`. Cấu hình này không chứa secret.

| Tên | Loại | Giá trị/ý nghĩa |
| --- | --- | --- |
| `MEDIA` | KV binding, bắt buộc | Namespace `f9b9b8a418bd440ca0f6841852292a82`. |
| `OAUTH_KV` | KV binding, bắt buộc | Namespace OAuth riêng; không dùng namespace ảnh cho token/grant. |
| `MCP_RUNTIME` | Durable Object binding, bắt buộc | Class `McpRuntime`; chạy MCP theo chủ sở hữu bằng SQLite-backed Durable Object, có migration trong config. |
| `MEDIA_COORDINATOR` | Durable Object binding, bắt buộc | Class `MediaCoordinator`; có SQLite migration trong config. |
| `SERVER_ORIGIN` | Biến công khai, bắt buộc | `https://phungha-media-mcp.tieugia969719.workers.dev`, không có dấu `/` cuối. Đây cũng là OAuth issuer. |
| `CDN_BASE_URL` | Biến công khai, bắt buộc | `https://cdn.phunghakorea.com`; server từ chối origin khác. |
| `MAX_IMAGE_BYTES` | Biến công khai | `10000000`: **10 MB thập phân**, không phải 10 MiB. Có thể giảm giới hạn; bản này không cho tăng quá 10.000.000 byte. |
| `ACCESS_TEAM_DOMAIN` | Biến công khai, bắt buộc | `https://qidianvp.cloudflareaccess.com`. Chỉ chấp nhận team domain Cloudflare Access HTTPS hợp lệ. |
| `ACCESS_AUD` | Biến công khai, bắt buộc | AUD của Access app bảo vệ `/authorize`; lấy từ config hoặc dashboard. AUD không phải secret. |
| `ALLOWED_EMAIL` | Worker secret, bắt buộc | Email duy nhất được phép cấp quyền cho MCP. Lưu dưới dạng secret để không công khai email cá nhân trong repo. Bản triển khai này dùng email chủ tài khoản Cloudflare đã kết nối. |
| `DOWNLOAD_ALLOWED_HOSTS` | Biến công khai, bắt buộc | Danh sách hostname chính xác, phân tách bằng dấu phẩy. Mặc định: `cdn.phunghakorea.com,files.oaiusercontent.com`. |
| `CLOUDFLARE_API_TOKEN` | Secret **chỉ tại máy deploy/CI**, tùy chọn | Thay cho đăng nhập OAuth của Wrangler nếu dùng CI. Không thêm vào `vars`, không commit `.env`/`.dev.vars`, không nhập vào chat. |
| `CLOUDFLARE_ACCOUNT_ID` | Biến công khai tại máy deploy/CI, tùy chọn | Account hiện tại đã nằm trong `wrangler.jsonc`; cần khớp tài khoản triển khai. |

Không cần `OPENAI_API_KEY`, GitHub token hoặc password cho server này. Client ID/client secret cho kết nối ChatGPT được xử lý bởi DCR/CIMD; không hard-code vào Worker.

**Cấp quyền cho token deploy:** ưu tiên đăng nhập OAuth bằng `wrangler login`. Nếu dùng CI, chọn quyền Workers đủ để deploy Worker này; giao diện mới dùng Workers `Editor` cho Worker đã tồn tại, còn tạo Worker mới cần Workers `Admin`. Các API/công cụ cũ có thể hiển thị quyền tương ứng là `Workers Scripts Write/Edit`. Chỉ thêm `Workers KV Storage Write/Edit` khi quy trình CI thật sự cần tạo hoặc quản lý namespace. Tạo/sửa Access app cần quyền Access tương ứng trong bước thiết lập riêng. Không cấp DNS, billing hay quyền quản trị không cần thiết cho job deploy.

Không gọi một token KV ở phạm vi account là token chỉ truy cập một namespace nếu chính sách Cloudflare thực tế không hỗ trợ mức giới hạn đó. Bản triển khai này đạt giới hạn namespace ở **binding runtime** và không có management token trong MCP. Đối chiếu tên quyền đang có trên dashboard với [tài liệu quyền Workers](https://developers.cloudflare.com/workers/authorization/workers/).

Nếu cần nhập một secret cho CI hoặc công cụ khác, nhập trực tiếp trong giao diện secrets của nhà cung cấp hoặc terminal tại máy của chủ tài khoản. **Không dán secret vào cuộc trò chuyện.**

## 4. Cài đặt, kiểm tra và deploy

Yêu cầu Node.js 24 LTS và npm. Dự án dùng Wrangler hiện có; không cần đổi CLI hoặc cấu trúc website.

Từ checkout của repo:

```bash
cd infra/media-mcp
npm ci
npm run types
npm run typecheck
npm test
npm run build
npm run test:runtime
```

`npm run types` sinh `worker-configuration.d.ts` từ đúng config/runtime. File sinh tự động, `node_modules`, `dist`, `.wrangler`, `.env*`, `.dev.vars*` và log được bỏ qua bởi Git. Không commit các thư mục cache hay output build.

Đăng nhập và triển khai:

```bash
npx wrangler login
npm run deploy
```

`ALLOWED_EMAIL` của bản đã triển khai được giữ trong Worker secret. Khi dựng lại ở tài khoản khác, đặt email chủ sở hữu trong **Worker → Settings → Variables and Secrets** hoặc nhập trực tiếp vào terminal với `npx wrangler secret put ALLOWED_EMAIL`. Không đưa email/credential vào source public hoặc paste secret vào chat. Khai báo `secrets.required` giúp kiểm tra cấu hình và sinh type.

Worker đọc ảnh có config riêng `reader.wrangler.jsonc`. Sau khi xác nhận đúng Worker `phungha-media` và binding `MEDIA`, dùng `npm run deploy:reader` nếu cần triển khai lại phần đọc `metadata.cacheControl`. Config MCP chính không deploy website hoặc Worker đọc ảnh.

Lệnh đăng nhập mở luồng OAuth của Cloudflare trên máy của người triển khai. Khi dùng CI, cung cấp credential qua secret của CI, không ghi giá trị token trong command được commit. Sau khi migration `v1` đã áp dụng, giữ nguyên lịch sử migration; các thay đổi class/storage tiếp theo cần migration mới.

Các probe không ghi dữ liệu:

```bash
curl -i https://phungha-media-mcp.tieugia969719.workers.dev/healthz
curl -i https://phungha-media-mcp.tieugia969719.workers.dev/.well-known/oauth-authorization-server
curl -i https://phungha-media-mcp.tieugia969719.workers.dev/.well-known/oauth-protected-resource/mcp
curl -i https://phungha-media-mcp.tieugia969719.workers.dev/mcp
```

Kỳ vọng: health `200` với `status: "ok"`; hai discovery endpoint trả metadata; gọi `/mcp` không có access token trả **`401` kèm `WWW-Authenticate`**. Đây là phản hồi bảo vệ tài nguyên đúng, không phải lỗi cần bỏ xác thực. Thiếu cấu hình xác thực sẽ trả `503` và không thực thi tool.

Sau deploy, kết nối OAuth bằng tài khoản chủ sở hữu và thử `list_media`, `get_media_metadata`, `verify_media` trên một key đã biết. Nếu cần thử upload, dùng key phiên bản mới chỉ dành cho thử nghiệm; gọi `verify_media` sau upload. Muốn xóa ảnh thử nghiệm vẫn phải đi qua luồng xác nhận của `delete_media`.

Local development:

```bash
npm run dev
```

Mặc định Wrangler dùng storage local. Không bật remote KV binding khi chỉ chạy test phát triển. Các request phải có origin đúng với `SERVER_ORIGIN`; nếu chạy bằng localhost, dùng override local `SERVER_ORIGIN=http://localhost:8787`. Luồng đăng nhập Access cần hostname đã được cấu hình trong Access để thử đầy đủ. Unit test xác thực dùng khóa RSA thử nghiệm, không cần secret thật hoặc email OTP thật.

## 5. Kết nối với ChatGPT Custom MCP

1. Trong ChatGPT trên web, mở **Plugins → dấu cộng → Add custom MCP server**. Tên mục có thể phụ thuộc giao diện workspace.
2. Tên gợi ý: **Phùng Hà Korea Media**.
3. Server URL: `https://phungha-media-mcp.tieugia969719.workers.dev/mcp`.
4. Chọn **OAuth**. Để trống OAuth Client ID và Client Secret để dùng đăng ký động; nếu có lựa chọn cách đăng ký, chọn **DCR**. Server cũng công bố hỗ trợ CIMD cho client phù hợp.
5. Tạo plugin, cài vào tài khoản/workspace của chị và bắt đầu kết nối. Đăng nhập qua Cloudflare Access bằng email chủ tài khoản, rồi xem và đồng ý các scope trên trang consent.
6. Giữ chế độ xác nhận cho tool ghi. Với `delete_media`, xác nhận của ChatGPT và trang xác nhận xóa riêng của server là hai bước bổ sung cho nhau.
7. Sau khi đổi schema hoặc mô tả tool, dùng chức năng refresh/scan tools của plugin để ChatGPT nạp catalog mới.

Không chọn **No authentication**, và không nhập Cloudflare API token vào phần OAuth Client Secret. Custom MCP của ChatGPT dùng OAuth; token triển khai Cloudflare có mục đích khác.

Server truyền `securitySchemes` với scope cho từng tool. Nếu kết nối ban đầu chỉ có `media:read`, hãy cấp thêm `media:write` hoặc `media:delete` qua luồng OAuth khi client yêu cầu quyền cho thao tác tương ứng.

### File ChatGPT gửi cho MCP

`upload_media` có `_meta["openai/fileParams"]: ["file"]`. Object `file` có đúng hình dạng native của ChatGPT:

```json
{
  "download_url": "https://files.oaiusercontent.com/DUONG_DAN_TAM_DO_CHATGPT_CAP",
  "file_id": "FILE_ID_DO_CHATGPT_CAP",
  "mime_type": "image/webp",
  "file_name": "serum-960.webp"
}
```

`download_url` và `file_id` bắt buộc. `mime_type` và `file_name` phải có trong schema nhưng là giá trị tùy chọn. Ví dụ trên chỉ mô tả cấu trúc; ChatGPT phải truyền reference thật của file đã được người dùng cho phép.

Server tải ngay URL tạm thời, kiểm tra host, kích thước và MIME, rồi lưu binary vào KV. Không ghi URL có chữ ký, file ID, token hoặc binary vào log. Một đường dẫn `sandbox:`, đường dẫn trên máy cá nhân, hay chỉ riêng `file_id` không phải nguồn file mà Worker có thể tự đọc.

Hostname tải file thực tế có thể khác `files.oaiusercontent.com`. Khi nhận `HOST_NOT_ALLOWED`, chủ hệ thống cần kiểm tra hostname được ChatGPT cấp và cấu hình **đúng hostname công khai, tin cậy đó** trong `DOWNLOAD_ALLOWED_HOSTS`, rồi deploy lại. Không thêm wildcard như `*.amazonaws.com`, không tự cho phép host theo input của tool. Không ghi signed download URL vào repo.

## 6. Agent Builder và client ứng dụng

Trong workflow Agent Builder còn đang sử dụng, thêm **MCP node**, thêm server URL ở trên và cấu hình kết nối được xác thực. Truyền input theo schema ở mục 7. Chèn **Human approval** trước thao tác ghi/xóa, đặc biệt là bước tiếp tục `delete_media` sau khi người dùng đã xác nhận trong trình duyệt.

Nếu phiên bản giao diện chỉ cho nhập authorization token, ứng dụng quản lý kết nối cần hoàn thành OAuth và cung cấp access token của **MCP** qua cấu hình bảo mật của client/workflow. Không dùng Cloudflare API token và không chuyển token qua input hội thoại. Việc tự động gia hạn token thuộc client OAuth; server đã có endpoint refresh.

**Lưu ý về vòng đời sản phẩm, kiểm tra ngày 07/11/2026:** tài liệu chính thức của OpenAI cho biết Agent Builder đã được thông báo ngừng cung cấp và dự kiến đóng ngày **30/11/2026**. Hướng dẫn Builder trên dành cho workflow hiện có trong giai đoạn chuyển tiếp. Server MCP này độc lập với Builder; có thể dùng tiếp từ ChatGPT Custom MCP, Workspace Agents hoặc một ứng dụng Agents SDK hỗ trợ remote MCP. Xem [Agent Builder](https://developers.openai.com/api/docs/guides/agent-builder) và [hướng dẫn chuyển đổi](https://developers.openai.com/api/docs/guides/agent-builder/migrate-from-agent-builder).

Với client ngoài ChatGPT, có thể truyền `base64` do code đọc trực tiếp từ file trong bộ nhớ. Không để mô hình đoán hoặc tự viết hàng triệu ký tự base64. Base64 không có prefix `data:`, khoảng trắng hoặc xuống dòng. Việc encode chỉ xảy ra khi gọi tool; không lưu payload đó vào Git, fixture hoặc log.

## 7. Catalog tool, schema và ví dụ

Schema đầy đủ được khai báo tại `src/schemas.ts` và được server công bố qua MCP `tools/list`, gồm cả `inputSchema` và `outputSchema`. Tên trường metadata lưu trong KV dùng camelCase; output tool dùng snake_case.

| Tool | Quyền | `readOnlyHint` | `destructiveHint` | `idempotentHint` | `openWorldHint` |
| --- | --- | --- | --- | --- | --- |
| `upload_media` | `media:write` | `false` | `false` | `true` | `true` |
| `verify_media` | `media:read` | `true` | `false` | `true` | `true` |
| `get_media_metadata` | `media:read` | `true` | `false` | `true` | `false` |
| `list_media` | `media:read` | `true` | `false` | `true` | `false` |
| `delete_media` | `media:delete` | `false` | `true` | `true` | `true` |

`upload_media` là thao tác **write/consequential**: xuất bản ảnh lên Internet và phải được client xử lý như thao tác ghi. `destructiveHint` là `false` vì bản này từ chối thay bytes khác vào key đã có. `delete_media` được đánh dấu destructive và còn có chốt xác nhận thật ở phía server. Annotation không tự thay thế kiểm tra quyền hay xác nhận.

Trong MCP, server dùng các annotation được hỗ trợ ở bảng trên; `readOnlyHint: false` giúp host áp dụng chính sách xác nhận cho thao tác ghi. Trường `x-openai-isConsequential` thuộc [OpenAPI của GPT Actions](https://developers.openai.com/api/docs/actions/production#consequential-flag), không phải annotation MCP chuẩn. Xem [quy tắc xác nhận Custom MCP](https://developers.openai.com/api/docs/guides/custom-mcp-server) và [tool annotations](https://developers.openai.com/plugins/reference). Với xóa ảnh, xác nhận trong trình duyệt được server bắt buộc riêng, nên client hoặc model không thể tự bỏ qua bằng cách chỉ gửi `confirmed: true`.

### 7.1 `upload_media`

Input:

| Trường | Bắt buộc | Nội dung |
| --- | --- | --- |
| `key` | Có | Key ASCII hợp lệ dưới `/assets/`, tối đa 512 byte; phần mở rộng phải khớp định dạng thật. |
| `content_type` | Có | Một trong `image/webp`, `image/jpeg`, `image/png`, `image/avif`. |
| `file` | Một trong hai nguồn | Native file object của ChatGPT như mục 5. |
| `base64` | Một trong hai nguồn | Chuỗi base64 chuẩn của ảnh; không dùng đồng thời với `file`. |
| `etag` | Không | ETag hợp lệ. Mặc định là SHA-256 được bọc trong dấu nháy kép. |
| `cache_control` | Không | Chính sách cache hợp lệ; mặc định metadata là `public, max-age=31536000, immutable`. |

Ví dụ gọi bằng file reference:

```json
{
  "name": "upload_media",
  "arguments": {
    "key": "/assets/products/serum-20261107-v1-960.webp",
    "file": {
      "download_url": "https://files.oaiusercontent.com/DUONG_DAN_TAM_DO_CHATGPT_CAP",
      "file_id": "FILE_ID_DO_CHATGPT_CAP",
      "mime_type": "image/webp",
      "file_name": "serum-960.webp"
    },
    "content_type": "image/webp",
    "cache_control": "public, max-age=31536000, immutable"
  }
}
```

Output thành công luôn gồm `key`, `cdn_url`, `content_type`, `byte_size`, `sha256`, `etag`, `uploaded_at`. `cdn_url` được dựng từ origin CDN cố định và key đã validate. `byte_size` tính từ bytes thực; `sha256` là 64 ký tự hex chữ thường; `uploaded_at` là thời gian ISO UTC. KV lưu binary cùng `contentType`, `etag`, `sha256`, `byteSize`, `uploadedAt`, `cacheControl`.

**Idempotency và phiên bản:** cùng key và SHA-256 trả lại metadata ban đầu; không ghi lại ảnh hoặc làm đổi `uploaded_at`/ETag/cache policy. Cùng key nhưng bytes khác trả `KEY_CONFLICT`; hãy tạo key phiên bản mới rồi cập nhật URL trong website. Key đã xóa bị đánh dấu retired và không được tái sử dụng. Tên có `v1`/ngày/hash là quy ước khuyến nghị; quy tắc bắt buộc thực tế là key hợp lệ, nội dung bất biến.

Với object cũ chưa từng được MCP quản lý, upload lại **đúng cùng bytes** sẽ nhận quản lý và bổ sung metadata còn thiếu một lần; sau đó các lần lặp là no-op. SHA khác sẽ bị từ chối, không tự ghi đè ảnh cũ.

MCP kiểm tra chữ ký và cấu trúc container ảnh, không chỉ tin đuôi file hay MIME do người gọi khai báo. Kiểm tra này **không giải mã toàn bộ pixels, không quét malware và không resize/transcode**. Nên chuẩn bị trước ảnh WebP 480px và 960px, rồi upload từng file bằng key riêng.

`cache_control` được validate và lưu trong metadata. Worker đọc ảnh `phungha-media` trong `infra/media-worker.mjs` dùng `metadata.cacheControl` hợp lệ cho header response; ảnh cũ chưa có trường này giữ fallback `public, max-age=86400`. Triển khai cả thay đổi Worker đọc ảnh để áp dụng hành vi này. Tool verify hiện đối chiếu nội dung/MIME/size/ETag, không coi cache header là kiểm tra integrity.

### 7.2 `verify_media`

Input phải có **đúng một** trong `key` hoặc `cdn_url`. URL phải là URL canonical trên `https://cdn.phunghakorea.com`, không query, fragment, port lạ, userinfo hoặc đường dẫn đã encode.

```json
{
  "name": "verify_media",
  "arguments": {
    "key": "/assets/products/serum-20261107-v1-960.webp"
  }
}
```

Tương đương:

```json
{
  "name": "verify_media",
  "arguments": {
    "cdn_url": "https://cdn.phunghakorea.com/assets/products/serum-20261107-v1-960.webp"
  }
}
```

Output:

| Trường | Ý nghĩa |
| --- | --- |
| `exists` | Có object trong lần đọc KV này. |
| `publicly_available` | CDN trả ảnh hợp lệ có thể tải công khai. Không tự suy ra rằng ảnh đó khớp KV. |
| `cdn_url` | URL CDN canonical. |
| `content_type`, `byte_size`, `sha256`, `etag` | Giá trị của object KV; có thể `null` khi không tồn tại/metadata cũ thiếu. SHA và size được tính từ bytes khi kiểm tra. |
| `integrity_ok` | `true` khi object tồn tại, CDN tải được và các đối chiếu đều khớp. **Chỉ dùng URL cho website sau khi trường này là `true`.** |
| `mismatches` | Các chỗ không khớp, chẳng hạn `sha256`, `etag`, `byte_size`, `content_type`, `kv_sha256`, `cdn_http_status`. |
| `cdn` | HTTP status của HEAD/GET và MIME/size/SHA/ETag thực tế từ CDN. |

Tool đọc KV, gọi HEAD và GET CDN bằng origin cố định, không theo redirect; kiểm tra bytes thực, metadata KV và header CDN. Không ghi object hoặc metadata. Có thể xuất hiện sai khác tạm thời do KV/CDN cache chưa lan truyền; chạy lại `verify_media` sau đó, không tự upload đè để xử lý cache.

### 7.3 `get_media_metadata`

```json
{
  "name": "get_media_metadata",
  "arguments": {
    "key": "/assets/products/serum-20261107-v1-960.webp"
  }
}
```

Trả `exists`, `key`, `cdn_url`, `content_type`, `byte_size`, `sha256`, `etag`, `uploaded_at`. Tool tra danh mục/metadata KV, không lấy toàn bộ binary. Các trường thiếu ở ảnh cũ là `null`; `verify_media` có thể tính size/SHA mà không thay đổi ảnh. Đọc metadata không tự sửa hoặc backfill dữ liệu.

### 7.4 `list_media`

```json
{
  "name": "list_media",
  "arguments": {
    "prefix": "/assets/products/",
    "limit": 25
  }
}
```

Mặc định `prefix: "/assets/"`, `limit: 25`; `limit` từ 1 đến 100. Output gồm `items`, `prefix`, `limit`, `list_complete`, `cursor`. Mỗi item có cùng metadata ảnh như trên, không có binary.

Khi `list_complete` là `false`, gọi tiếp với **cursor nguyên vẹn do server trả**, cùng prefix và limit:

```json
{
  "name": "list_media",
  "arguments": {
    "prefix": "/assets/products/",
    "limit": 25,
    "cursor": "CURSOR_NGUYEN_VEN_TU_KET_QUA_TRUOC"
  }
}
```

Không kết luận hết dữ liệu chỉ vì một trang `items` rỗng; tiếp tục theo `list_complete`. Danh sách không phải snapshot giao dịch của toàn kho trong lúc có upload/xóa khác diễn ra.

### 7.5 `delete_media`

Lần đầu chỉ tạo yêu cầu xác nhận cho **một key**:

```json
{
  "name": "delete_media",
  "arguments": {
    "key": "/assets/products/serum-20261107-v1-960.webp"
  }
}
```

Output có `status: "confirmation_required"`, `deleted: false`, `confirmation_token`, `approval_url`, `expected_sha256` và `expires_at`. ChatGPT phải đưa `approval_url` cho chủ tài khoản mở trong trình duyệt. Người dùng đăng nhập Access, kiểm tra key/SHA và nhấn **Cho phép xóa đúng ảnh này**. Chỉ mở link không xóa ảnh và không tự phê duyệt.

Sau khi chủ tài khoản xác nhận, gọi lại:

```json
{
  "name": "delete_media",
  "arguments": {
    "key": "/assets/products/serum-20261107-v1-960.webp",
    "confirmation_token": "UUID_DO_LAN_GOI_DAU_TRA_VE"
  }
}
```

`UUID_DO_LAN_GOI_DAU_TRA_VE` là placeholder mô tả: phải thay bằng **giá trị thật do tool trả**, không tạo UUID khác. Phiếu hiệu lực 10 phút, gắn với đúng người dùng, key và SHA-256. Model không thể chỉ đặt `confirmed: true` để tự xóa. Nếu chưa được phê duyệt, lần gọi sau vẫn trả `confirmation_required`. Nếu phiếu hết hạn hoặc object đổi, server từ chối.

Các trạng thái: `confirmation_required`, `approved`, `deleted`, `not_found`. Kết quả cũng có `key`, `cdn_url`, `deleted`, `confirmation_token`, `approval_url`, `expected_sha256`, `expires_at`, `cdn_cache_may_remain`. Tool không nhận mảng key, wildcard hoặc prefix để xóa hàng loạt. Lặp lại một lần xóa đã hoàn tất không xóa thêm object nào.

Xóa KV không bảo đảm xóa tức thì ảnh đã lưu trong cache CDN, cache trình duyệt hoặc bản người khác đã tải. `cdn_cache_may_remain: true` báo giới hạn đó. Server không có quyền purge toàn zone và không cung cấp tool purge/DNS. Với metadata mặc định cache một năm, cần cân nhắc thời gian cache trước khi xuất bản ảnh có thể phải rút xuống.

## 8. Quy tắc bảo mật, consistency và vận hành

**Đường dẫn:** chỉ dùng chữ ASCII, số, dấu chấm, gạch ngang, gạch dưới và thư mục `/assets/`. Từ chối `%`, backslash, ký tự điều khiển, segment rỗng, `.`/`..`, key ngoài prefix và cách viết URL bị parser chuẩn hóa. Không có đọc/ghi đường dẫn filesystem từ input.

**Tải file từ xa:** chỉ HTTPS, hostname chính xác trong allowlist do chủ hệ thống cấu hình; không IP literal, localhost, hostname nội bộ, Unicode/punycode, userinfo, fragment, port tùy ý hoặc redirect. Không chuyển tiếp Authorization/cookie của request MCP tới host ảnh. Áp dụng deadline toàn lần tải, giới hạn bytes đọc theo stream, kể cả khi server nguồn không gửi Content-Length hoặc gửi sai.

Allowlist phải chứa host mà chủ hệ thống tin cậy cả DNS và endpoint. Worker không có API ghim địa chỉ DNS riêng cho một fetch. Vì vậy không đưa hostname do bên không tin cậy kiểm soát vào allowlist; `global_fetch_strictly_public` cũng được bật cho SDK OAuth/CIMD.

**Idempotency:** coordinator giữ trạng thái bền vững theo key và tuần tự hóa thao tác do MCP thực hiện. Để bảo đảm này có hiệu lực, mọi thay đổi ảnh cần đi qua MCP; không đồng thời ghi/xóa trực tiếp namespace bằng script khác. `verify_media` kiểm tra bytes/metadata thực tế để phát hiện thay đổi ngoài luồng; xác nhận xóa kiểm tra SHA trước khi xóa. Không có transaction phân tán nào có thể ngăn một bên khác tự ghi trực tiếp vào KV bằng quyền quản trị.

Workers KV và CDN có đặc tính cache/lan truyền. Một upload thành công có nghĩa ảnh đã được ghi theo API KV, chưa có nghĩa mọi POP đọc được ngay. Không dùng một khoảng thời gian cố định làm bằng chứng; dùng `verify_media.integrity_ok`. Không thay key cũ để “làm mới cache”; tạo key phiên bản mới.

**Log:** code không ghi request body, binary, base64, Authorization, Access JWT, signed URL hoặc exception thô. Config tắt invocation log và che query string; giữ observability/traces phục vụ vận hành. Khi bổ sung logging hoặc tích hợp hệ thống ngoài, chỉ ghi sự kiện và số liệu cần thiết, không ghi toàn request/context OAuth.

**MIME:** chỉ bốn định dạng cho phép. Xác minh cấu trúc container giới hạn dung lượng giúp chặn file giả đuôi, payload HTML/SVG hoặc file sai MIME; không thay thế một bộ giải mã/sanitizer đầy đủ. Quy trình này không xử lý ảnh SVG, GIF, PDF, file nén hoặc ảnh quá giới hạn.

**Giới hạn runtime và gói Free:** tài khoản này dùng Workers Free, với giới hạn CPU Worker thông thường 10 ms/request. Config không đặt `limits.cpu_ms` cao hơn và không yêu cầu đổi gói. Phần xử lý ảnh, JSON và SHA-256 chạy trong SQLite-backed `McpRuntime`; Cloudflare hỗ trợ loại Durable Object này trên Free và công bố mức CPU mặc định 30 giây mỗi invocation. Worker công khai vẫn phải đáp ứng giới hạn CPU riêng khi xử lý OAuth/Access. Giới hạn bộ nhớ, quota KV/DO và rate limit của gói vẫn áp dụng; CPU time khác với thời gian chờ mạng. Xem [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) và [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/).

`McpRuntime` tuần tự hóa xử lý theo chủ sở hữu, giới hạn tám request đang chạy/chờ và tối đa 1.000.000 byte response metadata. Khi đầy hàng đợi, client nhận `503 server_busy` và `Retry-After`. Body JSON bị giới hạn tương ứng ảnh 10 MB; đọc body và response có deadline 45 giây kể từ khi bắt đầu xử lý. Thời gian chờ trong hàng đợi và một thao tác storage đang thực thi không được bảo đảm kết thúc bởi deadline đọc stream này. Không đưa payload ảnh vào DO storage. Bài `npm run test:runtime` kiểm tra đường đi OAuth → MCP runtime → coordinator → KV bằng workerd local, gồm ảnh đúng 10.000.000 byte và từ chối 10.000.001 byte; kết quả local không thay thế kiểm chứng CPU/quota trên tài khoản production.

**Tương thích SDK:** server đọc body có giới hạn và parse JSON đúng một lần, rồi truyền `parsedBody` vào handler SDK. Cách này tránh giới hạn 4 MiB riêng của lớp legacy trong Agents 0.33.0; giữ giới hạn JSON tương ứng ảnh 10 MB ở lớp HTTP. JSON-RPC batch bị từ chối; mỗi request chỉ gọi một thao tác.

## 9. Test và cấu trúc mã nguồn

| File | Vai trò |
| --- | --- |
| `src/index.ts` | HTTP routing, health check, xác thực rồi chuyển request MCP sang binding nội bộ. |
| `src/runtime.ts` | Durable Object chạy handler Streamable HTTP, giới hạn body/response và tuần tự hóa request theo chủ sở hữu. |
| `src/auth.ts` | OAuth, Access JWT, consent chống CSRF, scope và lỗi xác thực an toàn. |
| `src/mcp.ts` | Đăng ký đúng năm tool, annotation, quyền và metadata native file của ChatGPT. |
| `src/schemas.ts` | Schema input/output bằng Zod. |
| `schemas/tools.json` | Bản JSON Schema của cả năm tool; tạo lại bằng `npm run schemas`. |
| `scripts/runtime-smoke.mjs` | Kiểm thử workerd/DO/KV thật tại local, OAuth giả lập có chữ ký, ảnh tạo trong RAM và không gọi tài nguyên production. |
| `src/validation.ts` | Canonical path, MIME/container, base64, ETag và Cache-Control. |
| `src/download.ts` | HTTPS allowlist, SSRF boundary, timeout và đọc stream có giới hạn. |
| `src/media.ts` | Upload/verify/metadata/list/delete, hash, idempotency và phiếu xóa. |
| `src/coordinator.ts` | Durable Object bảo vệ thao tác cùng key. |
| `src/repository.ts` | Adapter KV binary và metadata. |
| `src/delete-approval.ts` | Trang xác nhận xóa thật trong trình duyệt. |
| `test/` | Test chức năng và kiểm tra các ranh giới bảo mật; fixture ảnh tổng hợp từ code, không có ảnh thật hoặc base64 ảnh trong Git. |

Chạy `npm test`. Test bao gồm path traversal/canonical URL, các MIME được phép và giả mạo, kích thước thực và khai báo, base64, HTTPS allowlist/redirect/timeout, upload lặp và xung đột key, verify KV/CDN không khớp, phân trang/metadata, xác nhận xóa, và lỗi xác thực.

Kết quả bản triển khai này: **252 test unit/protocol đạt**, typecheck và build đạt; **31 bước kiểm thử runtime đạt** qua Worker OAuth → `McpRuntime` → `MediaCoordinator` → KV local. Bộ test website hiện có cũng đạt 23 test và build thành công.

Test OAuth sử dụng SDK OAuth thực cho DCR → PKCE → consent → đổi code → xác thực MCP → refresh thu hẹp scope. Trong unit test, KV và lớp nền runtime được thay bằng test double; chữ ký JWT RSA, kiểm tra issuer/audience/expiry, CSRF/cookie/subject, replay và lỗi không lộ token được kiểm tra thực. Bài runtime dùng workerd, KV và Durable Object thật ở local, với Access/JWKS/CDN giả lập có kiểm soát. Nó kiểm tra ảnh đúng 10.000.000 byte, từ chối 10.000.001 byte, upload lặp, file reference, verify/list/metadata, xác nhận xóa và chống giả mạo header để nâng quyền. Không upload hoặc xóa ảnh production trong kiểm thử này.

Kiểm tra HTTP production đã đạt như mục 1. Phiên đăng nhập Access/ChatGPT thật và giới hạn CPU production của phiên đó cần được kiểm chứng khi chủ tài khoản kết nối lần đầu.

## 10. Xử lý lỗi thường gặp

| Kết quả | Cách xử lý |
| --- | --- |
| `401` ở `/mcp` khi chưa login | Thực hiện OAuth từ Custom MCP; không bỏ lớp xác thực. |
| `authentication_not_configured` / `503` | Kiểm tra biến cấu hình và binding; origin không có `/` cuối, AUD đúng Access app. |
| `server_busy` / `503` | Hàng đợi của chủ sở hữu đã đầy; chờ theo `Retry-After` rồi thử lại. Không tăng số request song song. |
| `access_denied` | Đăng nhập đúng tài khoản được phép; kiểm tra team domain/AUD và Access policy. |
| `INSUFFICIENT_SCOPE` | Kết nối/cấp thêm scope đúng tool qua OAuth. |
| `HOST_NOT_ALLOWED` | Xem hostname của reference hợp lệ và cấu hình allowlist chính xác; không mở wildcard. |
| `REDIRECT_NOT_ALLOWED` | Dùng URL tải trực tiếp được cấp, không link redirect. |
| `IMAGE_TOO_LARGE` | Chuẩn bị ảnh nhỏ hơn 10.000.000 byte hoặc giới hạn đã giảm. |
| `MIME_MISMATCH`, `UNSUPPORTED_MIME`, `INVALID_IMAGE` | Xuất lại file thật đúng định dạng; đổi đuôi tên file không chuyển định dạng. |
| `KEY_CONFLICT` | Chọn key phiên bản mới; kiểm tra URL website trước khi đổi. |
| `KEY_RETIRED` | Key đã xóa không được dùng lại; tạo key mới. |
| `INVALID_CONFIRMATION` | Tạo lại phiếu xác nhận, mở link bằng đúng tài khoản, kiểm tra key/SHA rồi tiếp tục. |
| `EXTERNAL_CHANGE` | Kiểm tra thay đổi ngoài MCP và chạy verify; không cố xóa khi chưa rõ phiên bản. |
| `publicly_available: true`, `integrity_ok: false` | Ảnh public đang khác KV hoặc metadata; xem `mismatches`, kiểm tra cache/reader trước khi dùng URL. |

## Tài liệu chính thức

- [OpenAI — Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server): giao thức, lựa chọn OAuth và xác nhận tool ghi.
- [OpenAI — Authentication](https://developers.openai.com/plugins/build/auth): discovery, PKCE, resource/audience, DCR/CIMD và scope.
- [OpenAI — Reference](https://developers.openai.com/plugins/reference): `_meta["openai/fileParams"]`, file object, output schema và annotations.
- [OpenAI — Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines): phân loại read-only/write/destructive.
- [OpenAI — Node reference](https://developers.openai.com/api/docs/guides/node-reference): MCP node và Human approval trong workflow hiện có.
- [Cloudflare — MCP authorization](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/): authorization server và resource server.
- [Cloudflare — Securing MCP servers](https://developers.cloudflare.com/agents/model-context-protocol/guides/securing-mcp-server/): consent và kiểm tra quyền.
- [Cloudflare — Validate Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/): xác minh token Access.
- [Cloudflare — Workers roles](https://developers.cloudflare.com/workers/authorization/workers/): quyền deploy và binding.
- [Cloudflare — Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/): SQLite-backed Durable Objects trên Free, CPU, bộ nhớ và storage.
- [Cloudflare — Workers limits](https://developers.cloudflare.com/workers/platform/limits/): giới hạn CPU/quota của Worker công khai theo gói.
- [Cloudflare — How Workers KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/): consistency và cache.
