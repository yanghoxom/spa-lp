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
  });
  test("provides category pages without inventing SKU prices", () => {
    expect(existsSync("my-pham/duong-am-phuc-hoi/index.html")).toBe(true);
    expect(read("my-pham/index.html")).toContain("không phải giỏ hàng trực tuyến");
  });
});
