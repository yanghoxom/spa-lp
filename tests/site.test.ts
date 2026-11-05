import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");
describe("Korean Editorial multi-page generator", () => {
  execFileSync("node", ["site/build.mjs"]);
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
    expect(read("public/feed.xml")).toContain("Phùng Hà Korea - Cẩm nang chăm da");
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
    expect(read("my-pham/index.html")).toContain("không phải giỏ hàng trực tuyến");
  });

  test("displays both optimized editorial WebP photos with clear AI disclosure", () => {
    const shop = read("my-pham/index.html");
    const photos = ["riena-sun-ampoule-ai-editorial.webp", "korean-skincare-trio-ai-editorial.webp"];
    for (const name of photos) {
      expect(existsSync("public/assets/editorial/" + name)).toBe(true);
      expect(shop).toContain("/assets/editorial/" + name);
    }
    expect(shop).toContain('width="720" height="900" loading="lazy"');
    expect(shop).toContain("Ảnh minh họa AI");
    expect(shop).toContain("bao bì chưa đối chiếu với sản phẩm thực tế");
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
    expect(html).toContain("Khám phá mỹ phẩm Hàn");
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
  test("ships original editorial category illustrations and skin concern icons", () => {
    const home = read("index.html");
    const shop = read("my-pham/index.html");
    for (const id of ["chong-nang", "duong-am-phuc-hoi", "duong-sang-deu-mau", "cham-da-tuoi-35"]) {
      const img = "/assets/collections/" + id + ".svg";
      expect(existsSync("public" + img)).toBe(true);
      expect(home).toContain(img);
      expect(shop).toContain(img);
      expect(read("public" + img)).toContain("<svg");
    }
    for(const icon of ["nam-sam", "duong-am", "tuoi-35", "chong-nang"]){
      const img="/assets/icons/"+icon+".svg";
      expect(existsSync("public"+img)).toBe(true);
      expect(home).toContain(img);
    }
    expect(home).toContain("Hình minh họa nhóm sản phẩm");
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
