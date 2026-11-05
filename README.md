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
2. Thêm front matter có các trường bắt buộc `title`, `description`, `date` (YYYY-MM-DD), `category`. Có thể thêm `readingTime`, `accent` (`sage`, `pink`, `gold`, `olive`, `cream`).
3. Viết nội dung với heading Markdown `##`, `###`, danh sách `-`, `1.` và liên kết `[nguồn](https://...)`.
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

## SEO & kiểm tra

- Meta description, canonical, OpenGraph, Organization/Article JSON-LD, sitemap và RSS tự sinh.
- Chuyên đề /kien-thuc/chu-de/ và phân trang sau 9 bài/chuyên đề, giúp đăng bài hằng ngày trong nhiều năm.
- Trang /chinh-sach/ giải thích quy trình dữ liệu quiz, Messenger và thông tin đặt hàng.
- Quiz có nút sao chép bản tóm tắt để gửi Messenger, không dựa vào query text chưa được hỗ trợ.
- Custom 404 page qua Workers Static Assets.
- Mỗi lần deploy phải kiểm tra /, /kien-thuc/, /my-pham/, /tu-van-da/, /ve-phung-ha/ và ít nhất một bài viết.
