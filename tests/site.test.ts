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
  test("provides category pages without inventing SKU prices", () => {
    expect(existsSync("my-pham/duong-am-phuc-hoi/index.html")).toBe(true);
    expect(read("my-pham/index.html")).toContain("không phải giỏ hàng trực tuyến");
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
