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
    expect(result.reasons).toContain("Da chị dễ đổ dầu, nên ưu tiên lớp dưỡng mỏng nhẹ, dễ chịu khi thoa.");
    expect(result.reasons).toContain("Với nám, sạm da, chị nên chống nắng đều và chọn cách dưỡng sáng dịu nhẹ.");
    expect(result.morning).toEqual(["Làm sạch dịu nhẹ", "Tinh chất dưỡng sáng", "Kem chống nắng"]);
    expect(result.evening).toEqual(["Làm sạch dịu nhẹ", "Tinh chất phục hồi", "Kem dưỡng mỏng nhẹ"]);
    expect(result.followUpQuestions).toContain("Chị đang dùng những sản phẩm nào?");
  });

  it("returns recovery-first care for sensitive skin with acne concerns", () => {
    const result = buildConsultationResult({
      skinType: "sensitive",
      concern: "acne",
      history: "used-many",
      budget: "low",
      goal: "safe",
    });

    expect(result.title).toBe("Chăm dịu nhẹ, giúp da phục hồi");
    expect(result.priceRange).toBe("Dưới 500 nghìn");
    expect(result.fitLevel).toBe("Cần Hà kiểm tra thêm");
    expect(result.reasons).toContain("Da dễ kích ứng cần được chăm dịu nhẹ, ưu tiên phục hồi và giảm sản phẩm mạnh.");
    expect(result.reasons).toContain("Với mụn và vết thâm, chị nên chú ý làm sạch dịu nhẹ, phục hồi và bảo vệ da.");
    expect(result.note).toContain("Hà sẽ hỏi thêm về làn da và mỹ phẩm chị đang dùng trước khi gợi ý sản phẩm cụ thể.");
    expect(result.followUpQuestions).toContain("Da chị có đang đỏ rát, bong tróc hoặc dễ kích ứng không?");
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
        title: "Dưỡng da ẩm mịn, căng mướt",
        priceRange: "1 – 3 triệu",
        fitLevel: "Trung bình",
        reasons: ["Da hỗn hợp nên chọn lớp dưỡng vừa đủ, tránh cảm giác nặng và bí da."],
        morning: ["Làm sạch", "Chống nắng"],
        evening: ["Tẩy trang", "Phục hồi"],
        followUpQuestions: ["Chị đang dùng những sản phẩm nào?"],
        note: "Hà kiểm tra lại trước khi dùng.",
      },
    );

    expect(text).toContain("Mã tư vấn: PK-4821");
    expect(text).toContain("Loại da: Da hỗn hợp");
    expect(text).toContain("Điều muốn cải thiện: Da xỉn màu");
    expect(text).toContain("Gợi ý ban đầu: Dưỡng da ẩm mịn, căng mướt");
    expect(text).toContain("Ngân sách: 1 – 3 triệu");
    expect(text).toContain("Khoảng ngân sách mong muốn: 1 – 3 triệu");
    expect(text).not.toContain("Giá tham khảo");
    expect(text).toContain("Thông tin Hà cần hỏi thêm:");
    expect(text).toContain("- Chị đang dùng những sản phẩm nào?");
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
