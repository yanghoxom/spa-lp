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

## Ảnh danh mục mỹ phẩm

Bộ ảnh `public/assets/collections/*-v2-{480,960}.webp` được tạo bằng LLM dựa trên sản phẩm thật từ fanpage Phùng Hà Korea, theo yêu cầu chủ website ngày 06/11/2026. Dùng chung trên trang chủ, shop, trang chi tiết nhóm và thư viện shop. Không chèn nhãn hoặc watermark lên ảnh.

- Chống nắng: RIEN’A STC UV Sun Ampoule, chai vòi bạc cùng hộp. Ảnh gốc: https://www.facebook.com/photo.php?fbid=1611436173713681&set=pb.100045419418570.-2207520000&type=3
- Dưỡng ẩm: hũ kem nắp bạc 30gr trong ảnh `fanpage-product.jpg`.
- Dưỡng sáng: Anti Rosin Ampoule Niacin 4%, từ cùng ảnh gốc.
- Chăm da 35+: bộ ba chai nhỏ giọt 40ml, Anti Rosin Ampoule và hũ kem.
- Ảnh gốc bộ ba: https://www.facebook.com/photo.php?fbid=1650744839782814&set=pb.100045419418570.-2207520000&type=3

Phong cách: ảnh chụp studio, bệ đá, ánh sáng mềm, tông ngà champagne, xanh sage và hồng nhạt. Giữ hình dáng, màu sắc và nhận diện bao bì theo tham chiếu; không thêm sản phẩm hoặc nhãn hàng tự nghĩ ra. Chữ nhỏ do AI dựng lại không dùng để xác minh thành phần hay hướng dẫn sử dụng.

Ảnh 4:5, WebP 480 và 960px, srcset theo màn hình. Alt mô tả sản phẩm; ảnh chi tiết nhóm cũng được dùng trong metadata chia sẻ. Các SVG cũ giữ làm tư liệu, không còn dùng trong trang hiển thị. Không sửa nội dung bài viết khi đổi bộ ảnh.

## Lưu trữ/CDN

- **Nguồn chuẩn:** GitHub `yanghoxom/spa-lp`, thư mục `public/assets/`.
- **Xây dựng:** GitHub push vào `main` → Cloudflare Workers Builds → đóng gói vào `dist/assets/`.
- **Phân phối:** Cloudflare Workers Static Assets tự phục vụ qua CDN tại `https://phunghakorea.com/assets/...`.
- **Không cần thêm:** Cloudflare Images trả phí, R2, cơ sở dữ liệu hay subdomain ảnh ở giai đoạn này.
- Đặt file tên ổn định; nếu thay nội dung ảnh nhưng muốn tránh cache cũ, đổi tên phiên bản như `ten-san-pham-v2.webp`. Không thay asset đã xuất bản nhiều lần mà không đổi tên.
- Hiện headers đặt thời gian cache ảnh 1 ngày; cân nhắc cache dài hơn cho đường dẫn có tên phiên bản.

## Email thương hiệu

Website hiển thị `cskh@phunghakorea.com`. Cloudflare Email Routing đã có quy tắc nhận và chuyển tiếp tất cả địa chỉ của tên miền tới một địa chỉ nhận đã xác minh. Email Routing **không cấp hộp thư gửi** hay tự xác thực gửi dưới địa chỉ này; để trả lời với địa chỉ `cskh@`, cần một dịch vụ gửi thư hỗ trợ xác thực tên miền.
