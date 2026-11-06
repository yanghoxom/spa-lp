import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "https://phunghakorea.com";
const MESSAGE = "https://m.me/PhungHa29";
const FANPAGE = "https://www.facebook.com/PhungHa29";
const articlesDir = path.join(ROOT, "content", "articles");

function escapeHTML(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function write(relative, content) {
  const target = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}
function readArticles() {
  const entries = fs.readdirSync(articlesDir).filter((f) => f.endsWith(".md"));
  return entries.map((filename) => {
    const raw = fs.readFileSync(path.join(articlesDir, filename), "utf8").replace(/\r\n/g, "\n");
    const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) throw new Error("Missing front matter: " + filename);
    const data = {};
    for (const line of match[1].split("\n")) {
      const pos = line.indexOf(":");
      if (pos > 0) data[line.slice(0, pos).trim()] = line.slice(pos + 1).trim().replace(/^["']|["']$/g, "");
    }
    const slug = filename.replace(/\.md$/, "");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid slug: " + slug);
    for (const required of ["title", "description", "date", "category"]) {
      if (!data[required]) throw new Error(filename + " missing " + required);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error("Invalid date: " + filename);
    if (data.cover && !safeImagePath(data.cover)) throw new Error("Invalid cover image path: " + filename);
    if (data.updated && !/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) throw new Error("Invalid updated date: " + filename);
    return { ...data, slug, body: raw.slice(match[0].length).trim(), url: "/kien-thuc/" + slug + "/", readingTime: data.readingTime || "4 phút đọc", accent: data.accent || "sage" };
  }).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "vi"));
}
const articles = readArticles();

const categories = [
  { slug: "chong-nang", no: "01", title: "Chống nắng", subtitle: "Giữ gìn làn da mỗi ngày", detail: "Chị cùng Hà chọn kem chống nắng dễ dùng mỗi ngày, hợp da và thoải mái khi thoa. Ưu tiên loại bảo vệ da trước cả tia UVA, UVB, có SPF từ 30.", look: "sun", tips: ["Chị tìm nhãn bảo vệ cả UVA, UVB và SPF từ 30 nhé.", "Chọn chất kem dễ chịu trên da để chị muốn dùng mỗi ngày.", "Khi ra ngoài, chị nhớ che chắn và thoa lại kem chống nắng."] },
  { slug: "duong-am-phuc-hoi", no: "02", title: "Dưỡng ẩm & phục hồi", subtitle: "Nâng niu làn da mềm mịn", detail: "Da khô căng hay dễ khó chịu cần được chăm nhẹ nhàng. Hà cùng chị chọn sản phẩm dưỡng ẩm, giúp da mềm mại và hỗ trợ lớp bảo vệ tự nhiên của da.", look: "cream", tips: ["Chọn chất kem phù hợp với da và thời tiết nơi chị sống.", "Ưu tiên thành phần giúp giữ ẩm và làm mềm da.", "Nếu da đang đỏ rát, chị nên giảm bớt các bước và hỏi bác sĩ da liễu."] },
  { slug: "duong-sang-deu-mau", no: "03", title: "Dưỡng sáng & đều màu", subtitle: "Chăm chút nét rạng rỡ", detail: "Chị muốn da bớt xỉn, trông tươi tắn hơn? Hà cùng chị tìm cách dưỡng sáng dịu nhẹ, kết hợp dưỡng ẩm và chống nắng đều đặn.", look: "serum", tips: ["Duy trì chống nắng mỗi ngày trước khi thêm sản phẩm dưỡng sáng.", "Thử từng món một để biết da chị có hợp không.", "Nếu nám rõ hoặc kéo dài, chị nên gặp bác sĩ da liễu để được tư vấn."] },
  { slug: "cham-da-tuoi-35", no: "04", title: "Chăm da tuổi 35+", subtitle: "Giữ nét đẹp, thêm tự tin", detail: "Ở tuổi 35 trở đi, làn da cũng cần được chăm chút theo cách riêng. Hà cùng chị chọn các bước dễ làm mỗi ngày, chú trọng độ ẩm và cảm giác dễ chịu trên da.", look: "bottle", tips: ["Bắt đầu với làm sạch nhẹ nhàng, dưỡng ẩm và chống nắng.", "Chọn điều chị muốn cải thiện nhất để chăm kỹ từng bước.", "Chọn món hợp da và mức chi chị thấy thoải mái."] }
];

function navLink(href, label, active) {
  return '<a href="' + href + '"' + (active ? ' aria-current="page"' : '') + '>' + escapeHTML(label) + '</a>';
}
function header(active = "") {
  return '<div class="topline"><span>PHÙNG HÀ KOREA • MỸ PHẨM HÀN CHỌN LỌC</span><span>NÂNG NIU LÀN DA • TÔN NÉT ĐẸP RIÊNG</span></div>' +
    '<header class="site-header" id="top"><div class="header-content">' +
    '<a class="wordmark" href="/" aria-label="Phùng Hà Korea - Trang chủ"><strong>PHÙNG HÀ</strong><small>KOREA</small></a>' +
    '<button class="menu-toggle" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="Mở danh mục">☰ <span>Danh mục</span></button>' +
    '<nav class="main-nav" id="main-nav" aria-label="Danh mục chính">' +
    navLink("/", "Trang chủ", active === "home") + navLink("/kien-thuc/", "Góc chăm da", active === "articles") +
    navLink("/my-pham/", "Mỹ phẩm Hàn", active === "shop") + navLink("/ve-phung-ha/", "Chuyện của Hà", active === "about") +
    '<a class="mobile-consult" href="/tu-van-da/">Nhờ Hà tư vấn</a></nav>' +
    '<a class="nav-consult" href="/tu-van-da/">Nhờ Hà tư vấn <span aria-hidden="true">↗</span></a>' +
    '</div></header>';
}
function footer() {
  return '<footer class="site-footer"><div class="footer-top container">' +
    '<div><div class="footer-mark">PHÙNG HÀ <span>KOREA</span></div>' +
    '<p>Chị xứng đáng được nâng niu. Cùng Hà chọn mỹ phẩm Hàn, chăm chút làn da và nét đẹp riêng của chị mỗi ngày.</p>' +
    '<a class="footer-social" href="' + FANPAGE + '" target="_blank" rel="noopener noreferrer">Gặp Hà trên Facebook ↗</a></div>' +
    '<div><span class="footer-head">CHĂM DA CÙNG HÀ</span><a href="/kien-thuc/">Góc chăm da</a><a href="/my-pham/">Chọn mỹ phẩm Hàn</a><a href="/tu-van-da/">Nhờ Hà tư vấn</a></div>' +
    '<div><span class="footer-head">KẾT NỐI VỚI HÀ</span><a href="/ve-phung-ha/">Chuyện của Hà</a>' +
    '<a href="' + MESSAGE + '" target="_blank" rel="noopener noreferrer">Nhắn riêng cho Hà ↗</a>' +
    '<a href="mailto:cskh@phunghakorea.com">cskh@phunghakorea.com</a><a href="tel:+84353950220">035 395 0220</a>' +
    '<a href="/chinh-sach/">Thông tin riêng tư &amp; đặt hàng</a></div></div>' +
    '<div class="footer-bottom container"><span>© ' + new Date().getFullYear() + ' Phùng Hà Korea. Tiên Du, Bắc Ninh.</span>' +
    '<span>Nội dung chăm da để chị tham khảo, không thay thế tư vấn của bác sĩ.</span></div></footer>';
}
function layout({ title, description, url = "/", active = "", image = "/assets/fanpage-service-2.jpg", type = "website", date = "", quiz = false }, body) {
  const canonical = BASE + url;
  const safeTitle = escapeHTML(title);
  const organizationSchema = JSON.stringify({
    "@context":"https://schema.org", "@type":"Organization",
    "name":"Phùng Hà Korea", "url":BASE,
    "logo":BASE+"/assets/brand/phungha-icon-512-v1.webp", "sameAs":[FANPAGE],
    "contactPoint":{"@type":"ContactPoint","contactType":"customer support",
      "telephone":"+84353950220","email":"cskh@phunghakorea.com","availableLanguage":"Vietnamese"}
  }).replace(/</g,"\\u003c");
  const meta = '<!doctype html><html lang="vi"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta name="theme-color" content="#263E32"><meta name="robots" content="index,follow">' +
    '<link rel="icon" type="image/x-icon" href="/favicon.ico?v=2">' +
    '<link rel="icon" type="image/webp" sizes="32x32" href="/assets/brand/phungha-icon-32-v1.webp">' +
    '<link rel="icon" type="image/webp" sizes="48x48" href="/assets/brand/phungha-icon-48-v1.webp">' +
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">' +
    '<link rel="manifest" href="/site.webmanifest">' +
    '<title>' + safeTitle + '</title><meta name="description" content="' + escapeHTML(description) + '">' +
    '<link rel="canonical" href="' + escapeHTML(canonical) + '">' +
    '<link rel="alternate" type="application/rss+xml" title="Góc chăm da cùng Hà" href="/feed.xml">' +
    '<meta property="og:locale" content="vi_VN"><meta property="og:site_name" content="Phùng Hà Korea">' +
    '<meta property="og:type" content="' + type + '"><meta property="og:title" content="' + safeTitle + '">' +
    '<meta property="og:description" content="' + escapeHTML(description) + '">' +
    '<meta property="og:url" content="' + escapeHTML(canonical) + '">' +
    '<meta property="og:image" content="' + escapeHTML(BASE + image) + '">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    (date ? '<meta property="article:published_time" content="' + escapeHTML(date) + '">' : '') +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    '<script type="module" src="/src/site.ts"></script>' +
    (quiz ? '<script type="module" src="/src/main.ts"></script>' : '') +
    '<script type="application/ld+json">' + organizationSchema + '</script></head>';
  return meta + '<body><a href="#main-content" class="skip-link">Đến nội dung chính</a>' +
    header(active) + '<main id="main-content">' + body + '</main>' + footer() + '</body></html>';
}
function sectionLabel(n, text) { return '<div class="section-label"><span>' + n + '</span><span>' + text + '</span></div>'; }
function arrowLink(href, label, type = "") {
  return '<a class="arrow-link ' + type + '" href="' + href + '">' + escapeHTML(label) + '<span aria-hidden="true">↗</span></a>';
}
function articleCard(a, index = 0) {
  const art = a.cover
    ? '<img class="article-art-image" src="' + escapeHTML(a.cover) +
      '" alt="' + escapeHTML(a.coverAlt || a.title) + '" loading="lazy" decoding="async">'
    : '<div class="art-sculpture"><span></span><span></span></div>';
  return '<a class="article-card" href="' + a.url + '"><div class="article-art art-' + escapeHTML(a.accent) + '">' +
    art + '<span class="art-issue">GÓC CHĂM DA CÙNG HÀ</span><span class="art-index">BÀI VIẾT / ' +
    String(index + 1).padStart(2, "0") + '</span></div>' +
    '<div class="article-meta"><span>' + escapeHTML(a.category) + '</span><span>' + formatDate(a.date) + '</span></div>' +
    '<h3>' + escapeHTML(a.title) + '</h3><p>' + escapeHTML(a.description) + '</p>' +
    '<span class="article-cta">Đọc tiếp cùng Hà <span aria-hidden="true">↗</span></span></a>';
}
const editorialArt = {
  sun: ["chong-nang", "Lọ chống nắng trong không gian chăm da"],
  cream: ["duong-am-phuc-hoi", "Hũ kem dưỡng ẩm và phục hồi"],
  serum: ["duong-sang-deu-mau", "Lọ tinh chất dưỡng sáng"],
  bottle: ["cham-da-tuoi-35", "Chai dưỡng da cho tuổi 35+"]
};
function productVisual(kind) {
  const [name, alt] = editorialArt[kind] || editorialArt.cream;
  return '<div class="product-visual product-' + kind + '">' +
    '<img class="product-editorial-art" src="/assets/collections/' + name + '.svg" alt="' + alt + '" width="640" height="760" loading="lazy" decoding="async">' +
    '</div>';
}
function categoryCard(c) {
  return '<a class="collection-card" href="/my-pham/' + c.slug + '/">' + productVisual(c.look) +
    '<div class="collection-text"><span>' + c.no + ' / CHỌN CÙNG HÀ</span><h3>' + escapeHTML(c.title) +
    '</h3><p>' + escapeHTML(c.subtitle) + '</p><span class="round-arrow">↗</span></div></a>';
}
function formatDate(s) {
  const [y,m,d] = s.split("-");
  return d + "." + m + "." + y;
}
function home() {
  const featured = articles.slice(0, 3).map(articleCard).join("");
  const collections = categories.map(categoryCard).join("");
  return layout({ title: "Phùng Hà Korea | Mỹ phẩm Hàn, nâng niu làn da chị", description: "Chị xứng đáng được nâng niu. Cùng Phùng Hà chọn mỹ phẩm Hàn hợp da, tìm cách chăm da dễ làm mỗi ngày và nhận tư vấn riêng trước khi mua." , active: "home" },
    '<section class="immersive-hero" aria-labelledby="hero-title">' +
    '<picture class="hero-backdrop"><source media="(max-width: 600px)" srcset="/assets/editorial/hero-v4-mobile-640.webp 640w, /assets/editorial/hero-v4-mobile-960.webp 960w" sizes="100vw">' +
    '<img src="/assets/editorial/hero-v4-desktop-1600.webp" srcset="/assets/editorial/hero-v4-desktop-1000.webp 1000w, /assets/editorial/hero-v4-desktop-1600.webp 1600w, /assets/editorial/hero-v4-desktop-2400.webp 2400w" sizes="100vw" alt="Phùng Hà cùng tinh chất nhỏ giọt, Anti Rosin Ampoule và kem dưỡng Hàn Quốc" width="1600" height="900" fetchpriority="high" decoding="async"></picture>' +
    '<div class="hero-atmosphere" aria-hidden="true"></div>' +
    '<div class="container immersive-inner"><div class="immersive-copy"><p class="eyebrow">PHÙNG HÀ KOREA</p>' +
    '<h1 id="hero-title">Chị xứng đáng<br><em>được nâng niu.</em></h1>' +
    '<p class="immersive-lead">Mỹ phẩm Hàn, chọn kỹ<br class="mobile-break"> cho làn da của chị.</p>' +
    '<div class="immersive-actions"><a class="btn btn-dark" href="/my-pham/">Chọn mỹ phẩm <span aria-hidden="true">↗</span></a>' +
    '<a class="hero-consult" href="/tu-van-da/">Nhờ Hà tư vấn <span aria-hidden="true">↗</span></a></div>' +
    '</div></div><a class="hero-scroll" href="#discover" aria-label="Chọn điều chị muốn chăm sóc cho da">CHĂM DA CÙNG HÀ <span aria-hidden="true">↓</span></a></section>' +
    '<div class="marquee-line"><div class="container"><span>NÂNG NIU LÀN DA</span><span>✳</span><span>TỰ TIN VỚI NÉT ĐẸP RIÊNG</span><span>✳</span><span>MỸ PHẨM HÀN CHỌN LỌC</span><span>✳</span><span>CHĂM CHÚT CHO CHÍNH MÌNH</span></div></div>' +
    '<section class="section container" id="discover">' + sectionLabel("01 /", "HÀ LẮNG NGHE CHỊ") +
    '<div class="section-heading split-heading"><div><p class="overline">CHỌN ĐIỀU CHỊ QUAN TÂM</p><h2>Chị muốn làn da <em>được chăm thế nào?</em></h2></div>' +
    '<p>Chị muốn da mềm hơn, đều màu hơn hay tươi tắn hơn mỗi ngày? Chọn điều chị đang quan tâm, Hà cùng chị tìm cách chăm phù hợp nhé.</p></div>' +
    '<div class="concern-grid">' +
    '<a href="/my-pham/duong-sang-deu-mau/"><span>01</span><img class="concern-icon" src="/assets/icons/nam-sam.svg" alt="" width="56" height="56" loading="lazy"><strong>Nám &amp; sạm màu</strong><small>Dưỡng sáng, chăm da đều màu</small><i>↗</i></a>' +
    '<a href="/my-pham/duong-am-phuc-hoi/"><span>02</span><img class="concern-icon" src="/assets/icons/duong-am.svg" alt="" width="56" height="56" loading="lazy"><strong>Da khô, nhạy cảm</strong><small>Dưỡng ẩm, chăm da dịu nhẹ</small><i>↗</i></a>' +
    '<a href="/my-pham/cham-da-tuoi-35/"><span>03</span><img class="concern-icon" src="/assets/icons/tuoi-35.svg" alt="" width="56" height="56" loading="lazy"><strong>Da tuổi 35+</strong><small>Chăm chút nét đẹp của chị</small><i>↗</i></a>' +
    '<a href="/my-pham/chong-nang/"><span>04</span><img class="concern-icon" src="/assets/icons/chong-nang.svg" alt="" width="56" height="56" loading="lazy"><strong>Chống nắng</strong><small>Giữ gìn da mỗi khi ra ngoài</small><i>↗</i></a></div></section>' +
    '<section class="section journal-section"><div class="container">' + sectionLabel("02 /", "GÓC CHĂM DA") +
    '<div class="section-heading journal-heading"><div><p class="overline">CHUYỆN CHĂM DA MỖI NGÀY</p><h2>Hà chia sẻ, <em>chị dễ làm theo.</em></h2></div>' +
    arrowLink("/kien-thuc/", "Xem tất cả bài viết") + '</div>' +
    '<div class="article-grid">' + featured + '</div></div></section>' +
    '<section class="section container" id="shop">' + sectionLabel("03 /", "MỸ PHẨM HÀN CHỌN LỌC") +
    '<div class="section-heading split-heading"><div><p class="overline">CHỌN KỸ CHO LÀN DA CHỊ</p><h2>Mỹ phẩm Hàn, <em>chọn riêng cùng chị.</em></h2></div>' +
    '<p>Mỗi món mỹ phẩm nên là một lựa chọn xứng đáng. Chị xem nhóm mình thích, Hà sẽ tư vấn món hợp da và báo giá rõ ràng trước khi chị đặt.</p></div>' +
    '<div class="collections-grid">' + collections + '</div><div class="shop-bottom">' +
    '<p>Chị chưa biết chọn món nào? Trả lời 5 câu ngắn để Hà hiểu da chị hơn nhé.</p>' +
    arrowLink("/tu-van-da/", "Để Hà hiểu da chị") + '</div></section>' +
    '<section class="founder-band"><div class="container founder-grid"><div class="founder-type"><span class="vertical-title">ĐÔI LỜI TỪ HÀ</span>' +
    '<p class="overline">LỜI NHẮN TỪ PHÙNG HÀ</p><h2>Chăm chút cho mình, <em>chị nhé.</em></h2>' +
    '<p>Giữa bao việc mỗi ngày, chị cũng xứng đáng có một khoảng riêng để làm đẹp. Hà muốn nghe chị chia sẻ, cùng chị chọn từng món hợp da, để việc chăm mình trở thành một niềm vui.</p>' +
    arrowLink("/ve-phung-ha/", "Nghe Hà kể chuyện", "light") + '</div><div class="founder-art" aria-hidden="true">' +
    '<div class="founder-photo"><img src="/assets/fanpage-service-2.jpg" alt="" loading="lazy" decoding="async"></div><span class="founder-curve"></span><span class="founder-art-title">PHÙNG HÀ</span><span class="founder-art-sub">MỸ PHẨM HÀN • CHĂM DA MỖI NGÀY</span><span class="founder-leaf">✳</span></div></div></section>' +
    '<section class="section container final-cta"><p class="overline">HÀ Ở ĐÂY, LẮNG NGHE CHỊ</p>' +
    '<h2>Chị muốn chăm da đẹp hơn? <em>Mình trò chuyện nhé.</em></h2>' +
    '<div class="final-actions"><a class="btn btn-dark" href="/tu-van-da/">Nhờ Hà tư vấn <span>↗</span></a>' +
    '<a class="btn btn-outline" href="' + MESSAGE + '" target="_blank" rel="noopener noreferrer">Nhắn riêng cho Hà <span>↗</span></a></div></section>');
}
const PAGE_SIZE = 9;
function topicList() {
  return [...new Set(articles.map(a => a.category))].map(name => ({ name, slug: slugify(name) }));
}
function archiveURL(page = 1, topicSlug = "") {
  const base = topicSlug ? "/kien-thuc/chu-de/" + topicSlug + "/" : "/kien-thuc/";
  return page === 1 ? base : base + "trang/" + page + "/";
}
function archiveCount(topicSlug = "") {
  const list = topicSlug ? articles.filter(a => slugify(a.category) === topicSlug) : articles;
  return Math.max(1, Math.ceil(list.length / PAGE_SIZE));
}
function articleIndex(page = 1, topicSlug = "") {
  const topic = topicList().find(t => t.slug === topicSlug);
  if (topicSlug && !topic) throw new Error("Unknown topic: " + topicSlug);
  const list = topic ? articles.filter(a => a.category === topic.name) : articles;
  const pages = archiveCount(topicSlug);
  if (page < 1 || page > pages) throw new Error("Invalid archive page: " + page);
  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pills = [{ name: "Tất cả bài viết", slug: "" }, ...topicList()].map(item =>
    '<a class="filter-button' + (item.slug === topicSlug ? ' is-active' : '') +
    '" href="' + archiveURL(1,item.slug) + '"' + (item.slug===topicSlug?' aria-current="page"':'') + '>' + escapeHTML(item.name) + '</a>'
  ).join("");
  const pagination = pages < 2 ? "" : '<nav class="pagination" aria-label="Các trang bài viết">' +
    (page > 1 ? '<a rel="prev" href="' + archiveURL(page - 1, topicSlug) + '">← Trang trước</a>' : '') +
    Array.from({length:pages},(_,i)=>'<a href="' + archiveURL(i+1,topicSlug) + '"' + (i+1===page?' aria-current="page"':'') + '>'+(i+1)+'</a>').join("") +
    (page < pages ? '<a rel="next" href="' + archiveURL(page+1,topicSlug) + '">Trang sau →</a>' : '') + '</nav>';
  const displayTitle = topic ? "Chăm da: " + topic.name : "Góc chăm da cùng Hà";
  return layout({ title: displayTitle + (page>1?" – Trang "+page:"") + " | Phùng Hà Korea",
    description: topic ? "Cùng Hà tìm hiểu về " + topic.name.toLowerCase() + " qua những bài chia sẻ dễ hiểu, giúp chị chăm da mỗi ngày." :
    "Hà chia sẻ cách chăm da dễ hiểu, dễ làm theo: chống nắng, dưỡng ẩm, nám sạm và chọn mỹ phẩm Hàn hợp với làn da chị.",
    url:archiveURL(page,topicSlug), active:"articles" },
    '<section class="page-hero container"><p class="eyebrow">GÓC CHĂM DA / PHÙNG HÀ KOREA</p>' +
    '<h1>' + (topic ? 'Chuyện chăm da: <em>' + escapeHTML(topic.name) + '</em>' : 'Chăm da mỗi ngày, <em>cùng Hà nhé.</em>') + '</h1>' +
    '<p>Những điều chị hay băn khoăn khi chăm da, Hà chia sẻ ở đây. Chị chọn chủ đề mình quan tâm để đọc và tìm cách chăm phù hợp nhé.</p></section>' +
    '<section class="container section compact"><div class="filter-row"><nav class="filter-tabs" aria-label="Chọn chủ đề chăm da">' +
    pills + '</nav><span class="result-counter">Trang ' + page + '/' + pages + ' · ' + list.length + ' bài</span></div>' +
    '<div class="article-grid article-list-grid" id="article-list">' +
    shown.map((a,i)=>'<div>'+articleCard(a,(page-1)*PAGE_SIZE+i)+'</div>').join("") + '</div>' + pagination + '</section>');
}
function safeImagePath(value) {
  return typeof value === "string" &&
    /^\/assets\/[a-zA-Z0-9/_\-.]+\.(?:png|jpe?g|webp|avif)$/i.test(value);
}
function inline(text) {
  return escapeHTML(text).replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/(?!\/))[^ )]+)\)/g, (_, label, href) => {
    const external = /^https?:\/\//.test(href);
    return '<a href="' + href + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
      '>' + label + (external ? ' ↗' : '') + '</a>';
  }).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}
function slugify(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("đ","d").replaceAll("Đ","D")
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function renderMarkdown(src) {
  const output = [];
  const toc = [];
  const lines = [...src.split("\n"), ""];
  let paragraph = [], list = [], ordered = false;
  function flushParagraph() {
    if(paragraph.length){output.push("<p>" + inline(paragraph.join(" ")) + "</p>");paragraph=[];}
  }
  function flushList() {
    if(list.length){const tag=ordered?"ol":"ul";output.push("<"+tag+">"+list.map(x=>"<li>"+inline(x)+"</li>").join("")+"</"+tag+">");list=[];}
  }
  const cells = row => row.slice(1,-1).split("|").map(c=>c.trim());
  for(let i=0;i<lines.length;i++) {
    const s = lines[i].trim();
    if(!s){flushParagraph();flushList();continue;}
    const heading = s.match(/^(#{2,3})\s+(.+)$/);
    if(heading){
      flushParagraph();flushList();
      const level=heading[1].length,name=heading[2],id=slugify(name);
      if(level===2)toc.push({label:name,id});
      output.push("<h"+level+" id='"+id+"'>"+inline(name)+"</h"+level+">");
      continue;
    }
    const image = s.match(/^!\[([^\]]*)\]\((\/assets\/[^ )]+)\)$/);
    if(image && safeImagePath(image[2])) {
      flushParagraph();flushList();
      output.push('<figure class="article-figure"><img src="' + escapeHTML(image[2]) +
        '" alt="' + escapeHTML(image[1]) + '" loading="lazy" decoding="async">' +
        (image[1] ? '<figcaption>' + escapeHTML(image[1]) + '</figcaption>' : '') + '</figure>');
      continue;
    }
    const next = (lines[i+1] || "").trim();
    if(s.startsWith("|") && s.endsWith("|") && next.startsWith("|") && next.endsWith("|")) {
      const heads=cells(s), markers=cells(next);
      if(heads.length === markers.length && markers.every(c=>/^:?-{3,}:?$/.test(c))) {
        flushParagraph();flushList();
        const header='<thead><tr>'+heads.map(h=>'<th scope="col">'+inline(h)+'</th>').join("")+'</tr></thead>';
        const rows=[];
        for(let j=i+2;j<lines.length;j++){
          const row=lines[j].trim();
          if(!row.startsWith("|") || !row.endsWith("|") || cells(row).length!==heads.length)break;
          rows.push('<tr>'+cells(row).map(c=>'<td>'+inline(c)+'</td>').join("")+'</tr>');
        }
        output.push('<div class="table-scroll" role="region" tabindex="0" aria-label="Bảng thông tin"><table>'+
          header+'<tbody>'+rows.join("")+'</tbody></table></div>');
        i+=rows.length+1;
        continue;
      }
    }
    const item = s.match(/^([-*]|\d+\.)\s+(.+)$/);
    if(item){
      flushParagraph();
      const nextOrdered=/\d+\./.test(item[1]);
      if(list.length&&ordered!==nextOrdered)flushList();
      ordered=nextOrdered;list.push(item[2]);continue;
    }
    if(s.startsWith("> ")){
      flushParagraph();flushList();output.push("<blockquote>"+inline(s.slice(2))+"</blockquote>");continue;
    }
    flushList();paragraph.push(s);
  }
  return { html: output.join("\n"), toc };
}
function articlePage(a) {
  const article = renderMarkdown(a.body);
  const toc = article.toc.length ? '<div class="toc"><p>NỘI DUNG BÀI VIẾT</p>' + article.toc.map(x => '<a href="#'+x.id+'">'+escapeHTML(x.label)+'</a>').join("")+'</div>' : "";
  const articleJson = JSON.stringify({ "@context":"https://schema.org", "@type":"Article", headline:a.title, description:a.description, datePublished:a.date, dateModified:a.updated || a.date, image:BASE+(a.cover || "/assets/fanpage-service-2.jpg"), inLanguage:"vi", mainEntityOfPage:BASE+a.url, author:{"@type":"Organization",name:"Phùng Hà Korea"}, publisher:{"@type":"Organization",name:"Phùng Hà Korea"} }).replace(/</g,"\\u003c");
  return layout({ title: a.title + " | Phùng Hà Korea", description:a.description, url:a.url, type:"article", date:a.date, active:"articles" },
    '<div class="article-cover art-'+escapeHTML(a.accent)+'"><div class="article-cover-inner container"><a class="breadcrumb" href="/kien-thuc/">← Về góc chăm da</a>' +
    '<p class="eyebrow">'+escapeHTML(a.category)+' / GÓC CHĂM DA</p><h1>'+escapeHTML(a.title)+'</h1>' +
    '<p class="article-intro">'+escapeHTML(a.description)+'</p><div class="article-cover-meta"><span>'+formatDate(a.date)+'</span><span>'+escapeHTML(a.readingTime)+'</span><span>Phùng Hà Korea biên tập</span></div></div>' +
    '<div class="cover-art-decoration" aria-hidden="true"><i></i><i></i></div></div>' +
    '<div class="container article-layout"><article class="article-body">'+
    (a.cover ? '<figure class="article-figure article-lead-image"><img src="' + escapeHTML(a.cover) + '" alt="' + escapeHTML(a.coverAlt || a.title) + '" loading="lazy" decoding="async"></figure>' : '') +
    article.html+
    '<div class="article-disclaimer"><strong>Lưu ý</strong><p>Thông tin mang tính tham khảo, không thay thế chẩn đoán hay điều trị. Nếu da đang viêm, tổn thương, kích ứng kéo dài hoặc bạn cân nhắc peel, hãy trao đổi với bác sĩ da liễu.</p></div>' +
    '<div class="article-next"><p class="overline">CHĂM DA CÙNG HÀ</p><h2>Chị muốn Hà tư vấn riêng?</h2>' +
    '<p>Chị kể Hà nghe về làn da và những món đang dùng nhé. Hà sẽ cùng chị chọn cách chăm phù hợp.</p>' +
    '<a class="btn btn-dark" href="/tu-van-da/">Nhờ Hà tư vấn <span>↗</span></a></div></article>' +
    '<aside class="article-sidebar">'+toc+'<div class="sidebar-card"><p class="overline">LỜI NHẮN TỪ HÀ</p>' +
    '<h3>Một chút chăm da, một niềm vui cho chị.</h3><a href="/my-pham/">Chọn mỹ phẩm cùng Hà ↗</a></div></aside></div>' +
    '<section class="section container related-section">'+sectionLabel("ĐỌC THÊM /", "CÓ THỂ CHỊ QUAN TÂM")+
    '<div class="article-grid">'+articles.filter(x=>x.slug!==a.slug).sort((x,y)=>Number(y.category===a.category)-Number(x.category===a.category)).slice(0,3).map(articleCard).join("")+'</div></section>' +
    '<script type="application/ld+json">'+articleJson+'</script>');
}
function shopIndex() {
  return layout({ title:"Chọn mỹ phẩm Hàn cùng Hà | Phùng Hà Korea", description:"Chị cùng Hà chọn mỹ phẩm Hàn hợp da: chống nắng, dưỡng ẩm, dưỡng sáng và chăm da tuổi 35+. Hà tư vấn và báo giá rõ ràng trước khi chị đặt.", url:"/my-pham/", active:"shop" },
    '<section class="page-hero container"><p class="eyebrow">MỸ PHẨM HÀN CHỌN LỌC / PHÙNG HÀ KOREA</p>' +
    '<h1>Chọn món hợp da, <em>yêu chiều chính mình.</em></h1><p>Một món mỹ phẩm đáng mua là món hợp với làn da và khiến chị muốn chăm mình mỗi ngày. Chị xem nhóm mình quan tâm, Hà sẽ cùng chị chọn món phù hợp nhé.</p></section>' +
    '<section class="section compact container">'+sectionLabel("01 /","CHỊ MUỐN CHĂM DA THẾ NÀO?")+'<div class="collections-grid shop-grid">'+categories.map(categoryCard).join("")+'</div>' +
    '<div class="notice-panel"><strong>Hà tư vấn và báo giá trước khi chị đặt.</strong><span>Chị xem các nhóm chăm da ở đây, rồi nhắn Hà để hỏi sản phẩm, giá và hàng còn sẵn. Chị đặt hàng trực tiếp với Hà qua Messenger nhé.</span></div></section>' +
    '<section class="section container ai-editorial-section" aria-labelledby="ai-gallery-title">' + sectionLabel("02 /","GÓC HÌNH ẢNH MỸ PHẨM") +
    '<div class="ai-gallery-heading"><div><p class="overline">DÀNH MỘT CHÚT CHO MÌNH</p><h2 id="ai-gallery-title">Để mỗi lần chăm da <em>là một niềm vui.</em></h2></div>' +
    '<p>Từ lớp chống nắng nhẹ nhàng đến chút kem dưỡng mềm mại, chị chọn điều làn da mình đang cần nhé.</p></div>' +
    '<div class="ai-editorial-grid">' +
    '<figure class="ai-editorial-card"><div class="ai-editorial-photo"><img src="/assets/editorial/riena-sun-ampoule-ai-editorial.webp" alt="Chai và hộp RIENA Sun Ampoule trong không gian chăm da" width="720" height="900" loading="lazy" decoding="async"></div>' +
    '<figcaption><div><span>01 / GIỮ GÌN LÀN DA</span><h3>Ra ngoài, nhớ thương làn da.</h3><p>Chị cùng Hà tìm loại chống nắng hợp da, dễ thoa và thoải mái khi dùng mỗi ngày.</p></div><a href="/my-pham/chong-nang/" class="arrow-link">Chọn kem chống nắng <span aria-hidden="true">↗</span></a></figcaption></figure>' +
    '<figure class="ai-editorial-card"><div class="ai-editorial-photo"><img src="/assets/editorial/korean-skincare-trio-ai-editorial.webp" alt="Bộ mỹ phẩm Hàn trong không gian chăm da" width="720" height="900" loading="lazy" decoding="async"></div>' +
    '<figcaption><div><span>02 / NÂNG NIU MỖI NGÀY</span><h3>Dưỡng ẩm để da mềm mại.</h3><p>Dành cho da một chút chăm sóc dịu dàng. Hà cùng chị chọn món dưỡng ẩm phù hợp nhé.</p></div><a href="/my-pham/duong-am-phuc-hoi/" class="arrow-link">Chọn dưỡng ẩm <span aria-hidden="true">↗</span></a></figcaption></figure>' +
    '</div></section>' +
    '<section class="section container simple-steps">'+sectionLabel("03 /","HÀ CÙNG CHỊ CHỌN KỸ")+'<h2>Ưng món hợp da, <em>rồi mình đặt nhé.</em></h2><div class="steps-grid">' +
    '<div><span>01</span><h3>Chị chia sẻ</h3><p>Cho Hà biết làn da và điều chị muốn chăm chút nhất.</p></div>' +
    '<div><span>02</span><h3>Hà lắng nghe</h3><p>Mình trao đổi thêm về những món chị đang dùng và mức chi chị thấy thoải mái.</p></div>' +
    '<div><span>03</span><h3>Mình cùng chọn</h3><p>Hà gợi ý sản phẩm, nói rõ giá và cách dùng để chị cân nhắc trước khi đặt.</p></div></div>' +
    '<div class="center-action"><a href="/tu-van-da/" class="btn btn-dark">Nhờ Hà tư vấn <span>↗</span></a></div></section>');
}
function shopDetail(c) {
  return layout({ title:c.title+" – chọn cùng Hà | Phùng Hà Korea", description:c.detail+" Nhắn Hà để được tư vấn và báo giá.", url:"/my-pham/"+c.slug+"/", active:"shop" },
    '<div class="container detail-layout"><div class="detail-art">'+productVisual(c.look)+'</div>' +
    '<div class="detail-copy"><a href="/my-pham/" class="breadcrumb dark">← Xem các nhóm mỹ phẩm</a>' +
    '<p class="overline">MỸ PHẨM HÀN CHỌN LỌC / '+c.no+'</p><h1>'+escapeHTML(c.title)+'</h1><p class="detail-lead">'+escapeHTML(c.detail)+'</p>' +
    '<div class="detail-tips"><h2>Hà nhắn chị vài điều</h2><ul>'+c.tips.map(t=>'<li>'+escapeHTML(t)+'</li>').join("")+'</ul></div>' +
    '<div class="notice-panel"><strong>Chị thích nhóm này? Nhắn Hà nhé.</strong><span>Đây là gợi ý nhóm chăm da để chị tham khảo. Hà sẽ gửi thông tin sản phẩm còn sẵn, nguồn gốc, giá và cách dùng trước khi chị quyết định.</span></div>' +
    '<a href="'+MESSAGE+'" class="btn btn-dark" target="_blank" rel="noopener noreferrer">Hỏi Hà về sản phẩm <span>↗</span></a></div></div>' +
    '<section class="section container related-section">'+sectionLabel("ĐỌC THÊM /","CHĂM DA CÙNG HÀ")+'<div class="article-grid">'+articles.slice(0,3).map(articleCard).join("")+'</div></section>');
}
function aboutPage() {
  return layout({title:"Chuyện của Hà | Phùng Hà Korea",description:"Hà lắng nghe, cùng chị chọn mỹ phẩm Hàn hợp da và chia sẻ cách chăm da dễ làm mỗi ngày. Chăm chút cho làn da, trân trọng nét đẹp riêng của chị.",url:"/ve-phung-ha/",active:"about"},
    '<section class="about-hero container"><div class="about-copy"><p class="eyebrow">HÀ CHIA SẺ / PHÙNG HÀ KOREA</p>' +
    '<h1>Nét đẹp của chị, <em>Hà trân trọng.</em></h1>' +
    '<p>Hà tin mỗi người phụ nữ đều có nét đẹp riêng. Hà mong chị thấy vui khi chăm mình, tự tin khi gặp gỡ và hài lòng với món mỹ phẩm đã chọn.</p>' +
    '<p>Ở Phùng Hà Korea, Hà cùng chị tìm mỹ phẩm Hàn phù hợp, từ những món chị đang dùng đến điều chị muốn cải thiện. Mình trao đổi rõ về sản phẩm, cách dùng và mức chi trước khi chọn mua.</p>' +
    '<p>Chị cũng sẽ tìm thấy ở đây những chia sẻ chăm da dễ hiểu, dễ làm theo. Khi da cần điều trị hoặc chị muốn peel (thay da hóa học), chị nên hỏi bác sĩ da liễu trước nhé.</p>' +
    '<a href="'+FANPAGE+'" class="btn btn-dark" target="_blank" rel="noopener noreferrer">Gặp Hà trên Facebook <span>↗</span></a></div>' +
    '<div class="about-image"><div class="about-photo"><img src="/assets/fanpage-product.jpg" alt="Hình ảnh giới thiệu từ fanpage Phùng Hà Korea" loading="lazy"></div>' +
    '<span>NGHE CHỊ CHIA SẺ, CÙNG CHỊ CHỌN KỸ</span></div></section>' +
    '<section class="values-section"><div class="container">'+sectionLabel("VỀ HÀ /","CÁCH HÀ CHĂM CHÚT CHO CHỊ")+'<div class="values-grid">' +
    '<div><span>01 /</span><h3>Lắng nghe chị trước</h3><p>Hà hỏi về làn da, mong muốn và những món chị đang dùng để cùng chị chọn cho phù hợp.</p></div>' +
    '<div><span>02 /</span><h3>Dễ dùng mỗi ngày</h3><p>Cách chăm da cần dễ hiểu, dễ làm, để dù bận rộn chị vẫn có thể chăm chút cho mình.</p></div>' +
    '<div><span>03 /</span><h3>Rõ sản phẩm, rõ giá</h3><p>Chị được biết nguồn gốc, thông tin sản phẩm và giá trước khi quyết định đặt mua.</p></div></div></div></section>' +
    '<section class="section container final-cta"><p class="overline">TRÒ CHUYỆN CÙNG HÀ</p><h2>Chị còn phân vân? <em>Cứ kể Hà nghe.</em></h2><a class="btn btn-dark" href="/tu-van-da/">Nhờ Hà tư vấn <span>↗</span></a></section>');
}
function quizPage() {
  return layout({title:"Tư vấn chăm da cùng Hà | Phùng Hà Korea",description:"Chị trả lời 5 câu ngắn để nhận gợi ý chăm da ban đầu, rồi nhắn Hà qua Messenger. Hà sẽ cùng chị chọn sản phẩm hợp da và mức chi chị mong muốn.",url:"/tu-van-da/",quiz:true},
    '<section class="page-hero container quiz-hero"><p class="eyebrow">5 CÂU NGẮN / ĐỂ HÀ HIỂU CHỊ HƠN</p>' +
    '<h1>Chị kể Hà nghe <em>về làn da nhé.</em></h1><p>Chị chọn câu trả lời gần với mình nhất nhé. Website sẽ gợi ý cách chăm da ban đầu; sau đó chị có thể gửi kết quả qua Messenger để Hà tư vấn thêm.</p></section>' +
    '<section class="container quiz-area"><div class="quiz-grid"><form id="quiz-form" class="quiz-card">' +
    '<div class="quiz-top"><span>CHIA SẺ CÙNG HÀ</span><span>5 CÂU HỎI</span></div><div class="progress-line"><span id="progress-fill"></span></div>' +
    '<p class="question-progress" id="question-progress" aria-live="polite">Câu 1/5</p><div class="selected-summary" id="selected-summary" aria-live="polite"></div>' +
    '<div id="question-list"></div><div class="quiz-actions">' +
    '<button type="button" class="btn btn-outline" id="quiz-prev" disabled>← Quay lại</button>' +
    '<button type="button" class="btn btn-dark" id="quiz-next" disabled>Câu tiếp →</button>' +
    '<button type="button" class="reset-button" id="reset-quiz">Chọn lại từ đầu</button></div></form>' +
    '<aside class="result-card is-hidden" id="result-card" tabindex="-1" aria-live="polite"><p class="overline">GỢI Ý BAN ĐẦU CHO CHỊ</p>' +
    '<h2 id="result-title">Cách chăm da để chị tham khảo</h2><p class="result-summary" id="result-note">Hà sẽ trao đổi thêm với chị trước khi chọn sản phẩm.</p>' +
    '<div class="result-badges"><span id="result-code" class="result-code">PK-0000</span><div class="fit-badge"><span>Bước tiếp theo</span><strong id="result-fit">—</strong></div></div>' +
    '<div class="result-columns"><div><h3>Vì sao có gợi ý này?</h3><ul id="result-reasons"></ul></div>' +
    '<div><h3>Gợi ý chăm da sáng và tối</h3><p><strong>Buổi sáng:</strong> <span id="care-morning">—</span></p><p><strong>Buổi tối:</strong> <span id="care-evening">—</span></p></div>' +
    '<div><h3>Chị chia sẻ thêm giúp Hà nhé</h3><ul id="result-followups"></ul></div></div>' +
    '<div class="lead-actions"><button type="button" id="copy-consultation" class="btn btn-outline">① Sao chép kết quả</button>' +
    '<a id="messenger-link" class="btn btn-dark" href="'+MESSAGE+'" target="_blank" rel="noopener noreferrer">② Mở Messenger ↗</a></div>' +
    '<p class="copy-feedback" id="copy-feedback" role="status" aria-live="polite">Chị sao chép kết quả, mở Messenger rồi dán vào tin nhắn gửi Hà nhé. Website không lưu câu trả lời của chị.</p>' +
    '<p class="quiz-disclaimer">Gợi ý này chỉ để tham khảo, không thay thế chẩn đoán của bác sĩ. Nếu da đang kích ứng hoặc chị muốn peel (thay da hóa học), hãy hỏi bác sĩ da liễu trước nhé.</p></aside></div></section>' +
    '<section class="section container quiz-info"><div><p class="overline">CHỌN KỸ, ĐỂ CHỊ YÊN TÂM</p><h2>Chị thấy phù hợp, <em>mình hãy chọn.</em></h2></div>' +
    '<div><p>Hà muốn hiểu da và mong muốn của chị trước khi gợi ý mỹ phẩm. Mình cùng xem những món chị đang dùng, cách chăm mỗi ngày và mức chi chị thấy thoải mái nhé.</p>' +
    '<a class="arrow-link" href="/kien-thuc/">Ghé góc chăm da <span>↗</span></a></div></section>');
}
function privacyPage() {
  return layout({title:"Thông tin riêng tư và đặt hàng | Phùng Hà Korea",
    description:"Những điều chị cần biết về câu trả lời tư vấn da, cách liên hệ qua Messenger và thông tin cần xác nhận trước khi đặt mỹ phẩm tại Phùng Hà Korea.",
    url:"/chinh-sach/" },
    '<section class="page-hero container"><p class="eyebrow">THÔNG TIN ĐỂ CHỊ YÊN TÂM</p>' +
    '<h1>Thông tin riêng tư <em>&amp; cách đặt hàng.</em></h1>' +
    '<p>Hà nói rõ cách website dùng thông tin và những điều chị cần biết trước khi đặt mỹ phẩm nhé.</p></section>' +
    '<section class="container policy-content"><h2>Câu trả lời tư vấn da của chị</h2>' +
    '<p>Gợi ý chăm da được tạo ngay trên trình duyệt chị đang dùng. Website không lưu câu trả lời vào cơ sở dữ liệu riêng. Chỉ khi chị tự sao chép và gửi qua Messenger, Hà mới nhận được phần thông tin chị gửi. Nội dung gửi qua Messenger được xử lý theo chính sách của Meta.</p>' +
    '<h2>Khi chị truy cập website</h2><p>Website dùng Cloudflare để tải trang và bảo vệ truy cập. Dịch vụ này có thể xử lý một số dữ liệu kỹ thuật cần thiết để website hoạt động. Trang cũng dùng Google Fonts để hiển thị chữ; khi tải chữ, trình duyệt của chị có thể kết nối với máy chủ Google.</p>' +
    '<h2>Trước khi chị đặt mỹ phẩm</h2><p>Các nhóm mỹ phẩm ở đây giúp chị tham khảo cách chọn, chưa phải danh sách hàng còn sẵn hay giá bán đã xác nhận. Trước khi đặt, chị nhắn Hà để hỏi rõ tên sản phẩm, xuất xứ, nhãn, hạn dùng, giá, cách giao hàng và điều kiện đổi trả nhé.</p>' +
    '<h2>Về những chia sẻ chăm da</h2><p>Bài viết và gợi ý tự động chỉ để chị tham khảo, không thay thế chẩn đoán hay điều trị của bác sĩ, cũng không phải hướng dẫn tự peel (thay da hóa học). Nếu da có vấn đề kéo dài hoặc cần làm thủ thuật, chị nên gặp bác sĩ da liễu.</p>' +
    '<h2>Chị cần hỏi thêm?</h2><p>Để hỏi về website hoặc thông tin chị đã gửi cho Phùng Hà Korea, chị liên hệ <a href="mailto:cskh@phunghakorea.com">cskh@phunghakorea.com</a> hoặc nhắn <a href="' + FANPAGE + '" target="_blank" rel="noopener noreferrer">Facebook Phùng Hà Korea</a> nhé.</p></section>');
}
function rssXML() {
  const items = articles.slice(0,30).map(a=>'<item><title>'+escapeHTML(a.title)+'</title><link>'+BASE+a.url+'</link>'+
    '<guid>'+BASE+a.url+'</guid><description>'+escapeHTML(a.description)+'</description><pubDate>'+new Date(a.date+'T09:00:00+07:00').toUTCString()+'</pubDate></item>').join("");
  return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Phùng Hà Korea - Góc chăm da</title><link>'+BASE+'/kien-thuc/</link><description>Cùng Hà tìm cách chăm da và chọn mỹ phẩm Hàn hợp với chị</description><language>vi</language>'+items+'</channel></rss>';
}
function sitemap() {
  const all = ["/", "/kien-thuc/", "/my-pham/", "/tu-van-da/", "/ve-phung-ha/", "/chinh-sach/",
    ...Array.from({length:archiveCount()-1},(_,i)=>archiveURL(i+2)),
    ...topicList().flatMap(t=>Array.from({length:archiveCount(t.slug)},(_,i)=>archiveURL(i+1,t.slug))),
    ...categories.map(c=>"/my-pham/"+c.slug+"/"), ...articles.map(a=>a.url)];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    all.map(u=>'  <url><loc>'+BASE+u+'</loc></url>').join("\n") + '\n</urlset>\n';
}

write("index.html",home());
write("kien-thuc/index.html",articleIndex());
for(let page=2;page<=archiveCount();page++) write("kien-thuc/trang/"+page+"/index.html",articleIndex(page));
for(const topic of topicList()) {
  write("kien-thuc/chu-de/"+topic.slug+"/index.html",articleIndex(1,topic.slug));
  for(let page=2;page<=archiveCount(topic.slug);page++) write("kien-thuc/chu-de/"+topic.slug+"/trang/"+page+"/index.html",articleIndex(page,topic.slug));
}
for(const a of articles) write("kien-thuc/"+a.slug+"/index.html",articlePage(a));
write("my-pham/index.html",shopIndex());
for(const c of categories) write("my-pham/"+c.slug+"/index.html",shopDetail(c));
write("tu-van-da/index.html",quizPage());
write("ve-phung-ha/index.html",aboutPage());
write("chinh-sach/index.html",privacyPage());
write("public/sitemap.xml",sitemap());
write("public/feed.xml",rssXML());
write("public/404.html",'<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Chưa tìm thấy trang chị cần | Phùng Hà Korea</title><style>body{font-family:Arial,sans-serif;background:#f9f6ef;color:#263d34;min-height:80vh;display:grid;place-items:center;text-align:center}h1{font-size:5rem;margin:0}a{color:inherit}</style><main><p>PHÙNG HÀ KOREA</p><h1>404</h1><p>Trang chị tìm hiện chưa có hoặc đã chuyển chỗ.</p><p>Chị về trang chủ để xem thêm nhé.</p><a href="/">← Về trang chủ</a></main></html>');
console.log("Generated Korean Editorial pages, article archives, sitemap and RSS feed.");

export { renderMarkdown };
