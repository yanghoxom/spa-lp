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
    return { ...data, slug, body: raw.slice(match[0].length).trim(), url: "/kien-thuc/" + slug + "/", readingTime: data.readingTime || "4 phút đọc", accent: data.accent || "sage" };
  }).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "vi"));
}
const articles = readArticles();

const categories = [
  { slug: "chong-nang", no: "01", title: "Chống nắng", subtitle: "Bảo vệ da mỗi ngày", detail: "Ưu tiên phổ rộng, SPF từ 30 và cảm giác sử dụng phù hợp với làn da.", look: "sun", tips: ["Tìm nhãn phổ rộng UVA/UVB và SPF từ 30.", "Ưu tiên kết cấu bạn muốn dùng đều đặn.", "Kết hợp che chắn và bôi lại khi ở ngoài trời."] },
  { slug: "duong-am-phuc-hoi", no: "02", title: "Dưỡng ẩm & phục hồi", subtitle: "Êm dịu, đủ ẩm", detail: "Lựa chọn kem dưỡng và các bước hỗ trợ hàng rào bảo vệ da, không cố dùng thật nhiều sản phẩm.", look: "cream", tips: ["Cân nhắc kết cấu theo loại da và thời tiết.", "Chú ý các thành phần dưỡng ẩm, làm mềm.", "Da đang đỏ rát nên tối giản và hỏi ý kiến chuyên môn."] },
  { slug: "duong-sang-deu-mau", no: "03", title: "Dưỡng sáng & đều màu", subtitle: "Từng bước, không vội", detail: "Tìm hiểu cách kết hợp chăm sóc dịu nhẹ, dưỡng sáng và chống nắng cho làn da xỉn hoặc sạm.", look: "serum", tips: ["Duy trì chống nắng trước khi tăng sản phẩm dưỡng sáng.", "Thử từng sản phẩm một để theo dõi đáp ứng.", "Nám rõ hoặc kéo dài nên được bác sĩ da liễu đánh giá."] },
  { slug: "cham-da-tuoi-35", no: "04", title: "Chăm da tuổi 35+", subtitle: "Dưỡng da trưởng thành", detail: "Routine nền tảng cho làn da cần sự thoải mái, độ ẩm và chăm sóc lâu dài.", look: "bottle", tips: ["Bắt đầu bằng làm sạch dịu nhẹ, dưỡng ẩm, chống nắng.", "Xác định một vấn đề ưu tiên thay vì thêm nhiều hoạt chất.", "Chọn sản phẩm phù hợp nhu cầu và ngân sách thực tế."] }
];

function navLink(href, label, active) {
  return '<a href="' + href + '"' + (active ? ' aria-current="page"' : '') + '>' + escapeHTML(label) + '</a>';
}
function header(active = "") {
  return '<div class="topline"><span>KOREAN SKINCARE, WITH CARE.</span><span>CHĂM DA CÓ HIỂU BIẾT • ĐẸP THEO CÁCH CỦA BẠN</span></div>' +
    '<header class="site-header" id="top"><div class="header-content">' +
    '<a class="wordmark" href="/" aria-label="Phùng Hà Korea - Trang chủ"><strong>PHÙNG HÀ</strong><small>KOREA</small></a>' +
    '<button class="menu-toggle" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="Mở menu">☰ <span>MENU</span></button>' +
    '<nav class="main-nav" id="main-nav" aria-label="Điều hướng chính">' +
    navLink("/", "Trang chủ", active === "home") + navLink("/kien-thuc/", "Cẩm nang chăm da", active === "articles") +
    navLink("/my-pham/", "Mỹ phẩm Hàn", active === "shop") + navLink("/ve-phung-ha/", "Về Phùng Hà", active === "about") +
    '<a class="mobile-consult" href="/tu-van-da/">Tư vấn da 1:1</a></nav>' +
    '<a class="nav-consult" href="/tu-van-da/">Tư vấn cùng Hà <span aria-hidden="true">↗</span></a>' +
    '</div></header>';
}
function footer() {
  return '<footer class="site-footer"><div class="footer-top container">' +
    '<div><div class="footer-mark">PHÙNG HÀ <span>KOREA</span></div>' +
    '<p>Chăm da có hiểu biết. Chọn mỹ phẩm Hàn phù hợp. Đồng hành cùng làn da Việt.</p>' +
    '<a class="footer-social" href="' + FANPAGE + '" target="_blank" rel="noopener noreferrer">Facebook Phùng Hà Korea ↗</a></div>' +
    '<div><span class="footer-head">KHÁM PHÁ</span><a href="/kien-thuc/">Cẩm nang chăm da</a><a href="/my-pham/">Chọn mỹ phẩm</a><a href="/tu-van-da/">Tư vấn da 1:1</a></div>' +
    '<div><span class="footer-head">PHÙNG HÀ KOREA</span><a href="/ve-phung-ha/">Câu chuyện của Hà</a>' +
    '<a href="' + FANPAGE + '" target="_blank" rel="noopener noreferrer">Fanpage chính thức ↗</a>' +
    '<a href="mailto:Phungthuha1997@gmail.com">Phungthuha1997@gmail.com</a><a href="tel:+84353950220">035 395 0220</a>' +
    '<a href="/chinh-sach/">Quyền riêng tư &amp; lưu ý mua hàng</a></div></div>' +
    '<div class="footer-bottom container"><span>© ' + new Date().getFullYear() + ' Phùng Hà Korea. Tiên Du, Bắc Ninh.</span>' +
    '<span>Kiến thức trên website chỉ mang tính tham khảo, không thay thế tư vấn y tế.</span></div></footer>';
}
function layout({ title, description, url = "/", active = "", image = "/assets/fanpage-product.jpg", type = "website", date = "", quiz = false }, body) {
  const canonical = BASE + url;
  const safeTitle = escapeHTML(title);
  const organizationSchema = JSON.stringify({
    "@context":"https://schema.org", "@type":"Organization",
    "name":"Phùng Hà Korea", "url":BASE,
    "logo":BASE+"/favicon.svg", "sameAs":[FANPAGE],
    "contactPoint":{"@type":"ContactPoint","contactType":"customer support",
      "telephone":"+84353950220","email":"Phungthuha1997@gmail.com","availableLanguage":"Vietnamese"}
  }).replace(/</g,"\\u003c");
  const meta = '<!doctype html><html lang="vi"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta name="theme-color" content="#F9F6EF"><meta name="robots" content="index,follow"><link rel="icon" type="image/svg+xml" href="/favicon.svg">' +
    '<title>' + safeTitle + '</title><meta name="description" content="' + escapeHTML(description) + '">' +
    '<link rel="canonical" href="' + escapeHTML(canonical) + '">' +
    '<link rel="alternate" type="application/rss+xml" title="Bài viết Phùng Hà Korea" href="/feed.xml">' +
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
  return meta + '<body><a href="#main-content" class="skip-link">Chuyển đến nội dung</a>' +
    header(active) + '<main id="main-content">' + body + '</main>' + footer() + '</body></html>';
}
function sectionLabel(n, text) { return '<div class="section-label"><span>' + n + '</span><span>' + text + '</span></div>'; }
function arrowLink(href, label, type = "") {
  return '<a class="arrow-link ' + type + '" href="' + href + '">' + escapeHTML(label) + '<span aria-hidden="true">↗</span></a>';
}
function articleCard(a, index = 0) {
  return '<a class="article-card" href="' + a.url + '"><div class="article-art art-' + escapeHTML(a.accent) + '">' +
    '<div class="art-sculpture"><span></span><span></span></div><span class="art-issue">PHÙNG HÀ KOREA / BEAUTY NOTES</span><span class="art-index">JOURNAL / ' + String(index + 1).padStart(2, "0") + '</span></div>' +
    '<div class="article-meta"><span>' + escapeHTML(a.category) + '</span><span>' + formatDate(a.date) + '</span></div>' +
    '<h3>' + escapeHTML(a.title) + '</h3><p>' + escapeHTML(a.description) + '</p>' +
    '<span class="article-cta">Đọc bài viết <span aria-hidden="true">↗</span></span></a>';
}
function productVisual(kind) {
  return '<div class="product-visual product-' + kind + '" aria-hidden="true"><span class="visual-note">KOREAN BEAUTY / EDIT</span><div class="product-orbit"></div>' +
    '<div class="bottle"><div class="bottle-cap"></div><div class="bottle-body"><span>MINH HỌA</span><strong>K-BEAUTY</strong><small>SKIN EDIT</small></div></div>' +
    '<div class="product-glow"></div></div>';
}
function categoryCard(c) {
  return '<a class="collection-card" href="/my-pham/' + c.slug + '/">' + productVisual(c.look) +
    '<div class="collection-text"><span>' + c.no + ' / BEAUTY EDIT</span><h3>' + escapeHTML(c.title) +
    '</h3><p>' + escapeHTML(c.subtitle) + '</p><span class="round-arrow">↗</span></div></a>';
}
function formatDate(s) {
  const [y,m,d] = s.split("-");
  return d + "." + m + "." + y;
}
function home() {
  const featured = articles.slice(0, 3).map(articleCard).join("");
  const collections = categories.map(categoryCard).join("");
  return layout({ title: "Phùng Hà Korea | Chăm da tinh tế & mỹ phẩm Hàn Quốc", description: "Không gian chăm da cùng Phùng Hà: kiến thức dành cho làn da Việt 30–50, routine dễ áp dụng, mỹ phẩm Hàn được tư vấn theo nhu cầu." , active: "home" }, 
    '<section class="hero container"><div class="hero-copy">' +
    '<p class="eyebrow"><span class="eyebrow-line"></span> PHÙNG HÀ KOREA • SKIN JOURNAL</p>' +
    '<h1>Đẹp là khi <em>hiểu</em> làn da của mình.</h1>' +
    '<p class="hero-lead">Không cần một kệ mỹ phẩm thật đầy. Hà giúp bạn hiểu nhu cầu làn da, chọn các bước chăm sóc dễ duy trì và tìm hiểu mỹ phẩm Hàn Quốc phù hợp trước khi mua.</p>' +
    '<div class="hero-actions"><a class="btn btn-dark" href="/my-pham/">Khám phá mỹ phẩm Hàn <span>↗</span></a>' +
    '<a class="btn btn-plain" href="/tu-van-da/">Tư vấn da riêng <span>↗</span></a></div>' +
    '<div class="hero-note"><span>01 / HIỂU DA</span><span>02 / CHỌN ĐÚNG</span><span>03 / CHĂM ĐỀU</span></div></div>' +
    '<div class="hero-portrait"><div class="portrait-frame"><img src="/assets/fanpage-product.jpg" alt="Hình ảnh giới thiệu mỹ phẩm từ fanpage Phùng Hà Korea" fetchpriority="high"></div>' +
    '<div class="portrait-caption"><span>RITUALS FOR<br>REAL SKIN.</span><span>PHÙNG HÀ<br>↘ KOREA</span></div>' +
    '<div class="portrait-seal">SKINCARE<br>WITH<br>CARE ✳</div></div></section>' +
    '<div class="marquee-line"><div class="container"><span>CHĂM DA CÓ HIỂU BIẾT</span><span>✳</span><span>BEAUTY IN EVERY AGE</span><span>✳</span><span>KOREAN SKINCARE</span><span>✳</span><span>ROUTINE ĐÚNG VỚI BẠN</span></div></div>' +
    '<section class="section container" id="discover">' + sectionLabel("01 /", "BẮT ĐẦU TỪ LÀN DA") +
    '<div class="section-heading split-heading"><div><p class="overline">YOUR SKIN, YOUR WAY</p><h2>Chọn chăm sóc <em>theo nhu cầu.</em></h2></div>' +
    '<p>Da tuổi 30, 40 hay 50 có những thay đổi khác nhau. Thay vì chạy theo mọi xu hướng, hãy bắt đầu từ điều bạn thật sự cần.</p></div>' +
    '<div class="concern-grid">' +
    '<a href="/my-pham/duong-sang-deu-mau/"><span>01</span><strong>Nám &amp; sạm màu</strong><small>Chăm sóc đều màu có kế hoạch</small><i>↗</i></a>' +
    '<a href="/my-pham/duong-am-phuc-hoi/"><span>02</span><strong>Da khô, nhạy cảm</strong><small>Ưu tiên sự êm dịu, đủ ẩm</small><i>↗</i></a>' +
    '<a href="/my-pham/cham-da-tuoi-35/"><span>03</span><strong>Da tuổi 35+</strong><small>Đẹp bền vững theo thời gian</small><i>↗</i></a>' +
    '<a href="/my-pham/chong-nang/"><span>04</span><strong>Chống nắng</strong><small>Thói quen nhỏ, giá trị lớn</small><i>↗</i></a></div></section>' +
    '<section class="section journal-section"><div class="container">' + sectionLabel("02 /", "THE SKIN JOURNAL") +
    '<div class="section-heading journal-heading"><div><p class="overline">LEARN WITH HÀ</p><h2>Góc kiến thức <em>chăm da.</em></h2></div>' +
    arrowLink("/kien-thuc/", "Xem tất cả bài viết") + '</div>' +
    '<div class="article-grid">' + featured + '</div></div></section>' +
    '<section class="section container" id="shop">' + sectionLabel("03 /", "KOREAN BEAUTY EDIT") +
    '<div class="section-heading split-heading"><div><p class="overline">CURATED FOR YOU</p><h2>Ít hơn, nhưng <em>phù hợp hơn.</em></h2></div>' +
    '<p>Khám phá các nhóm mỹ phẩm Hàn theo mục tiêu chăm da. Danh mục là gợi ý tư vấn, sản phẩm và giá cụ thể được xác nhận trực tiếp cùng Hà.</p></div>' +
    '<div class="collections-grid">' + collections + '</div><div class="shop-bottom">' +
    '<p>Không chắc loại da của mình? Hà sẽ giúp bạn bắt đầu từ những câu hỏi đơn giản.</p>' +
    arrowLink("/tu-van-da/", "Làm bài tư vấn da 5 câu") + '</div></section>' +
    '<section class="founder-band"><div class="container founder-grid"><div class="founder-type"><span class="vertical-title">A PERSONAL NOTE</span>' +
    '<p class="overline">LỜI NHẮN TỪ PHÙNG HÀ</p><h2>Chăm da không phải cuộc đua. <em>Đó là sự thấu hiểu.</em></h2>' +
    '<p>Tại Phùng Hà Korea, mỗi gợi ý bắt đầu từ loại da, mục tiêu và khả năng duy trì của bạn. Nội dung chia sẻ giúp bạn đặt câu hỏi đúng trước khi quyết định mua mỹ phẩm.</p>' +
    arrowLink("/ve-phung-ha/", "Tìm hiểu về Phùng Hà", "light") + '</div><div class="founder-art" aria-hidden="true">' +
    '<div class="founder-photo"><img src="/assets/fanpage-service-2.jpg" alt="" loading="lazy" decoding="async"></div><span class="founder-curve"></span><span class="founder-art-title">PHÙNG HÀ</span><span class="founder-art-sub">KOREAN BEAUTY • EVERYDAY CARE</span><span class="founder-leaf">✳</span></div></div></section>' +
    '<section class="section container final-cta"><p class="overline">LET\'S TALK ABOUT YOUR SKIN</p>' +
    '<h2>Mỗi làn da có một câu chuyện. <em>Hà muốn nghe câu chuyện của bạn.</em></h2>' +
    '<div class="final-actions"><a class="btn btn-dark" href="/tu-van-da/">Bắt đầu tư vấn 1:1 <span>↗</span></a>' +
    '<a class="btn btn-outline" href="' + MESSAGE + '" target="_blank" rel="noopener noreferrer">Nhắn Messenger <span>↗</span></a></div></section>');
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
    (page > 1 ? '<a rel="prev" href="' + archiveURL(page - 1, topicSlug) + '">← Trước</a>' : '') +
    Array.from({length:pages},(_,i)=>'<a href="' + archiveURL(i+1,topicSlug) + '"' + (i+1===page?' aria-current="page"':'') + '>'+(i+1)+'</a>').join("") +
    (page < pages ? '<a rel="next" href="' + archiveURL(page+1,topicSlug) + '">Sau →</a>' : '') + '</nav>';
  const displayTitle = topic ? "Chuyên đề: " + topic.name : "Cẩm nang chăm da";
  return layout({ title: displayTitle + (page>1?" – Trang "+page:"") + " | Phùng Hà Korea",
    description: topic ? "Bài viết Phùng Hà Korea về " + topic.name.toLowerCase() + ", kiến thức chăm da có nguồn, dễ áp dụng." :
    "Bài viết chăm da cho người Việt 30–50: chống nắng, nám sạm, phục hồi sau peel, routine mỹ phẩm Hàn và chăm da theo tuổi.",
    url:archiveURL(page,topicSlug), active:"articles" },
    '<section class="page-hero container"><p class="eyebrow">THE SKIN JOURNAL / PHÙNG HÀ KOREA</p>' +
    '<h1>' + (topic ? 'Chuyện làn da: <em>' + escapeHTML(topic.name) + '</em>' : 'Cẩm nang chăm da <em>mỗi ngày.</em>') + '</h1>' +
    '<p>Những kiến thức vừa đủ để bạn hiểu da hơn, chọn sản phẩm có cơ sở và biết khi nào cần gặp bác sĩ da liễu.</p></section>' +
    '<section class="container section compact"><div class="filter-row"><nav class="filter-tabs" aria-label="Chuyên đề chăm da">' +
    pills + '</nav><span class="result-counter">Trang ' + page + '/' + pages + ' · ' + list.length + ' bài</span></div>' +
    '<div class="article-grid article-list-grid" id="article-list">' +
    shown.map((a,i)=>'<div>'+articleCard(a,(page-1)*PAGE_SIZE+i)+'</div>').join("") + '</div>' + pagination + '</section>');
}
function inline(text) {
  return escapeHTML(text).replace(/\[([^\]]+)\]\((https?:\/\/[^ )]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
}
function slugify(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("đ","d").replaceAll("Đ","D")
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function renderMarkdown(src) {
  const output = [];
  const toc = [];
  const lines = src.split("\n");
  let paragraph = [], list = [], ordered = false;
  function flushParagraph() { if(paragraph.length){output.push("<p>" + inline(paragraph.join(" ")) + "</p>");paragraph=[];} }
  function flushList() { if(list.length){const tag=ordered?"ol":"ul";output.push("<"+tag+">"+list.map(x=>"<li>"+inline(x)+"</li>").join("")+"</"+tag+">");list=[];} }
  for(const line of [...lines, ""]) {
    const s=line.trim();
    if(!s){flushParagraph();flushList();continue;}
    const header = s.match(/^(#{2,3})\s+(.+)$/);
    if(header){flushParagraph();flushList();const level=header[1].length, name=header[2],id=slugify(name);if(level===2)toc.push({label:name,id});output.push("<h"+level+" id='"+id+"'>"+inline(name)+"</h"+level+">");continue;}
    const match = s.match(/^([-*]|\d+\.)\s+(.+)$/);
    if(match){flushParagraph();const nextOrdered=/\d+\./.test(match[1]);if(list.length&&ordered!==nextOrdered)flushList();ordered=nextOrdered;list.push(match[2]);continue;}
    if(s.startsWith("> ")){flushParagraph();flushList();output.push("<blockquote>"+inline(s.slice(2))+"</blockquote>");continue;}
    flushList();paragraph.push(s);
  }
  return { html: output.join("\n"), toc };
}
function articlePage(a) {
  const article = renderMarkdown(a.body);
  const toc = article.toc.length ? '<div class="toc"><p>TRONG BÀI VIẾT</p>' + article.toc.map(x => '<a href="#'+x.id+'">'+escapeHTML(x.label)+'</a>').join("")+'</div>' : "";
  const articleJson = JSON.stringify({ "@context":"https://schema.org", "@type":"Article", headline:a.title, description:a.description, datePublished:a.date, dateModified:a.date, inLanguage:"vi", mainEntityOfPage:BASE+a.url, author:{"@type":"Organization",name:"Phùng Hà Korea"}, publisher:{"@type":"Organization",name:"Phùng Hà Korea"} }).replace(/</g,"\\u003c");
  return layout({ title: a.title + " | Phùng Hà Korea", description:a.description, url:a.url, type:"article", date:a.date, active:"articles" },
    '<div class="article-cover art-'+escapeHTML(a.accent)+'"><div class="article-cover-inner container"><a class="breadcrumb" href="/kien-thuc/">← Quay về Cẩm nang chăm da</a>' +
    '<p class="eyebrow">'+escapeHTML(a.category)+' / SKIN JOURNAL</p><h1>'+escapeHTML(a.title)+'</h1>' +
    '<p class="article-intro">'+escapeHTML(a.description)+'</p><div class="article-cover-meta"><span>'+formatDate(a.date)+'</span><span>'+escapeHTML(a.readingTime)+'</span><span>Phùng Hà Korea biên tập</span></div></div>' +
    '<div class="cover-art-decoration" aria-hidden="true"><i></i><i></i></div></div>' +
    '<div class="container article-layout"><article class="article-body">'+article.html+
    '<div class="article-disclaimer"><strong>Lưu ý</strong><p>Thông tin mang tính tham khảo, không thay thế chẩn đoán hay điều trị. Nếu da đang viêm, tổn thương, kích ứng kéo dài hoặc bạn cân nhắc peel, hãy trao đổi với bác sĩ da liễu.</p></div>' +
    '<div class="article-next"><p class="overline">CHĂM DA CÙNG HÀ</p><h2>Muốn chọn routine phù hợp hơn?</h2>' +
    '<p>Hà có thể hỏi thêm về làn da, các sản phẩm bạn đang dùng và ngân sách trước khi gợi ý.</p>' +
    '<a class="btn btn-dark" href="/tu-van-da/">Bắt đầu tư vấn <span>↗</span></a></div></article>' +
    '<aside class="article-sidebar">'+toc+'<div class="sidebar-card"><p class="overline">BEAUTY NOTE</p>' +
    '<h3>Chăm da là hành trình, không phải cuộc đua.</h3><a href="/my-pham/">Khám phá mỹ phẩm phù hợp ↗</a></div></aside></div>' +
    '<section class="section container related-section">'+sectionLabel("READ /", "ĐỌC THÊM")+
    '<div class="article-grid">'+articles.filter(x=>x.slug!==a.slug).sort((x,y)=>Number(y.category===a.category)-Number(x.category===a.category)).slice(0,3).map(articleCard).join("")+'</div></section>' +
    '<script type="application/ld+json">'+articleJson+'</script>');
}
function shopIndex() {
  return layout({ title:"Mỹ phẩm Hàn theo nhu cầu | Phùng Hà Korea", description:"Khám phá nhóm mỹ phẩm Hàn cho da trưởng thành: chống nắng, dưỡng ẩm phục hồi, dưỡng sáng và chăm sóc da tuổi 35+. Tư vấn trực tiếp trước khi mua.", url:"/my-pham/", active:"shop" },
    '<section class="page-hero container"><p class="eyebrow">THE K-BEAUTY EDIT / PHÙNG HÀ KOREA</p>' +
    '<h1>Mỹ phẩm Hàn, <em>chọn theo làn da.</em></h1><p>Không nhất thiết phải theo routine 10 bước. Chọn những gì da cần, phù hợp với ngân sách và cách sống của bạn.</p></section>' +
    '<section class="section compact container">'+sectionLabel("01 /","BỘ SƯU TẬP THEO NHU CẦU")+'<div class="collections-grid shop-grid">'+categories.map(categoryCard).join("")+'</div>' +
    '<div class="notice-panel"><strong>Danh mục tư vấn, không phải giỏ hàng trực tuyến.</strong><span>Giá, thương hiệu, hạn sử dụng và tình trạng hàng được Hà xác nhận qua Messenger trước khi bạn đặt.</span></div></section>' +
    '<section class="section container simple-steps">'+sectionLabel("02 /","CÁCH HÀ HỖ TRỢ")+'<h2>Chọn đúng trước khi <em>đặt mua.</em></h2><div class="steps-grid">' +
    '<div><span>01</span><h3>Hiểu da</h3><p>Chọn vấn đề và mục tiêu bạn đang quan tâm.</p></div>' +
    '<div><span>02</span><h3>Trao đổi</h3><p>Kiểm tra sản phẩm đang dùng, độ nhạy cảm và ngân sách.</p></div>' +
    '<div><span>03</span><h3>Gợi ý</h3><p>Nhận thông tin sản phẩm thực tế và hướng dẫn sử dụng phù hợp.</p></div></div>' +
    '<div class="center-action"><a href="/tu-van-da/" class="btn btn-dark">Làm bài tư vấn da <span>↗</span></a></div></section>');
}
function shopDetail(c) {
  return layout({ title:c.title+" – chọn mỹ phẩm Hàn | Phùng Hà Korea", description:c.detail+" Tư vấn 1:1 và xác nhận sản phẩm thực tế cùng Phùng Hà.", url:"/my-pham/"+c.slug+"/", active:"shop" },
    '<div class="container detail-layout"><div class="detail-art">'+productVisual(c.look)+'</div>' +
    '<div class="detail-copy"><a href="/my-pham/" class="breadcrumb dark">← Tất cả danh mục mỹ phẩm</a>' +
    '<p class="overline">KOREAN BEAUTY EDIT / '+c.no+'</p><h1>'+escapeHTML(c.title)+'</h1><p class="detail-lead">'+escapeHTML(c.detail)+'</p>' +
    '<div class="detail-tips"><h2>Khi chọn nhóm sản phẩm này</h2><ul>'+c.tips.map(t=>'<li>'+escapeHTML(t)+'</li>').join("")+'</ul></div>' +
    '<div class="notice-panel"><strong>Chọn sản phẩm thực tế cùng Hà</strong><span>Website chưa niêm yết SKU và giá theo tồn kho. Hà sẽ xác nhận tên sản phẩm, nguồn gốc, giá và cách dùng khi tư vấn.</span></div>' +
    '<a href="'+MESSAGE+'" class="btn btn-dark" target="_blank" rel="noopener noreferrer">Hỏi Hà về sản phẩm <span>↗</span></a></div></div>' +
    '<section class="section container related-section">'+sectionLabel("READ /","KIẾN THỨC LIÊN QUAN")+'<div class="article-grid">'+articles.slice(0,3).map(articleCard).join("")+'</div></section>');
}
function aboutPage() {
  return layout({title:"Về Phùng Hà Korea | Chăm da và mỹ phẩm Hàn",description:"Câu chuyện của Phùng Hà Korea: tư vấn chăm da có chọn lọc, chia sẻ kiến thức dễ hiểu và kết nối với mỹ phẩm Hàn phù hợp.",url:"/ve-phung-ha/",active:"about"},
    '<section class="about-hero container"><div class="about-copy"><p class="eyebrow">A NOTE FROM HÀ / PHÙNG HÀ KOREA</p>' +
    '<h1>Đẹp hơn mỗi ngày, <em>theo nhịp của chính mình.</em></h1>' +
    '<p>Phùng Hà Korea bắt đầu từ mong muốn giúp khách hàng Việt chọn mỹ phẩm Hàn Quốc phù hợp thay vì mua theo trào lưu.</p>' +
    '<p>Ở đây, Hà chia sẻ những kiến thức nền tảng về chăm sóc da, cách đọc thông tin sản phẩm và các câu hỏi cần làm rõ trước khi chọn routine.</p>' +
    '<p>Mỗi gợi ý cần cân nhắc loại da, tình trạng thực tế và ngân sách. Với vấn đề cần điều trị hoặc thủ thuật như peel, lời khuyên của bác sĩ da liễu vẫn là quan trọng.</p>' +
    '<a href="'+FANPAGE+'" class="btn btn-dark" target="_blank" rel="noopener noreferrer">Gặp Hà trên Facebook <span>↗</span></a></div>' +
    '<div class="about-image"><div class="about-photo"><img src="/assets/fanpage-product.jpg" alt="Hình ảnh giới thiệu từ fanpage Phùng Hà Korea" loading="lazy"></div>' +
    '<span>PERSONAL CARE. REAL CONVERSATIONS.</span></div></section>' +
    '<section class="values-section"><div class="container">'+sectionLabel("OUR /","NGUYÊN TẮC CHĂM DA")+'<div class="values-grid">' +
    '<div><span>01 /</span><h3>Thấu hiểu trước</h3><p>Trao đổi nhu cầu và các bước bạn đang dùng trước khi đề xuất sản phẩm.</p></div>' +
    '<div><span>02 /</span><h3>Đủ dùng, dễ duy trì</h3><p>Ưu tiên routine rõ ràng, thực tế và phù hợp nhịp sống mỗi ngày.</p></div>' +
    '<div><span>03 /</span><h3>Minh bạch khi chọn mua</h3><p>Xác nhận nguồn gốc, thông tin sản phẩm và chi phí trước khi đặt.</p></div></div></div></section>' +
    '<section class="section container final-cta"><p class="overline">TƯ VẤN 1:1</p><h2>Hãy kể Hà nghe về <em>làn da của bạn.</em></h2><a class="btn btn-dark" href="/tu-van-da/">Bắt đầu tư vấn <span>↗</span></a></section>');
}
function quizPage() {
  return layout({title:"Tư vấn da 1:1 cùng Phùng Hà | Phùng Hà Korea",description:"Trả lời 5 câu hỏi về loại da, tình trạng, mục tiêu và ngân sách để nhận định hướng chăm da tham khảo, rồi trò chuyện cùng Phùng Hà qua Messenger.",url:"/tu-van-da/",quiz:true},
    '<section class="page-hero container quiz-hero"><p class="eyebrow">YOUR SKIN, YOUR STORY / 5 QUESTIONS</p>' +
    '<h1>Hà muốn hiểu <em>làn da của bạn.</em></h1><p>Trả lời 5 câu ngắn để gợi ý hướng chăm da ban đầu. Kết quả chỉ mang tính tham khảo; Hà sẽ hỏi thêm trước khi giới thiệu sản phẩm.</p></section>' +
    '<section class="container quiz-area"><div class="quiz-grid"><form id="quiz-form" class="quiz-card">' +
    '<div class="quiz-top"><span>SKIN CONSULTATION</span><span>05 STEPS</span></div><div class="progress-line"><span id="progress-fill"></span></div>' +
    '<p class="question-progress" id="question-progress">Câu 1/5</p><div class="selected-summary" id="selected-summary" aria-live="polite"></div>' +
    '<div id="question-list"></div><div class="quiz-actions">' +
    '<button type="button" class="btn btn-outline" id="quiz-prev" disabled>← Quay lại</button>' +
    '<button type="button" class="btn btn-dark" id="quiz-next" disabled>Tiếp →</button>' +
    '<button type="button" class="reset-button" id="reset-quiz">Làm lại</button></div></form>' +
    '<aside class="result-card is-hidden" id="result-card" aria-live="polite"><p class="overline">HƯỚNG CHĂM DA THAM KHẢO</p>' +
    '<h2 id="result-title">Kết quả của bạn</h2><p class="result-summary" id="result-note">Hà sẽ trao đổi thêm với bạn trước khi chọn sản phẩm.</p>' +
    '<div class="result-badges"><span id="result-code" class="result-code">PK-0000</span><div class="fit-badge"><span>Gợi ý sơ bộ</span><strong id="result-fit">—</strong></div></div>' +
    '<div class="result-columns"><div><h3>Phù hợp vì</h3><ul id="result-reasons"></ul></div>' +
    '<div><h3>Routine tham khảo</h3><p><strong>Sáng:</strong> <span id="care-morning">—</span></p><p><strong>Tối:</strong> <span id="care-evening">—</span></p></div>' +
    '<div><h3>Hà cần hỏi thêm</h3><ul id="result-followups"></ul></div></div>' +
    '<div class="lead-actions"><button type="button" id="copy-consultation" class="btn btn-outline">① Sao chép kết quả tư vấn</button>' +
    '<a id="messenger-link" class="btn btn-dark" href="'+MESSAGE+'" target="_blank" rel="noopener noreferrer">② Mở Messenger ↗</a></div>' +
    '<p class="copy-feedback" id="copy-feedback" role="status" aria-live="polite">Sao chép kết quả rồi dán vào Messenger để Hà nắm thông tin. Website không lưu câu trả lời trên máy chủ.</p>' +
    '<p class="quiz-disclaimer">Không thay thế chẩn đoán y tế. Nếu da đang kích ứng hoặc bạn quan tâm peel, hãy hỏi ý kiến bác sĩ da liễu.</p></aside></div></section>' +
    '<section class="section container quiz-info"><div><p class="overline">KHÔNG ÁP LỰC MUA HÀNG</p><h2>Tư vấn để <em>hiểu da trước.</em></h2></div>' +
    '<div><p>Không nhất thiết phải dùng một bộ sản phẩm nhiều bước. Sau bài tư vấn, bạn có thể trao đổi thêm về sản phẩm đang dùng, mức độ nhạy cảm và ngân sách phù hợp.</p>' +
    '<a class="arrow-link" href="/kien-thuc/">Đọc cẩm nang chăm da <span>↗</span></a></div></section>');
}
function privacyPage() {
  return layout({title:"Quyền riêng tư và lưu ý đặt hàng | Phùng Hà Korea",
    description:"Thông tin về dữ liệu bài tư vấn da, liên kết Messenger, các dịch vụ kỹ thuật và quy trình liên hệ đặt mỹ phẩm Hàn tại Phùng Hà Korea.",
    url:"/chinh-sach/" },
    '<section class="page-hero container"><p class="eyebrow">POLICIES / THÔNG TIN MINH BẠCH</p>' +
    '<h1>Chính sách &amp; <em>quyền riêng tư.</em></h1>' +
    '<p>Một vài điều cần biết khi đọc bài, làm bài tư vấn và liên hệ mua mỹ phẩm qua Phùng Hà Korea.</p></section>' +
    '<section class="container policy-content"><h2>Bài tư vấn da 5 câu</h2>' +
    '<p>Kết quả được tính ngay trong trình duyệt của bạn. Website không lưu câu trả lời vào cơ sở dữ liệu riêng. Khi bạn tự sao chép và gửi thông tin qua Messenger, nội dung bạn gửi được xử lý theo chính sách của Meta.</p>' +
    '<h2>Dịch vụ kỹ thuật</h2><p>Website được phục vụ qua Cloudflare, nhà cung cấp có thể xử lý dữ liệu truy cập kỹ thuật cần thiết để vận hành và bảo vệ dịch vụ. Trang sử dụng Google Fonts để hiển thị kiểu chữ; khi tải font, trình duyệt có thể kết nối với máy chủ của Google.</p>' +
    '<h2>Thông tin sản phẩm và đặt hàng</h2><p>Các nhóm mỹ phẩm trên website là định hướng tham khảo, chưa phải danh sách hàng có sẵn hoặc báo giá ràng buộc. Trước khi xác nhận đơn, hãy hỏi Hà để kiểm tra chính xác tên sản phẩm, xuất xứ, nhãn, hạn dùng, giá, giao hàng và điều kiện đổi trả.</p>' +
    '<h2>Nội dung chăm sóc da</h2><p>Bài viết và kết quả tư vấn tự động không phải chẩn đoán, chỉ định điều trị hoặc hướng dẫn tự peel. Nếu có vấn đề da kéo dài hay cần thủ thuật, vui lòng gặp bác sĩ da liễu.</p>' +
    '<h2>Liên hệ</h2><p>Để hỏi về thông tin trên website hoặc yêu cầu liên quan đến dữ liệu bạn đã chủ động gửi cho Phùng Hà Korea, hãy liên hệ <a href="mailto:Phungthuha1997@gmail.com">Phungthuha1997@gmail.com</a> hoặc <a href="' + FANPAGE + '" target="_blank" rel="noopener noreferrer">fanpage Phùng Hà Korea</a>.</p></section>');
}
function rssXML() {
  const items = articles.slice(0,30).map(a=>'<item><title>'+escapeHTML(a.title)+'</title><link>'+BASE+a.url+'</link>'+
    '<guid>'+BASE+a.url+'</guid><description>'+escapeHTML(a.description)+'</description><pubDate>'+new Date(a.date+'T09:00:00+07:00').toUTCString()+'</pubDate></item>').join("");
  return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Phùng Hà Korea - Cẩm nang chăm da</title><link>'+BASE+'/kien-thuc/</link><description>Kiến thức chăm da và mỹ phẩm Hàn cho làn da Việt</description><language>vi</language>'+items+'</channel></rss>';
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
write("public/404.html",'<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Không tìm thấy trang | Phùng Hà Korea</title><style>body{font-family:Arial,sans-serif;background:#f9f6ef;color:#263d34;min-height:80vh;display:grid;place-items:center;text-align:center}h1{font-size:5rem;margin:0}a{color:inherit}</style><main><p>PHÙNG HÀ KOREA</p><h1>404</h1><p>Trang này không tồn tại hoặc đã thay đổi.</p><a href="/">← Về trang chủ</a></main></html>');
console.log("Generated Korean Editorial pages, article archives, sitemap and RSS feed.");
