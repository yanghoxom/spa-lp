import { describe, expect, it } from "vitest";
import { buildConsultationResult, createMessengerText } from "../src/quiz";

describe("buildConsultationResult", () => {
  it("prioritizes a gentle brightening routine for oily skin with melasma concerns", () => {
    const result = buildConsultationResult({
      skinType: "oily",
      concern: "melasma",
      history: "sensitive",
      budget: "mid",
      goal: "safe",
    });

    expect(result.code).toMatch(/^PK-\d{4}$/);
    expect(result.title).toBe("Routine sáng da dịu nhẹ");
    expect(result.priceRange).toBe("Khoảng 490k - 690k");
    expect(result.reasons).toContain("Da dễ đổ dầu nên ưu tiên nền routine mỏng, không bí.");
    expect(result.reasons).toContain("Nám/sạm cần hướng làm sáng an toàn, kiên trì và chống nắng kỹ.");
    expect(result.morning).toEqual(["Làm sạch dịu nhẹ", "Serum làm sáng", "Kem chống nắng"]);
    expect(result.evening).toEqual(["Làm sạch", "Serum phục hồi", "Kem dưỡng mỏng"]);
  });

  it("returns a recovery-first routine for sensitive skin with acne concerns", () => {
    const result = buildConsultationResult({
      skinType: "sensitive",
      concern: "acne",
      history: "used-many",
      budget: "low",
      goal: "simple",
    });

    expect(result.title).toBe("Routine phục hồi da dễ kích ứng");
    expect(result.priceRange).toBe("Khoảng 290k - 450k");
    expect(result.reasons).toContain("Da nhạy cảm cần giảm tải hoạt chất mạnh trước khi đổi combo.");
    expect(result.reasons).toContain("Mụn/thâm nên được xử lý theo hướng làm sạch - phục hồi - bảo vệ.");
    expect(result.note).toContain("Shop sẽ kiểm tra lại tình trạng da trước khi chốt sản phẩm cụ thể.");
  });
});

describe("createMessengerText", () => {
  it("formats quiz answers and result code for sending back to the fanpage", () => {
    const text = createMessengerText(
      {
        skinType: "combination",
        concern: "dull",
        history: "beginner",
        budget: "high",
        goal: "full",
      },
      {
        code: "PK-4821",
        title: "Routine căng bóng chuẩn Hàn",
        priceRange: "Từ 790k",
        reasons: ["Da hỗn hợp cần cân bằng dầu nước."],
        morning: ["Làm sạch", "Chống nắng"],
        evening: ["Tẩy trang", "Phục hồi"],
        note: "Shop kiểm tra lại trước khi dùng.",
      },
    );

    expect(text).toContain("Mã tư vấn: PK-4821");
    expect(text).toContain("Loại da: Hỗn hợp");
    expect(text).toContain("Vấn đề chính: Da xỉn màu/không đều màu");
    expect(text).toContain("Gợi ý: Routine căng bóng chuẩn Hàn");
    expect(text).toContain("Ngân sách: Trên 700k");
  });
});
