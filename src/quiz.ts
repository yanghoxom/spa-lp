export type SkinType = "oily" | "dry" | "combination" | "sensitive" | "unknown";
export type Concern = "acne" | "melasma" | "dull" | "pores" | "aging";
export type History = "healthy" | "sensitive" | "active" | "beginner" | "used-many";
export type Budget = "low" | "mid" | "upper" | "premium";
export type Goal = "simple" | "safe" | "brightening" | "glow" | "complete";
export type FitLevel = "Cao" | "Trung bình" | "Cần Hà kiểm tra thêm";

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
  fitLevel: FitLevel;
  reasons: string[];
  morning: string[];
  evening: string[];
  followUpQuestions: string[];
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
  healthy: "Đang khỏe",
  sensitive: "Dễ kích ứng",
  active: "Đang dùng sản phẩm đặc trị",
  beginner: "Mới bắt đầu chăm da",
  "used-many": "Đã dùng nhiều nhưng chưa hợp",
};

const budgetLabels: Record<Budget, string> = {
  low: "Dưới 1 triệu",
  mid: "1 - 5 triệu",
  upper: "5 - 10 triệu",
  premium: "Trên 10 triệu",
};

const goalLabels: Record<Goal, string> = {
  simple: "Đơn giản dễ dùng",
  safe: "Phục hồi an toàn",
  brightening: "Dưỡng sáng đều màu",
  glow: "Căng bóng chuẩn Hàn",
  complete: "Combo đầy đủ",
};

const skinReasons: Record<SkinType, string> = {
  oily: "Da dễ đổ dầu, nên ưu tiên lớp dưỡng mỏng nhẹ.",
  dry: "Da khô cần cấp ẩm và phục hồi hàng rào bảo vệ.",
  combination: "Da hỗn hợp cần cân bằng dầu nước, tránh lớp dưỡng quá nặng.",
  sensitive: "Da nhạy cảm cần ưu tiên phục hồi, giảm sản phẩm mạnh.",
  unknown: "Chưa rõ loại da nên ưu tiên cách dùng an toàn, dễ theo dõi.",
};

const concernReasons: Record<Concern, string> = {
  acne: "Mụn/thâm cần làm sạch nhẹ, phục hồi và bảo vệ da.",
  melasma: "Nám/sạm cần dưỡng sáng an toàn và chống nắng kỹ.",
  dull: "Da xỉn màu cần làm sạch tốt, dưỡng sáng và khóa ẩm.",
  pores: "Lỗ chân lông cần kiểm soát dầu nhưng không làm khô căng.",
  aging: "Da kém săn cần phục hồi nền da và chống nắng đều.",
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
  if (budget === "mid") {
    return "Khoảng 1 - 5 triệu";
  }

  if (budget === "upper") {
    return "Khoảng 5 - 10 triệu";
  }

  return budgetLabels[budget];
}

function titleFor(answers: QuizAnswers): string {
  if (answers.skinType === "sensitive" || answers.history === "used-many") {
    return "Phục hồi da dễ kích ứng";
  }

  if (answers.concern === "melasma" || answers.concern === "dull") {
    return "Dưỡng sáng dịu nhẹ";
  }

  if (answers.concern === "aging" || answers.goal === "glow" || answers.goal === "complete") {
    return "Da căng bóng chuẩn Hàn";
  }

  return "Da sạch thoáng, giảm bí";
}

function fitLevelFor(answers: QuizAnswers): FitLevel {
  if (
    answers.skinType === "sensitive" ||
    answers.skinType === "unknown" ||
    answers.history === "sensitive" ||
    answers.history === "active" ||
    answers.history === "used-many"
  ) {
    return "Cần Hà kiểm tra thêm";
  }

  const goalMatchesConcern =
    ((answers.concern === "melasma" || answers.concern === "dull") && answers.goal === "brightening") ||
    (answers.concern === "aging" && answers.goal === "glow") ||
    ((answers.concern === "acne" || answers.concern === "pores") &&
      (answers.goal === "simple" || answers.goal === "safe"));

  return goalMatchesConcern ? "Cao" : "Trung bình";
}

function followUpQuestionsFor(answers: QuizAnswers): string[] {
  const questions = [
    "Bạn đang dùng sản phẩm nào?",
    "Da có đang kích ứng, đỏ rát hoặc bong tróc không?",
    "Bạn có đang bầu/bú hoặc dùng sản phẩm đặc trị mạnh không?",
  ];

  if (answers.skinType === "unknown") {
    questions.push("Bạn có thể gửi ảnh da chụp ánh sáng tự nhiên để Hà xem kỹ hơn không?");
  }

  if (answers.budget === "low") {
    questions.push("Bạn muốn ưu tiên sản phẩm nào trước: làm sạch, phục hồi hay dưỡng sáng?");
  }

  return questions;
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
    fitLevel: fitLevelFor(answers),
    reasons: [
      skinReasons[answers.skinType],
      concernReasons[answers.concern],
      `Ngân sách ${budgetLabels[answers.budget].toLowerCase()}: Hà ưu tiên vài món cần nhất trước.`,
      answers.goal === "safe"
        ? "Ưu tiên an toàn: chọn cách dùng dịu, dễ theo dõi."
        : `Mục tiêu: ${goalLabels[answers.goal].toLowerCase()}. Hà sẽ kiểm tra lại theo tình trạng thật.`,
    ],
    morning: baseMorning,
    evening,
    followUpQuestions: followUpQuestionsFor(answers),
    note: "Hà sẽ kiểm tra lại tình trạng da trước khi gợi ý sản phẩm cụ thể.",
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
    `Hà gợi ý: ${result.title}`,
    `Giá tham khảo: ${result.priceRange}`,
    `Mức độ phù hợp: ${result.fitLevel}`,
    "Hà cần hỏi thêm:",
    ...result.followUpQuestions.map((question) => `- ${question}`),
    "Nhờ Hà kiểm tra lại giúp em nhé.",
  ].join("\n");
}
