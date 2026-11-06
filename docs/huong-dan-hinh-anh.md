# Hình ảnh — Phùng Hà Korea

## Lưu trữ duy nhất trên Cloudflare

- CDN: `https://cdn.phunghakorea.com`.
- Cloudflare Worker: `phungha-media`; mã tại `infra/media-worker.mjs`.
- Kho ảnh: Workers KV public media, namespace `f9b9b8a418bd440ca0f6841852292a82`, binding `MEDIA`.
- Worker chỉ đọc ảnh qua GET/HEAD, trả đúng MIME, ETag, Cache-Control và CORS. Không lấy ảnh từ GitHub hay website chính khi thiếu ảnh.
- Upload ảnh qua Cloudflare API đã xác thực; không có endpoint upload công khai. Giữ tên có phiên bản để tránh cache cũ.
- GitHub chỉ lưu code, URL và metadata ảnh trong `infra/media-manifest.json`. Không lưu file ảnh, ảnh base64, ảnh mẫu hoặc bản dự phòng trong repo. `.gitignore` chặn các định dạng ảnh.
- 47 ảnh/biểu tượng đã được kiểm tra byte size và SHA-256 từ KV khớp bản gốc trước khi bỏ file khỏi source.
- Các đường dẫn `/assets/...` trong nội dung bài viết được renderer chuyển thành URL CDN. Nội dung bài viết giữ nguyên.

## Cập nhật ảnh

1. Tạo ảnh bằng LLM từ tham chiếu đúng người/sản phẩm trên fanpage; không tự nghĩ thêm nhãn hàng, bao bì hay công dụng.
2. Xuất WebP phù hợp kích thước hiển thị, thường 480 và 960px. Giữ ảnh gốc ở ngoài repo.
3. Upload binary vào KV với key là đường dẫn ảnh bắt đầu bằng `/assets/`, metadata `contentType` và `etag`.
4. Kiểm tra URL CDN, kích thước và SHA-256; thêm metadata vào manifest rồi cập nhật trang.
5. Dùng alt mô tả, width/height, srcset; lazy loading cho ảnh ngoài màn hình đầu.

## Chân dung lời nhắn

`/assets/editorial/phung-ha-founder-v2-{480,960}.webp`: ảnh LLM từ người thật trong ảnh fanpage, dáng nghiêng, khẽ vén tóc và cười tươi, áo lụa kem trên nền spa xanh sage. Dùng ở lời nhắn trang chủ và Chuyện của Hà.

Đã bỏ ảnh poster phóng 192%, lớp phủ tối, chữ chồng lên mặt, khung vòm và biểu tượng trang trí. Chữ 15–16px, nút tối thiểu 48px; mobile một cột, ảnh 4:5 giữ đầy đủ khuôn mặt và cử chỉ.
