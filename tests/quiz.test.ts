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
    expect(result.priceRange).toBe("500 nghìn – 1 triệu");
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
    expect(result.priceRange).toBe("Dưới 500 nghìn");
    expect(result.fitLevel).toBe("Cần Hà kiểm tra thêm");
    expect(result.reasons).toContain("Da nhạy cảm cần ưu tiên phục hồi, giảm sản phẩm mạnh.");
    expect(result.reasons).toContain("Mụn/thâm cần làm sạch nhẹ, phục hồi và bảo vệ da.");
    expect(result.note).toContain("Hà sẽ kiểm tra lại tình trạng da trước khi gợi ý sản phẩm cụ thể.");
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
        priceRange: "1 – 3 triệu",
        fitLevel: "Trung bình",
        reasons: ["Da hỗn hợp cần cân bằng dầu nước."],
        morning: ["Làm sạch", "Chống nắng"],
        evening: ["Tẩy trang", "Phục hồi"],
        followUpQuestions: ["Bạn đang dùng sản phẩm nào?"],
        note: "Hà kiểm tra lại trước khi dùng.",
      },
    );

    expect(text).toContain("Mã tư vấn: PK-4821");
    expect(text).toContain("Loại da: Hỗn hợp");
    expect(text).toContain("Vấn đề chính: Da xỉn màu/không đều màu");
    expect(text).toContain("Hà gợi ý: Da căng bóng chuẩn Hàn");
    expect(text).toContain("Ngân sách: 1 – 3 triệu");
    expect(text).toContain("Khoảng ngân sách mong muốn: 1 – 3 triệu");
    expect(text).not.toContain("Giá tham khảo");
    expect(text).toContain("Hà cần hỏi thêm:");
    expect(text).toContain("- Bạn đang dùng sản phẩm nào?");
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
