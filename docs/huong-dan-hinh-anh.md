# Hướng dẫn hình ảnh & biểu tượng — Phùng Hà Korea

## Hướng thiết kế

Website theo phong cách **tạp chí chăm sóc da Hàn Quốc** (Korean Editorial): tối giản, trang nhã, nhiều khoảng trắng, màu giấy ngà, xanh trầm và vàng champagne. Hình ảnh làm rõ nhu cầu chăm da trước khi giới thiệu mỹ phẩm.

Bộ màu chủ đạo:

- Giấy ngà: `#F9F6EF`
- Xanh trầm: `#263E32`
- Xanh lá nhạt: `#D9E4D8`
- Be ấm: `#EAE2D0`
- Hồng đất: `#F2DFD8`

## Biểu tượng

Bốn SVG tự thiết kế tại `public/assets/icons/`: `nam-sam.svg`, `duong-am.svg`, `tuoi-35.svg` và `chong-nang.svg`.

- Nét viền mảnh 1,65 đơn vị trên hệ tọa độ 68×68; màu `#405B4C`.
- Không dùng biểu tượng 3D, màu neon, icon emoji lẫn vào các nhóm.
- Vòng tròn nền nhẹ bằng CSS, kích thước 43–56 px.
- Trong thẻ có văn bản mô tả bên cạnh, icon là trang trí: `alt=""`.

## Hình minh họa danh mục mỹ phẩm

Bốn SVG gốc tại `public/assets/collections/` (640×760):

- `chong-nang.svg`: tuýp chống nắng và chi tiết mặt trời.
- `duong-am-phuc-hoi.svg`: hũ kem và đường nét mềm, màu xanh dịu.
- `duong-sang-deu-mau.svg`: lọ tinh chất dạng nhỏ giọt, nền hồng đất.
- `cham-da-tuoi-35.svg`: chai dưỡng da dạng vòi bơm, tông be.

**Đây là hình minh họa nhóm sản phẩm, không phải ảnh của hàng đang bán.** Không ghi tên nhãn, không làm nhãn hàng giả hay đưa giá công khai dựa trên ảnh minh họa. Website hiển thị chú thích "Hình minh họa nhóm sản phẩm".

## Khi có hình sản phẩm bán thực tế

Chỉ sử dụng ảnh gốc do chủ sở hữu cung cấp, ảnh nhà sản xuất cho phép dùng, hoặc hình do Phùng Hà Korea chụp:

1. Lưu tại `public/assets/products/<thuong-hieu>-<ten-san-pham>-<goc-chup>.webp`. Ví dụ: `hang-a-kem-duong-mat-truoc.webp`.
2. Ảnh chính: sản phẩm rõ nét, nền sạch, không nhúng chữ sale, không filter thay đổi màu bao bì. Chiều rộng gợi ý 1200 px; WebP chất lượng khoảng 78–85, mục tiêu 100–250 KB/ảnh (tùy ảnh).
3. Ảnh phụ: mặt sau với nhãn, thành phần, hạn dùng nếu phù hợp. Không làm giả phản hồi khách hàng hay kết quả trước/sau.
4. Khi xuất bản một sản phẩm, cung cấp tên chính xác, dung tích, nhà sản xuất, hướng dẫn, nguồn gốc, giá và tình trạng hàng **đã được Hà xác minh**.
5. Viết `alt` tiếng Việt mô tả khách quan. Đặt `width`/`height` tránh nhảy bố cục, bật `loading="lazy"` cho hình ngoài màn hình đầu.
6. Không thay thế ảnh bán hàng thật bằng ảnh AI tạo ra; ảnh AI chỉ dùng cho minh họa chủ đề, cần nhận diện rõ là minh họa.

## Lưu trữ/CDN

- **Nguồn chuẩn:** GitHub `yanghoxom/spa-lp`, thư mục `public/assets/`.
- **Xây dựng:** GitHub push vào `main` → Cloudflare Workers Builds → đóng gói vào `dist/assets/`.
- **Phân phối:** Cloudflare Workers Static Assets tự phục vụ qua CDN tại `https://phunghakorea.com/assets/...`.
- **Không cần thêm:** Cloudflare Images trả phí, R2, cơ sở dữ liệu hay subdomain ảnh ở giai đoạn này.
- Đặt file tên ổn định; nếu thay nội dung ảnh nhưng muốn tránh cache cũ, đổi tên phiên bản như `ten-san-pham-v2.webp`. Không thay asset đã xuất bản nhiều lần mà không đổi tên.
- Hiện headers đặt thời gian cache ảnh 1 ngày; cân nhắc cache dài hơn cho đường dẫn có tên phiên bản.

## Email thương hiệu

Website hiển thị `cskh@phunghakorea.com`. Cloudflare Email Routing đã có quy tắc nhận và chuyển tiếp tất cả địa chỉ của tên miền tới một địa chỉ nhận đã xác minh. Email Routing **không cấp hộp thư gửi** hay tự xác thực gửi dưới địa chỉ này; để trả lời với địa chỉ `cskh@`, cần một dịch vụ gửi thư hỗ trợ xác thực tên miền.
