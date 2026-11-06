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
  combination: "Da hỗn hợp",
  sensitive: "Da nhạy cảm",
  unknown: "Chưa rõ loại da",
};

const concernLabels: Record<Concern, string> = {
  acne: "Mụn và vết thâm",
  melasma: "Nám, sạm da",
  dull: "Da xỉn màu",
  pores: "Da dầu, lỗ chân lông",
  aging: "Nếp nhăn, da kém săn",
};

const historyLabels: Record<History, string> = {
  healthy: "Da đang ổn",
  sensitive: "Dễ kích ứng",
  active: "Đang dùng sản phẩm đặc trị",
  beginner: "Mới bắt đầu chăm da",
  "used-many": "Đã thử nhiều, chưa thấy hợp",
};

const budgetLabels: Record<Budget, string> = {
  low: "Dưới 500 nghìn",
  mid: "500 nghìn – 1 triệu",
  upper: "1 – 3 triệu",
  premium: "Trên 3 triệu",
};

const goalLabels: Record<Goal, string> = {
  simple: "Gọn nhẹ, dễ dùng",
  safe: "Dưỡng dịu nhẹ, phục hồi",
  brightening: "Dưỡng sáng, đều màu",
  glow: "Da ẩm mịn, căng mướt",
  complete: "Chăm đủ bước sáng, tối",
};

const skinReasons: Record<SkinType, string> = {
  oily: "Da chị dễ đổ dầu, nên ưu tiên lớp dưỡng mỏng nhẹ, dễ chịu khi thoa.",
  dry: "Với da khô, chị nên chú ý dưỡng ẩm để da bớt khô căng.",
  combination: "Da hỗn hợp nên chọn lớp dưỡng vừa đủ, tránh cảm giác nặng và bí da.",
  sensitive: "Da dễ kích ứng cần được chăm dịu nhẹ, ưu tiên phục hồi và giảm sản phẩm mạnh.",
  unknown: "Chị chưa rõ loại da thì Hà sẽ hỏi thêm để cùng chị chọn cách chăm dịu nhẹ, dễ theo dõi.",
};

const concernReasons: Record<Concern, string> = {
  acne: "Với mụn và vết thâm, chị nên chú ý làm sạch dịu nhẹ, phục hồi và bảo vệ da.",
  melasma: "Với nám, sạm da, chị nên chống nắng đều và chọn cách dưỡng sáng dịu nhẹ.",
  dull: "Da xỉn màu cần được làm sạch nhẹ nhàng, giữ đủ ẩm và dưỡng sáng phù hợp.",
  pores: "Da bóng dầu nên được chăm để bớt nhờn mà vẫn đủ ẩm, không khô căng.",
  aging: "Với da kém săn, chị nên chú ý dưỡng phục hồi và chống nắng đều.",
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
  return budgetLabels[budget];
}

function titleFor(answers: QuizAnswers): string {
  if (answers.skinType === "sensitive" || answers.history === "used-many") {
    return "Chăm dịu nhẹ, giúp da phục hồi";
  }

  if (answers.concern === "melasma" || answers.concern === "dull") {
    return "Dưỡng sáng dịu nhẹ";
  }

  if (answers.concern === "aging" || answers.goal === "glow" || answers.goal === "complete") {
    return "Dưỡng da ẩm mịn, căng mướt";
  }

  return "Chăm da sạch thoáng, nhẹ dịu";
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
    "Chị đang dùng những sản phẩm nào?",
    "Da chị có đang đỏ rát, bong tróc hoặc dễ kích ứng không?",
    "Chị có đang mang thai, cho con bú hoặc dùng sản phẩm đặc trị không?",
  ];

  if (answers.skinType === "unknown") {
    questions.push("Chị có tiện gửi ảnh da chụp dưới ánh sáng tự nhiên để Hà hiểu rõ hơn không?");
  }

  if (answers.budget === "low") {
    questions.push("Chị muốn chọn món nào trước: làm sạch, dưỡng phục hồi hay dưỡng sáng?");
  }

  return questions;
}

export function buildConsultationResult(answers: QuizAnswers): ConsultationResult {
  const title = titleFor(answers);
  const baseMorning = answers.concern === "melasma" || answers.concern === "dull"
    ? ["Làm sạch dịu nhẹ", "Tinh chất dưỡng sáng", "Kem chống nắng"]
    : ["Làm sạch dịu nhẹ", "Tinh chất phục hồi", "Kem chống nắng"];

  const evening = answers.concern === "acne"
    ? ["Làm sạch dịu nhẹ", "Tinh chất phục hồi", "Kem hoặc gel hỗ trợ mụn"]
    : ["Làm sạch dịu nhẹ", "Tinh chất phục hồi", "Kem dưỡng mỏng nhẹ"];

  return {
    code: createCode(answers),
    title,
    priceRange: priceRangeFor(answers.budget),
    fitLevel: fitLevelFor(answers),
    reasons: [
      skinReasons[answers.skinType],
      concernReasons[answers.concern],
      `Trong khoảng ${budgetLabels[answers.budget].toLowerCase()}, Hà sẽ ưu tiên những món thật sự cần cho chị.`,
      answers.goal === "safe"
        ? "Chị thích dưỡng dịu nhẹ, phục hồi. Hà sẽ chọn cách dùng dễ theo dõi và hỏi kỹ trước khi gợi ý sản phẩm."
        : `Mong muốn của chị: ${goalLabels[answers.goal].toLowerCase()}. Hà sẽ trao đổi thêm để gợi ý phù hợp.`,
    ],
    morning: baseMorning,
    evening,
    followUpQuestions: followUpQuestionsFor(answers),
    note: "Hà sẽ hỏi thêm về làn da và mỹ phẩm chị đang dùng trước khi gợi ý sản phẩm cụ thể.",
  };
}

export function createMessengerText(answers: QuizAnswers, result: ConsultationResult): string {
  return [
    "Chào Hà, mình muốn được tư vấn chăm da.",
    `Mã tư vấn: ${result.code}`,
    `Loại da: ${skinTypeLabels[answers.skinType]}`,
    `Điều muốn cải thiện: ${concernLabels[answers.concern]}`,
    `Tình trạng: ${historyLabels[answers.history]}`,
    `Ngân sách: ${budgetLabels[answers.budget]}`,
    `Mong muốn: ${goalLabels[answers.goal]}`,
    `Gợi ý ban đầu: ${result.title}`,
    `Khoảng ngân sách mong muốn: ${result.priceRange}`,
    "Thông tin Hà cần hỏi thêm:",
    ...result.followUpQuestions.map((question) => `- ${question}`),
    "Nhờ Hà tư vấn thêm giúp mình nhé.",
  ].join("\n");
}
