import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getVisibleQuestionKeys } from "../src/questionFlow";
import { buildConsultationResult, createMessengerText } from "../src/quiz";

describe("buildConsultationResult", () => {
  it("prioritizes gentle brightening care for oily skin with melasma concerns", () => {
    const result = buildConsultationResult({
      skinType: "oily",
      concern: "melasma",
      history: "healthy",
      budget: "mid",
      goal: "brightening",
    });

    expect(result.code).toMatch(/^PK-\d{4}$/);
    expect(result.title).toBe("Dưỡng sáng dịu nhẹ");
    expect(result.priceRange).toBe("Khoảng 300k - 700k");
    expect(result.fitLevel).toBe("Cao");
    expect(result.reasons).toContain("Da dễ đổ dầu, nên ưu tiên lớp dưỡng mỏng nhẹ.");
    expect(result.reasons).toContain("Nám/sạm cần dưỡng sáng an toàn và chống nắng kỹ.");
    expect(result.morning).toEqual(["Làm sạch dịu nhẹ", "Serum làm sáng", "Kem chống nắng"]);
    expect(result.evening).toEqual(["Làm sạch", "Serum phục hồi", "Kem dưỡng mỏng"]);
    expect(result.followUpQuestions).toContain("Bạn đang dùng sản phẩm nào?");
  });

  it("returns recovery-first care for sensitive skin with acne concerns", () => {
    const result = buildConsultationResult({
      skinType: "sensitive",
      concern: "acne",
      history: "used-many",
      budget: "low",
      goal: "safe",
    });

    expect(result.title).toBe("Phục hồi da dễ kích ứng");
    expect(result.priceRange).toBe("Dưới 300k");
    expect(result.fitLevel).toBe("Cần shop kiểm tra thêm");
    expect(result.reasons).toContain("Da nhạy cảm cần ưu tiên phục hồi, giảm sản phẩm mạnh.");
    expect(result.reasons).toContain("Mụn/thâm cần làm sạch nhẹ, phục hồi và bảo vệ da.");
    expect(result.note).toContain("Shop sẽ kiểm tra lại tình trạng da trước khi gợi ý sản phẩm cụ thể.");
    expect(result.followUpQuestions).toContain("Da có đang kích ứng, đỏ rát hoặc bong tróc không?");
  });
});

describe("createMessengerText", () => {
  it("formats quiz answers and result code for sending back to the fanpage", () => {
    const text = createMessengerText(
      {
        skinType: "combination",
        concern: "dull",
        history: "beginner",
        budget: "upper",
        goal: "glow",
      },
      {
        code: "PK-4821",
        title: "Da căng bóng chuẩn Hàn",
        priceRange: "Khoảng 700k - 1 triệu",
        fitLevel: "Trung bình",
        reasons: ["Da hỗn hợp cần cân bằng dầu nước."],
        morning: ["Làm sạch", "Chống nắng"],
        evening: ["Tẩy trang", "Phục hồi"],
        followUpQuestions: ["Bạn đang dùng sản phẩm nào?"],
        note: "Shop kiểm tra lại trước khi dùng.",
      },
    );

    expect(text).toContain("Mã tư vấn: PK-4821");
    expect(text).toContain("Loại da: Hỗn hợp");
    expect(text).toContain("Vấn đề chính: Da xỉn màu/không đều màu");
    expect(text).toContain("Shop gợi ý: Da căng bóng chuẩn Hàn");
    expect(text).toContain("Ngân sách: 700k - 1 triệu");
    expect(text).toContain("Mức độ phù hợp: Trung bình");
    expect(text).toContain("Shop cần hỏi thêm:");
    expect(text).toContain("- Bạn đang dùng sản phẩm nào?");
  });
});

describe("customer-facing copy", () => {
  it("uses a compact header with avatar and only useful navigation links", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const header = indexHtml.match(/<header class="site-header"[\s\S]*?<\/header>/)?.[0] ?? "";

    expect(header).toContain('class="brand-avatar"');
    expect(header).toContain('href="#quiz">Tư vấn</a>');
    expect(header).toContain('href="#faq">Câu hỏi thường gặp</a>');
    expect(header).not.toContain("Tin tưởng");
    expect(header).not.toContain('href="#proof"');
  });

  it("removes the extra trust and editorial sections from the page", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

    expect(indexHtml).not.toContain('id="proof"');
    expect(indexHtml).not.toContain('class="section-shell editorial"');
    expect(indexHtml).not.toContain("Tư vấn có người kiểm tra lại");
  });

  it("keeps the first-screen and consultation intro copy short", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

    expect(indexHtml).not.toContain("Chỉ 5 câu ngắn. Không cần để lại số điện thoại.");
    expect(indexHtml).not.toContain("Trả lời vài câu ngắn để shop gợi ý cách chăm da sát với làn da, ngân sách và nhu cầu của bạn hơn.");
    expect(indexHtml).not.toContain("Trả lời từng câu, không cần đọc dài.");
    expect(indexHtml).not.toContain("Chọn đáp án gần đúng nhất.");
    expect(indexHtml).not.toContain("Khi nào nên hỏi shop?");
    expect(indexHtml).not.toContain("floating-card");
  });

  it("does not use a floating mobile button that can cover the question controls", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

    expect(indexHtml).not.toContain('class="sticky-cta"');
    expect(indexHtml).not.toContain("Tư vấn 30 giây");
  });

  it("avoids internal or hard-to-understand marketing words", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const quizSource = readFileSync(resolve(process.cwd(), "src", "quiz.ts"), "utf8");
    const mainSource = readFileSync(resolve(process.cwd(), "src", "main.ts"), "utf8");
    const visibleHtml = indexHtml.replace(/<[^>]+>/g, " ");
    const sourceCopy = [quizSource, mainSource]
      .flatMap((source) => Array.from(source.matchAll(/"([^"]*)"|'([^']*)'/g)))
      .map((match) => match[1] ?? match[2])
      .join("\n");
    const customerCopy = [visibleHtml, sourceCopy].join("\n");

    expect(customerCopy).not.toMatch(/test da|routine|funnel|saler|chốt|lọc nhu cầu|K-beauty|Skin test|treatment/i);
  });

  it("clearly sends results through Messenger and reassures cautious customers", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

    expect(indexHtml).toContain("Gửi qua Messenger cho shop");
    expect(indexHtml).toContain("SĐT/Zalo nếu bạn muốn shop nhắn nhanh hơn");
    expect(indexHtml).toContain("Không bắt buộc mua, shop kiểm tra lại trước khi tư vấn.");
    expect(indexHtml).toContain("SĐT không bắt buộc, shop không gọi nếu bạn không để số.");
  });

  it("uses a non-acne image for the melasma and uneven-tone service card", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const serviceGrid = indexHtml.match(/<div class="service-grid">([\s\S]*?)<\/div>/)?.[1] ?? "";
    const firstServiceCard = serviceGrid.match(/<article>([\s\S]*?)<\/article>/)?.[1] ?? "";

    expect(firstServiceCard).toContain("<h3>Nám, sạm, da không đều màu</h3>");
    expect(firstServiceCard).toContain('src="assets/fanpage-product.jpg"');
    expect(firstServiceCard).not.toContain("fanpage-service-1.jpg");
  });

  it("keeps service card images away from busy sales-text assets", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const serviceGrid = indexHtml.match(/<div class="service-grid">([\s\S]*?)<\/div>/)?.[1] ?? "";

    expect(serviceGrid).not.toContain("fanpage-service-1.jpg");
    expect(serviceGrid).not.toContain("fanpage-service-3.jpg");
    expect(serviceGrid).not.toContain("fanpage-hero.jpg");
  });
});

describe("question flow", () => {
  it("shows one unanswered question at a time until the answers are complete", () => {
    const keys = ["concern", "skinType", "history", "budget", "goal"] as const;

    expect(getVisibleQuestionKeys(keys, {})).toEqual(["concern"]);
    expect(getVisibleQuestionKeys(keys, { concern: "melasma" })).toEqual(["skinType"]);
    expect(getVisibleQuestionKeys(keys, { concern: "melasma", skinType: "oily" })).toEqual(["history"]);
    expect(
      getVisibleQuestionKeys(keys, {
        concern: "melasma",
        skinType: "oily",
        history: "beginner",
        budget: "mid",
        goal: "brightening",
      }),
    ).toEqual([]);
  });
});
