import { describe, expect, it } from "vitest";
import { buildConsultationResult, createMessengerText } from "../src/quiz";

describe("buildConsultationResult", () => {
  it("prioritizes a gentle brightening routine for oily skin with melasma concerns", () => {
    const result = buildConsultationResult({
      skinType: "oily",
      concern: "melasma",
      history: "healthy",
      budget: "mid",
      goal: "brightening",
    });

    expect(result.code).toMatch(/^PK-\d{4}$/);
    expect(result.title).toBe("Routine sáng da dịu nhẹ");
    expect(result.priceRange).toBe("Khoảng 300k - 700k");
    expect(result.fitLevel).toBe("Cao");
    expect(result.reasons).toContain("Da dễ đổ dầu nên ưu tiên nền routine mỏng, không bí.");
    expect(result.reasons).toContain("Nám/sạm cần hướng làm sáng an toàn, kiên trì và chống nắng kỹ.");
    expect(result.morning).toEqual(["Làm sạch dịu nhẹ", "Serum làm sáng", "Kem chống nắng"]);
    expect(result.evening).toEqual(["Làm sạch", "Serum phục hồi", "Kem dưỡng mỏng"]);
    expect(result.followUpQuestions).toContain("Bạn đang dùng sản phẩm nào?");
  });

  it("returns a recovery-first routine for sensitive skin with acne concerns", () => {
    const result = buildConsultationResult({
      skinType: "sensitive",
      concern: "acne",
      history: "used-many",
      budget: "low",
      goal: "safe",
    });

    expect(result.title).toBe("Routine phục hồi da dễ kích ứng");
    expect(result.priceRange).toBe("Dưới 300k");
    expect(result.fitLevel).toBe("Cần shop kiểm tra thêm");
    expect(result.reasons).toContain("Da nhạy cảm cần giảm tải hoạt chất mạnh trước khi đổi combo.");
    expect(result.reasons).toContain("Mụn/thâm nên được xử lý theo hướng làm sạch - phục hồi - bảo vệ.");
    expect(result.note).toContain("Shop sẽ kiểm tra lại tình trạng da trước khi chốt sản phẩm cụ thể.");
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
        title: "Routine căng bóng chuẩn Hàn",
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
    expect(text).toContain("Gợi ý: Routine căng bóng chuẩn Hàn");
    expect(text).toContain("Ngân sách: 700k - 1 triệu");
    expect(text).toContain("Mức độ phù hợp: Trung bình");
    expect(text).toContain("Shop cần hỏi thêm:");
    expect(text).toContain("- Bạn đang dùng sản phẩm nào?");
  });
});
