# Phùng Hà Korea — Korean Editorial website

**Live:** https://phunghakorea.com/

Website thương hiệu cá nhân Phùng Hà Korea: trang chủ phong cách Korean Editorial, cẩm nang chăm sóc da, danh mục mỹ phẩm Hàn theo nhu cầu, giới thiệu và bài tư vấn da 5 câu.

## Stack

- Vite 7 + TypeScript + HTML tĩnh, không phụ thuộc CMS/database trả phí.
- Trang được tạo sẵn từ `site/build.mjs` và các file Markdown trong `content/articles/`.
- Cloudflare Workers Static Assets (Free), worker `phungha-korea`.
- Cloudflare Builds tự động chạy khi push `main`.
- Build command: `npm ci && npm run test && npm run build`
- Deploy command: `npx --yes wrangler@4 deploy`
- Cloudflare là đích triển khai duy nhất; GitHub Pages workflow cũ được gỡ để tránh trùng lặp.

## Local

```sh
npm ci
npm run test
npm run build
npm run dev
```

`npm run generate` tạo các file HTML nhiều trang, RSS và sitemap. Các file HTML trong đường dẫn `index.html`, `kien-thuc/`, `my-pham/`, `tu-van-da/` và `ve-phung-ha/` là output build, không chỉnh sửa trực tiếp.

## Thêm một bài chăm da mỗi ngày

1. Tạo file Markdown tại `content/articles/ten-bai-khong-dau.md` (slug chỉ dùng chữ thường, số và dấu gạch ngang).
2. Thêm front matter có các trường bắt buộc `title`, `description`, `date` (YYYY-MM-DD), `category`. Có thể thêm `updated` (ngày cập nhật), `readingTime`, `accent` (`sage`, `pink`, `gold`, `olive`, `cream`), `cover: /assets/articles/ten-anh.webp` và `coverAlt` mô tả ảnh. Ảnh cover tự xuất hiện trên thẻ bài và trang bài viết.
3. Viết nội dung với heading Markdown `##`, `###`, danh sách `-`, `1.`, liên kết `[nguồn](https://...)`, liên kết nội bộ `[/my-pham/.../](/my-pham/)`, bảng Markdown và ảnh `![Mô tả ảnh](/assets/articles/ten-anh.webp)`.
   Tất cả ảnh bài viết phải được lưu dưới `public/assets/`, có quyền sử dụng hợp lệ và mô tả alt hữu ích; không nhúng ảnh lấy từ URL bên ngoài.
4. Kiểm tra nguồn, thông tin sức khỏe, quyền sử dụng hình ảnh và tính chính xác trước khi đăng.
5. Commit/push lên `main`; Cloudflare Builds tự tạo /kien-thuc/ten-bai-khong-dau/, cập nhật trang cẩm nang, nội dung mới ở trang chủ, sitemap.xml và feed.xml.

Ví dụ:

```md
---
title: Cách chọn kem chống nắng phù hợp
description: Lưu ý cơ bản về chống nắng.
date: 2026-11-05
category: Nám & chống nắng
readingTime: 4 phút đọc
accent: sage
---

## Vì sao cần chống nắng?

Nội dung bài viết...
```

Không dùng Markdown chưa kiểm duyệt của người dùng vì bộ chuyển đổi được tối ưu cho nội dung do biên tập viên kiểm soát, không phải một CMS mở.

## Mô hình kinh doanh

- Nhóm mỹ phẩm hiển thị là **danh mục tư vấn**, không phải SKU/giá/tồn kho thực tế và không có thanh toán trên web.
- Nút CTA mở Messenger fanpage đã có, không lưu thông tin khách hàng vào cơ sở dữ liệu.
- Quiz trả kết quả gợi ý ban đầu ở trình duyệt, không phải chẩn đoán da hoặc hướng dẫn tự peel.
- Nên thay ảnh quảng cáo cũ bằng ảnh chân dung thật và ảnh sản phẩm sạch chữ, sau khi được phép sử dụng.

## Thiết kế icon & hình sản phẩm

Bộ icon SVG và hình minh họa 4 nhóm mỹ phẩm nằm trong `public/assets/icons/` và `public/assets/collections/`. Hình sản phẩm bán thực tế sẽ dùng ảnh WebP được xác minh và cấp quyền. Xem [hướng dẫn hình ảnh và CDN](docs/huong-dan-hinh-anh.md).

Email chăm sóc khách hàng trên website: **cskh@phunghakorea.com**. Địa chỉ nhận được Cloudflare Email Routing, gửi trả lời từ địa chỉ này cần cấu hình dịch vụ gửi phù hợp.

## SEO & kiểm tra

- Meta description, canonical, OpenGraph, Organization/Article JSON-LD, sitemap và RSS tự sinh.
- Chuyên đề /kien-thuc/chu-de/ và phân trang sau 9 bài/chuyên đề, giúp đăng bài hằng ngày trong nhiều năm.
- Trang /chinh-sach/ giải thích quy trình dữ liệu quiz, Messenger và thông tin đặt hàng.
- Quiz có nút sao chép bản tóm tắt để gửi Messenger, không dựa vào query text chưa được hỗ trợ.
- Custom 404 page qua Workers Static Assets.
- Mỗi lần deploy phải kiểm tra /, /kien-thuc/, /my-pham/, /tu-van-da/, /ve-phung-ha/ và ít nhất một bài viết.

## Hai ảnh minh họa sản phẩm tạo bằng AI (2026-11-05)

- `public/assets/editorial/riena-sun-ampoule-ai-editorial.webp` — 720×900, 15 KB, ảnh minh họa cho nhóm chống nắng.
- `public/assets/editorial/korean-skincare-trio-ai-editorial.webp` — 720×900, 48 KB, ảnh minh họa nhóm dưỡng da.
- Đã tối ưu WebP chất lượng 85 cho mobile và đặt tại trang `/my-pham/`. Cloudflare Workers Static Assets phân phối trực tiếp từ `dist/assets/editorial/`.
- **Lưu ý tính xác thực:** ảnh AI chưa được đối chiếu chính xác với nhãn/bao bì sản phẩm thật, không được dùng như ảnh sản phẩm/SKU có sẵn hoặc mô tả chính thức. Trang có nhãn minh họa AI rõ ràng.
