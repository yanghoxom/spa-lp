export type SkinType = "oily" | "dry" | "combination" | "sensitive" | "unknown";
export type Concern = "acne" | "melasma" | "dull" | "pores" | "aging";
export type History = "beginner" | "used-many" | "sensitive" | "simple";
export type Budget = "low" | "mid" | "high";
export type Goal = "safe" | "fast" | "simple" | "full";

export interface QuizAnswers {
  skinType: SkinType;
  concern: Concern;
  history: History;
  budget: Budget;
  goal: Goal;
}

export interface ConsultationResult {
  code: string;
  title: string;
  priceRange: string;
  reasons: string[];
  morning: string[];
  evening: string[];
  note: string;
}

const skinTypeLabels: Record<SkinType, string> = {
  oily: "Da dầu",
  dry: "Da khô",
  combination: "Hỗn hợp",
  sensitive: "Nhạy cảm",
  unknown: "Chưa rõ",
};

const concernLabels: Record<Concern, string> = {
  acne: "Mụn/thâm sau mụn",
  melasma: "Nám/sạm",
  dull: "Da xỉn màu/không đều màu",
  pores: "Lỗ chân lông/bóng dầu",
  aging: "Nếp nhăn/da kém săn",
};

const historyLabels: Record<History, string> = {
  beginner: "Mới bắt đầu chăm da",
  "used-many": "Đã dùng nhiều sản phẩm",
  sensitive: "Da dễ kích ứng",
  simple: "Muốn routine đơn giản",
};

const budgetLabels: Record<Budget, string> = {
  low: "Dưới 300k",
  mid: "300k - 700k",
  high: "Trên 700k",
};

const goalLabels: Record<Goal, string> = {
  safe: "An toàn, dịu nhẹ",
  fast: "Nhanh thấy thay đổi nhưng vẫn an toàn",
  simple: "Ít bước, dễ theo",
  full: "Routine đầy đủ chuẩn Hàn",
};

const skinReasons: Record<SkinType, string> = {
  oily: "Da dễ đổ dầu nên ưu tiên nền routine mỏng, không bí.",
  dry: "Da khô cần cấp ẩm và phục hồi hàng rào bảo vệ trước.",
  combination: "Da hỗn hợp cần cân bằng dầu nước, tránh routine quá nặng.",
  sensitive: "Da nhạy cảm cần giảm tải hoạt chất mạnh trước khi đổi combo.",
  unknown: "Chưa rõ loại da nên shop sẽ ưu tiên routine an toàn, dễ theo dõi.",
};

const concernReasons: Record<Concern, string> = {
  acne: "Mụn/thâm nên được xử lý theo hướng làm sạch - phục hồi - bảo vệ.",
  melasma: "Nám/sạm cần hướng làm sáng an toàn, kiên trì và chống nắng kỹ.",
  dull: "Da xỉn màu hợp với routine làm sạch tốt, dưỡng sáng và khóa ẩm.",
  pores: "Lỗ chân lông và bóng dầu cần kiểm soát dầu nhưng không làm khô căng.",
  aging: "Da kém săn cần phục hồi nền da, chống nắng và dưỡng chất chống oxy hóa.",
};

export const quizLabels = {
  skinType: skinTypeLabels,
  concern: concernLabels,
  history: historyLabels,
  budget: budgetLabels,
  goal: goalLabels,
};

function createCode(answers: QuizAnswers): string {
  const seed = `${answers.skinType}|${answers.concern}|${answers.history}|${answers.budget}|${answers.goal}`;
  const hash = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0);
  return `PK-${String((hash % 9000) + 1000).padStart(4, "0")}`;
}

function priceRangeFor(budget: Budget): string {
  if (budget === "low") {
    return "Khoảng 290k - 450k";
  }

  if (budget === "high") {
    return "Từ 790k";
  }

  return "Khoảng 490k - 690k";
}

function titleFor(answers: QuizAnswers): string {
  if (answers.skinType === "sensitive" || answers.history === "used-many") {
    return "Routine phục hồi da dễ kích ứng";
  }

  if (answers.concern === "melasma" || answers.concern === "dull") {
    return "Routine sáng da dịu nhẹ";
  }

  if (answers.concern === "aging" || answers.goal === "full") {
    return "Routine căng bóng chuẩn Hàn";
  }

  return "Routine sạch thoáng giảm bí da";
}

export function buildConsultationResult(answers: QuizAnswers): ConsultationResult {
  const title = titleFor(answers);
  const baseMorning = answers.concern === "melasma" || answers.concern === "dull"
    ? ["Làm sạch dịu nhẹ", "Serum làm sáng", "Kem chống nắng"]
    : ["Làm sạch dịu nhẹ", "Serum phục hồi", "Kem chống nắng"];

  const evening = answers.concern === "acne"
    ? ["Làm sạch", "Serum phục hồi", "Kem chấm/gel hỗ trợ mụn"]
    : ["Làm sạch", "Serum phục hồi", "Kem dưỡng mỏng"];

  return {
    code: createCode(answers),
    title,
    priceRange: priceRangeFor(answers.budget),
    reasons: [
      skinReasons[answers.skinType],
      concernReasons[answers.concern],
      `Ngân sách ${budgetLabels[answers.budget].toLowerCase()} nên shop sẽ lọc combo vừa tầm trước.`,
      answers.goal === "safe"
        ? "Bạn ưu tiên an toàn nên kết quả không dùng claim mạnh hoặc hoạt chất quá gắt."
        : `Mục tiêu của bạn là ${goalLabels[answers.goal].toLowerCase()}, routine sẽ được shop kiểm tra lại theo tình trạng thật.`,
    ],
    morning: baseMorning,
    evening,
    note: "Shop sẽ kiểm tra lại tình trạng da trước khi chốt sản phẩm cụ thể.",
  };
}

export function createMessengerText(answers: QuizAnswers, result: ConsultationResult): string {
  return [
    `Mã tư vấn: ${result.code}`,
    `Loại da: ${skinTypeLabels[answers.skinType]}`,
    `Vấn đề chính: ${concernLabels[answers.concern]}`,
    `Tình trạng: ${historyLabels[answers.history]}`,
    `Ngân sách: ${budgetLabels[answers.budget]}`,
    `Mục tiêu: ${goalLabels[answers.goal]}`,
    `Gợi ý: ${result.title}`,
    `Giá tham khảo: ${result.priceRange}`,
    "Nhờ shop kiểm tra lại combo này giúp em nhé.",
  ].join("\n");
}
