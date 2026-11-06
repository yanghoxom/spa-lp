import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");
const CDN = "https://cdn.phunghakorea.com";
const media = JSON.parse(read("infra/media-manifest.json"));
describe("Korean Editorial multi-page generator", () => {
  execFileSync("node", ["site/build.mjs"]);
  test("uses the approved PH skincare icon across browser tabs and mobile home screens", () => {
    for (const page of ["index.html","my-pham/index.html","tu-van-da/index.html","kien-thuc/index.html"]) {
      const html = read(page);
      expect(html).toContain('href="https://cdn.phunghakorea.com/favicon.ico?v=2"');
      expect(html).toContain('type="image/webp" sizes="32x32" href="https://cdn.phunghakorea.com/assets/brand/phungha-icon-32-v1.webp"');
      expect(html).toContain('type="image/webp" sizes="48x48" href="https://cdn.phunghakorea.com/assets/brand/phungha-icon-48-v1.webp"');
      expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="https://cdn.phunghakorea.com/apple-touch-icon.png"');
      expect(html).toContain('rel="manifest" href="/site.webmanifest"');
      expect(html).not.toContain('href="/favicon.svg"');
      expect(html).toContain('"logo":"https://cdn.phunghakorea.com/assets/brand/phungha-icon-512-v1.webp"');
    }
    for(const size of [32,48,192,512]) {
      expect(media["/assets/brand/phungha-icon-" + size + "-v1.webp"].size).toBeGreaterThan(0);
    }
    expect(media["/favicon.ico"]).toBeDefined();
    expect(media["/apple-touch-icon.png"]).toBeDefined();
    const manifest = JSON.parse(read("public/site.webmanifest"));
    expect(manifest.icons).toHaveLength(2);
    expect(manifest.icons.map((x: { sizes: string })=>x.sizes)).toEqual(["192x192","512x512"]);
  });

  test("keeps article consultation CTA white on dark green, including mobile and visited states", () => {
    const css = read("src/styles.css");
    const article = read("kien-thuc/peel-da-phuc-hoi-an-toan/index.html");
    expect(css).toContain(".article-body a:not(.btn)");
    expect(css).toContain(".article-body a.btn.btn-dark:visited");
    expect(css).toContain("color: #FFFFFF;");
    expect(css).toContain("min-height: 52px;");
    expect(article).toContain('class="btn btn-dark" href="/tu-van-da/"');
  });

  test("creates homepage with brand positioning and unique canonical URL", () => {
    const html = read("index.html");
    expect(html).toContain("PHÙNG HÀ");
    expect(html).toContain("https://phunghakorea.com/");
    expect(html).toContain('href="/kien-thuc/"');
    expect(html).toContain('href="/my-pham/"');
  });
  test("publishes five starter articles and includes them in sitemap and RSS", () => {
    const page = "kien-thuc/peel-da-phuc-hoi-an-toan/index.html";
    expect(existsSync(page)).toBe(true);
    expect(read(page)).toContain("Peel da và phục hồi");
    const sitemap = read("public/sitemap.xml");
    expect(sitemap).toContain("https://phunghakorea.com/kien-thuc/peel-da-phuc-hoi-an-toan/");
    expect(read("public/feed.xml")).toContain("Phùng Hà Korea - Góc chăm da");
  });
  test("keeps consultation quiz and source of truth", () => {
    const quiz = read("tu-van-da/index.html");
    expect(quiz).toContain('id="quiz-form"');
    expect(quiz).toContain('id="result-card"');
    expect(quiz).toContain('src="/src/main.ts"');
    expect(quiz).toContain('id="copy-consultation"');
    expect(quiz).toContain('id="copy-feedback"');
    expect(quiz).toContain('aria-live="polite"');
    expect(quiz).toContain('id="messenger-link"');
  });

  test("renders editorial photos, responsive tables and internal links from Markdown", () => {
    const sample = [
      "## Cách chọn",
      "",
      "![Chân dung minh họa](/assets/fanpage-service-2.jpg)",
      "",
      "| Thành phần | Mục đích |",
      "| --- | --- |",
      "| Glycerin | Dưỡng ẩm |",
      "| Ceramide | Hỗ trợ hàng rào bảo vệ |",
      "",
      "Xem [nhóm chống nắng](/my-pham/chong-nang/) để biết thêm."
    ].join("\n");
    const program = 'import {renderMarkdown} from "./site/build.mjs";console.log("MARKDOWN_TEST:"+renderMarkdown(' + JSON.stringify(sample) + ').html);';
    const output = execFileSync("node", ["--input-type=module", "-e", program], { encoding: "utf8" });
    expect(output).toContain('class="article-figure"');
    expect(output).toContain('alt="Chân dung minh họa"');
    expect(output).toContain('<th scope="col">Thành phần</th>');
    expect(output).toContain('<td>Ceramide</td>');
    expect(output).toContain('href="/my-pham/chong-nang/"');
  });
  test("provides category pages without inventing SKU prices", () => {
    expect(existsSync("my-pham/duong-am-phuc-hoi/index.html")).toBe(true);
    expect(read("my-pham/index.html")).toContain("Chị đặt hàng trực tiếp với Hà qua Messenger nhé");
  });

  test("displays optimized editorial WebP photos without overlay badges", () => {
    const shop = read("my-pham/index.html");
    const photos = ["chong-nang-v2-960.webp", "cham-da-tuoi-35-v2-960.webp"];
    for (const name of photos) {
      expect(media["/assets/collections/" + name]).toBeDefined();
      expect(shop).toContain("/assets/collections/" + name);
    }
    expect(shop).toContain('width="960" height="1200" loading="lazy"');
    expect(shop).not.toContain("Ảnh minh họa AI");
    expect(shop).not.toContain("ai-photo-badge");
  });
  test("provides topic navigation for evergreen daily publishing", () => {
    const archive = read("kien-thuc/index.html");
    expect(archive).toContain('/kien-thuc/chu-de/');
    expect(existsSync("kien-thuc/chu-de/da-tuoi-35/index.html")).toBe(true);
    expect(read("public/sitemap.xml")).toContain("https://phunghakorea.com/kien-thuc/chu-de/");
  });
  test("explains privacy and preserves canonical, structured organization data", () => {
    expect(existsSync("chinh-sach/index.html")).toBe(true);
    expect(read("chinh-sach/index.html")).toContain("không lưu câu trả lời vào cơ sở dữ liệu riêng");
    const html = read("index.html");
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain("Chọn mỹ phẩm");
    expect(html).toContain("/assets/fanpage-service-2.jpg");
    expect(html).toContain('href="/chinh-sach/"');
    expect(read("kien-thuc/da-nam-sam-chong-nang-the-nao/index.html")).toContain('"@type":"Article"');
  });
  test("uses Vietnamese, shows the new support email and avoids old slogans", () => {
    const html = read("index.html");
    const privacy = read("chinh-sach/index.html");
    expect(html).toContain("cskh@phunghakorea.com");
    expect(html).toContain('"email":"cskh@phunghakorea.com"');
    expect(privacy).toContain('mailto:cskh@phunghakorea.com');
    for(const page of [html, privacy, read("kien-thuc/index.html"), read("my-pham/index.html"), read("tu-van-da/index.html")]) {
      expect(page).not.toContain("Phungthuha1997@gmail.com");
      expect(page).not.toContain("SKIN CONSULTATION");
      expect(page).not.toContain("KOREAN BEAUTY EDIT");
      expect(page).not.toContain("THE SKIN JOURNAL");
    }
  });
  test("ships responsive product photographs across categories and skin concern icons", () => {
    const home = read("index.html");
    const shop = read("my-pham/index.html");
    for (const id of ["chong-nang", "duong-am-phuc-hoi", "duong-sang-deu-mau", "cham-da-tuoi-35"]) {
      const img = "/assets/collections/" + id + "-v2-960.webp";
      expect(media[img]).toBeDefined();
      expect(home).toContain(img);
      expect(shop).toContain(img);
      expect(media[img].contentType).toBe("image/webp");
      expect(read("my-pham/" + id + "/index.html")).toContain(img);
    }
    for(const icon of ["nam-sam", "duong-am", "tuoi-35", "chong-nang"]){
      const img="/assets/icons/"+icon+".svg";
      expect(media[img]).toBeDefined();
      expect(home).toContain(img);
    }
    expect(home).not.toContain("Hình minh họa nhóm sản phẩm");
  });
  test("keeps all image binaries out of source and resolves generated images through the CDN", () => {
    expect(readdirSync("public", {recursive:true}).filter(p => /\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/i.test(String(p)))).toEqual([]);
    for (const file of ["index.html", "my-pham/index.html", "ve-phung-ha/index.html", "kien-thuc/index.html"]) {
      const html=read(file);
      for (const match of html.matchAll(/<(?:img|source)\b[^>]*?(?:src|srcset)="([^"]+)"/g)) {
        for (const candidate of match[1].split(",")) {
          const url=candidate.trim().split(/\s+/)[0];
          expect(url.startsWith(CDN + "/"), file + ": " + url).toBe(true);
          expect(media[new URL(url).pathname]).toBeDefined();
        }
      }
    }
  });
  test("all generated internal page links resolve", () => {
    const routes = ["index.html", "kien-thuc/index.html", "my-pham/index.html", "tu-van-da/index.html",
      "ve-phung-ha/index.html", "chinh-sach/index.html",
      ...["chong-nang", "cham-da-tuoi-35", "duong-am-phuc-hoi", "duong-sang-deu-mau"].map(x => "my-pham/" + x + "/index.html")];
    for(const file of routes) {
      const html = read(file);
      for(const match of html.matchAll(/href="\/(?!\/)([^"#?]+)"/g)) {
        const route = match[1];
        expect(existsSync(route.endsWith("/") ? route + "index.html" : "public/" + route), file + ": " + route).toBe(true);
      }
    }
  });
});
