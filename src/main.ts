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
  Question<"skinType">,
  Question<"concern">,
  Question<"history">,
  Question<"budget">,
  Question<"goal">,
] = [
  {
    key: "skinType",
    title: "Da bạn thuộc loại nào?",
    options: [
      { value: "oily", label: "Da dầu", hint: "Dễ bóng, bí da" },
      { value: "dry", label: "Da khô", hint: "Căng, thiếu ẩm" },
      { value: "combination", label: "Hỗn hợp", hint: "Dầu vùng T" },
      { value: "sensitive", label: "Nhạy cảm", hint: "Dễ đỏ rát" },
      { value: "unknown", label: "Chưa rõ", hint: "Để shop lọc an toàn" },
    ],
  },
  {
    key: "concern",
    title: "Bạn muốn cải thiện điều gì nhất?",
    options: [
      { value: "melasma", label: "Nám/sạm", hint: "Da không đều màu" },
      { value: "acne", label: "Mụn/thâm", hint: "Mụn ẩn, thâm sau mụn" },
      { value: "dull", label: "Da xỉn", hint: "Muốn sáng mướt" },
      { value: "pores", label: "Lỗ chân lông", hint: "Bóng dầu, bề mặt sần" },
      { value: "aging", label: "Chống lão hóa", hint: "Build mặt, căng bóng" },
    ],
  },
  {
    key: "history",
    title: "Tình trạng dùng mỹ phẩm hiện tại?",
    options: [
      { value: "beginner", label: "Mới bắt đầu", hint: "Cần routine dễ hiểu" },
      { value: "used-many", label: "Đã dùng nhiều", hint: "Sợ da quá tải" },
      { value: "sensitive", label: "Dễ kích ứng", hint: "Cần phục hồi trước" },
      { value: "simple", label: "Muốn đơn giản", hint: "Ít bước, dễ theo" },
    ],
  },
  {
    key: "budget",
    title: "Ngân sách mong muốn?",
    options: [
      { value: "low", label: "Dưới 300k", hint: "Combo tối giản" },
      { value: "mid", label: "300k - 700k", hint: "Đủ bước nền tảng" },
      { value: "high", label: "Trên 700k", hint: "Routine đầy đủ hơn" },
    ],
  },
  {
    key: "goal",
    title: "Bạn muốn kết quả theo hướng nào?",
    options: [
      { value: "safe", label: "An toàn", hint: "Dịu nhẹ, theo dõi kỹ" },
      { value: "fast", label: "Nhanh gọn", hint: "Có thay đổi nhưng không gắt" },
      { value: "simple", label: "Tiết kiệm bước", hint: "Dễ duy trì mỗi ngày" },
      { value: "full", label: "Chuẩn Hàn", hint: "Căng bóng, chăm kỹ" },
    ],
  },
];

const state: Partial<QuizAnswers> = {
  skinType: "oily",
  concern: "melasma",
  history: "beginner",
  budget: "mid",
  goal: "safe",
};

const questionList = document.querySelector<HTMLDivElement>("#question-list");
const quizForm = document.querySelector<HTMLFormElement>("#quiz-form");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-quiz");
const progressFill = document.querySelector<HTMLSpanElement>("#progress-fill");
const resultTitle = document.querySelector<HTMLHeadingElement>("#result-title");
const resultNote = document.querySelector<HTMLParagraphElement>("#result-note");
const resultCode = document.querySelector<HTMLDivElement>("#result-code");
const resultReasons = document.querySelector<HTMLUListElement>("#result-reasons");
const routineAm = document.querySelector<HTMLSpanElement>("#routine-am");
const routinePm = document.querySelector<HTMLSpanElement>("#routine-pm");
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
  if (resultReasons) {
    resultReasons.innerHTML = result.reasons.map((reason) => `<li>${reason}</li>`).join("");
  }
  if (routineAm) routineAm.textContent = result.morning.join(" + ");
  if (routinePm) routinePm.textContent = result.evening.join(" + ");
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
  state.skinType = "oily";
  state.concern = "melasma";
  state.history = "beginner";
  state.budget = "mid";
  state.goal = "safe";
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
