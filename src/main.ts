import "./styles.css";
import {
  type Budget,
  type Concern,
  type Goal,
  type History,
  type QuizAnswers,
  type SkinType,
  buildConsultationResult,
  createMessengerText,
} from "./quiz";

type Question<T extends keyof QuizAnswers> = {
  key: T;
  title: string;
  options: Array<{ value: QuizAnswers[T]; label: string; hint: string }>;
};

const questions: [
  Question<"concern">,
  Question<"skinType">,
  Question<"history">,
  Question<"budget">,
  Question<"goal">,
] = [
  {
    key: "concern",
    title: "Bạn đang quan tâm vấn đề nào nhất?",
    options: [
      { value: "melasma", label: "Nám/sạm", hint: "Da không đều màu" },
      { value: "acne", label: "Mụn/thâm", hint: "Mụn ẩn, thâm sau mụn" },
      { value: "dull", label: "Da xỉn màu", hint: "Muốn sáng mướt hơn" },
      { value: "pores", label: "Lỗ chân lông", hint: "Bóng dầu, bề mặt sần" },
      { value: "aging", label: "Căng bóng/chống lão hóa", hint: "Nâng nền da khỏe hơn" },
    ],
  },
  {
    key: "skinType",
    title: "Da bạn thuộc loại nào?",
    options: [
      { value: "oily", label: "Da dầu", hint: "Dễ bóng, bí da" },
      { value: "dry", label: "Da khô", hint: "Căng, thiếu ẩm" },
      { value: "combination", label: "Da hỗn hợp", hint: "Dầu vùng T" },
      { value: "sensitive", label: "Da nhạy cảm", hint: "Dễ đỏ rát" },
      { value: "unknown", label: "Chưa rõ", hint: "Vẫn test được" },
    ],
  },
  {
    key: "history",
    title: "Hiện da bạn đang ở tình trạng nào?",
    options: [
      { value: "healthy", label: "Đang khỏe", hint: "Muốn chăm đều hơn" },
      { value: "sensitive", label: "Dễ kích ứng", hint: "Cần phục hồi trước" },
      { value: "treatment", label: "Đang treatment", hint: "Cần kiểm tra kỹ" },
      { value: "beginner", label: "Mới bắt đầu chăm da", hint: "Cần routine dễ hiểu" },
      { value: "used-many", label: "Đã dùng nhiều nhưng chưa hợp", hint: "Sợ da quá tải" },
    ],
  },
  {
    key: "budget",
    title: "Ngân sách bạn muốn bắt đầu?",
    options: [
      { value: "low", label: "Dưới 300k", hint: "Bắt đầu nhẹ nhàng" },
      { value: "mid", label: "300k - 700k", hint: "Đủ bước nền tảng" },
      { value: "upper", label: "700k - 1 triệu", hint: "Routine kỹ hơn" },
      { value: "premium", label: "Trên 1 triệu", hint: "Combo đầy đủ hơn" },
    ],
  },
  {
    key: "goal",
    title: "Bạn muốn routine theo hướng nào?",
    options: [
      { value: "simple", label: "Đơn giản dễ dùng", hint: "Ít bước, dễ duy trì" },
      { value: "safe", label: "Phục hồi an toàn", hint: "Dịu nhẹ, theo dõi kỹ" },
      { value: "brightening", label: "Dưỡng sáng đều màu", hint: "Tập trung nám/sạm/xỉn" },
      { value: "glow", label: "Căng bóng chuẩn Hàn", hint: "Nền da mướt hơn" },
      { value: "complete", label: "Combo đầy đủ", hint: "Chăm kỹ sáng và tối" },
    ],
  },
];

const state: Partial<QuizAnswers> = {
  concern: "melasma",
  skinType: "oily",
  history: "beginner",
  budget: "mid",
  goal: "brightening",
};

const questionList = document.querySelector<HTMLDivElement>("#question-list");
const quizForm = document.querySelector<HTMLFormElement>("#quiz-form");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-quiz");
const progressFill = document.querySelector<HTMLSpanElement>("#progress-fill");
const resultTitle = document.querySelector<HTMLHeadingElement>("#result-title");
const resultNote = document.querySelector<HTMLParagraphElement>("#result-note");
const resultCode = document.querySelector<HTMLDivElement>("#result-code");
const resultFit = document.querySelector<HTMLElement>("#result-fit");
const resultReasons = document.querySelector<HTMLUListElement>("#result-reasons");
const routineAm = document.querySelector<HTMLSpanElement>("#routine-am");
const routinePm = document.querySelector<HTMLSpanElement>("#routine-pm");
const resultFollowups = document.querySelector<HTMLUListElement>("#result-followups");
const messengerLink = document.querySelector<HTMLAnchorElement>("#messenger-link");
const copyButton = document.querySelector<HTMLButtonElement>("#copy-result");
const leadForm = document.querySelector<HTMLFormElement>("#lead-form");

function isComplete(answers: Partial<QuizAnswers>): answers is QuizAnswers {
  return questions.every((question) => Boolean(answers[question.key]));
}

function renderQuestions(): void {
  if (!questionList) return;

  questionList.innerHTML = questions
    .map((question, index) => {
      const options = question.options
        .map((option) => {
          const checked = state[question.key] === option.value ? "checked" : "";
          return `
            <label class="option-pill">
              <input type="radio" name="${question.key}" value="${option.value}" ${checked} />
              <span>
                <strong>${option.label}</strong>
                <small>${option.hint}</small>
              </span>
            </label>
          `;
        })
        .join("");

      return `
        <fieldset class="question-block">
          <legend><span>0${index + 1}</span>${question.title}</legend>
          <div class="option-grid">${options}</div>
        </fieldset>
      `;
    })
    .join("");
}

function readAnswers(): void {
  const data = new FormData(quizForm ?? undefined);
  state.skinType = (data.get("skinType") as SkinType | null) ?? state.skinType;
  state.concern = (data.get("concern") as Concern | null) ?? state.concern;
  state.history = (data.get("history") as History | null) ?? state.history;
  state.budget = (data.get("budget") as Budget | null) ?? state.budget;
  state.goal = (data.get("goal") as Goal | null) ?? state.goal;
}

function buildLeadSuffix(): string {
  if (!leadForm) return "";

  const data = new FormData(leadForm);
  const name = String(data.get("customerName") ?? "").trim();
  const contact = String(data.get("customerContact") ?? "").trim();
  const note = String(data.get("customerNote") ?? "").trim();
  const rows = [
    name ? `Tên/Facebook: ${name}` : "",
    contact ? `SĐT/Zalo: ${contact}` : "",
    note ? `Ghi chú: ${note}` : "",
  ].filter(Boolean);

  return rows.length ? `\n\nThông tin thêm:\n${rows.join("\n")}` : "";
}

function updateProgress(): void {
  if (!progressFill) return;

  const completed = questions.filter((question) => Boolean(state[question.key])).length;
  progressFill.style.width = `${(completed / questions.length) * 100}%`;
}

function showResult(): void {
  readAnswers();
  if (!isComplete(state)) return;

  const result = buildConsultationResult(state);
  const message = `${createMessengerText(state, result)}${buildLeadSuffix()}`;
  const encoded = encodeURIComponent(message);

  if (resultTitle) resultTitle.textContent = result.title;
  if (resultNote) resultNote.textContent = `${result.priceRange}. ${result.note}`;
  if (resultCode) resultCode.textContent = result.code;
  if (resultFit) resultFit.textContent = result.fitLevel;
  if (resultReasons) {
    resultReasons.innerHTML = result.reasons.map((reason) => `<li>${reason}</li>`).join("");
  }
  if (routineAm) routineAm.textContent = result.morning.join(" + ");
  if (routinePm) routinePm.textContent = result.evening.join(" + ");
  if (resultFollowups) {
    resultFollowups.innerHTML = result.followUpQuestions.map((question) => `<li>${question}</li>`).join("");
  }
  if (messengerLink) messengerLink.href = `https://m.me/PhungHa29?text=${encoded}`;
  if (copyButton) {
    copyButton.dataset.message = message;
    copyButton.textContent = "Copy mã tư vấn";
  }
}

renderQuestions();
updateProgress();
showResult();

questionList?.addEventListener("change", () => {
  readAnswers();
  updateProgress();
});

quizForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  showResult();
  document.querySelector("#result-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

resetButton?.addEventListener("click", () => {
  state.concern = "melasma";
  state.skinType = "oily";
  state.history = "beginner";
  state.budget = "mid";
  state.goal = "brightening";
  renderQuestions();
  updateProgress();
  showResult();
});

leadForm?.addEventListener("input", showResult);

copyButton?.addEventListener("click", async () => {
  const message = copyButton.dataset.message ?? "";
  if (!message) return;

  await navigator.clipboard.writeText(message);
  copyButton.textContent = "Đã copy";
});

document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const target = document.querySelector(anchor.getAttribute("href") ?? "");
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
