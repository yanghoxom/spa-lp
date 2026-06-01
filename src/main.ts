import "./styles.css";
import { getVisibleQuestionKeys } from "./questionFlow";
import {
  type QuizAnswers,
  buildConsultationResult,
} from "./quiz";

type Question<T extends keyof QuizAnswers> = {
  key: T;
  title: string;
  options: Array<{ value: QuizAnswers[T]; label: string; hint: string }>;
};

type QuestionKey = keyof QuizAnswers;

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
      { value: "unknown", label: "Chưa rõ", hint: "Hà sẽ hỏi thêm" },
    ],
  },
  {
    key: "history",
    title: "Hiện da bạn đang ở tình trạng nào?",
    options: [
      { value: "healthy", label: "Đang khỏe", hint: "Muốn chăm đều hơn" },
      { value: "sensitive", label: "Dễ kích ứng", hint: "Cần phục hồi trước" },
      { value: "active", label: "Đang dùng sản phẩm đặc trị", hint: "Cần kiểm tra kỹ" },
      { value: "beginner", label: "Mới bắt đầu chăm da", hint: "Cần cách dùng dễ hiểu" },
      { value: "used-many", label: "Đã dùng nhiều nhưng chưa hợp", hint: "Sợ da quá tải" },
    ],
  },
  {
    key: "budget",
    title: "Ngân sách bạn muốn bắt đầu?",
    options: [
      { value: "low", label: "Dưới 300k", hint: "Bắt đầu nhẹ nhàng" },
      { value: "mid", label: "300k - 700k", hint: "Đủ bước nền tảng" },
      { value: "upper", label: "700k - 1 triệu", hint: "Chăm kỹ hơn" },
      { value: "premium", label: "Trên 1 triệu", hint: "Combo đầy đủ hơn" },
    ],
  },
  {
    key: "goal",
    title: "Bạn muốn chăm da theo hướng nào?",
    options: [
      { value: "simple", label: "Đơn giản dễ dùng", hint: "Ít bước, dễ duy trì" },
      { value: "safe", label: "Phục hồi an toàn", hint: "Dịu nhẹ, theo dõi kỹ" },
      { value: "brightening", label: "Dưỡng sáng đều màu", hint: "Tập trung nám/sạm/xỉn" },
      { value: "glow", label: "Căng bóng chuẩn Hàn", hint: "Nền da mướt hơn" },
      { value: "complete", label: "Combo đầy đủ", hint: "Chăm kỹ sáng và tối" },
    ],
  },
];

const state: Partial<QuizAnswers> = {};
const questionKeys = questions.map((question) => question.key);

const questionList = document.querySelector<HTMLDivElement>("#question-list");
const quizForm = document.querySelector<HTMLFormElement>("#quiz-form");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-quiz");
const progressFill = document.querySelector<HTMLSpanElement>("#progress-fill");
const questionProgress = document.querySelector<HTMLParagraphElement>("#question-progress");
const selectedSummary = document.querySelector<HTMLDivElement>("#selected-summary");
const resultCard = document.querySelector<HTMLElement>("#result-card");
const resultTitle = document.querySelector<HTMLHeadingElement>("#result-title");
const resultNote = document.querySelector<HTMLParagraphElement>("#result-note");
const resultCode = document.querySelector<HTMLDivElement>("#result-code");
const resultFit = document.querySelector<HTMLElement>("#result-fit");
const resultReasons = document.querySelector<HTMLUListElement>("#result-reasons");
const careMorning = document.querySelector<HTMLSpanElement>("#care-morning");
const careEvening = document.querySelector<HTMLSpanElement>("#care-evening");
const resultFollowups = document.querySelector<HTMLUListElement>("#result-followups");
const messengerLink = document.querySelector<HTMLAnchorElement>("#messenger-link");

function isComplete(answers: Partial<QuizAnswers>): answers is QuizAnswers {
  return questions.every((question) => Boolean(answers[question.key]));
}

function setAnswer<Key extends QuestionKey>(key: Key, value: QuizAnswers[Key]): void {
  state[key] = value;
}

function renderQuestions(): void {
  if (!questionList) return;

  const visibleKeys = getVisibleQuestionKeys(questionKeys, state);
  const visibleQuestions = questions.filter((question) => visibleKeys.includes(question.key));

  questionList.innerHTML = visibleQuestions.length
    ? visibleQuestions
        .map((question) => {
          const stepNumber = questions.findIndex((item) => item.key === question.key) + 1;
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
              <legend><span>0${stepNumber}</span>${question.title}</legend>
              <div class="option-grid">${options}</div>
            </fieldset>
          `;
        })
        .join("")
    : "";
}

function updateProgress(): void {
  const completed = questions.filter((question) => Boolean(state[question.key])).length;

  if (progressFill) progressFill.style.width = `${(completed / questions.length) * 100}%`;
  if (questionProgress) {
    questionProgress.textContent =
      completed >= questions.length ? "Đã trả lời 5/5" : `Câu ${completed + 1}/${questions.length}`;
  }
  if (selectedSummary) {
    const selected = questions
      .filter((question) => state[question.key])
      .map((question) => {
        const option = question.options.find((item) => item.value === state[question.key]);
        return option ? `<span>${option.label}</span>` : "";
      })
      .filter(Boolean);

    selectedSummary.innerHTML = selected.length ? selected.join("") : "";
  }
}

function buildMessengerMessage(answers: QuizAnswers, code: string): string {
  const labels: Array<[string, string]> = [
    ["Đang quan tâm", questions[0].options.find((o) => o.value === answers.concern)?.label ?? ""],
    ["Da thuộc loại", questions[1].options.find((o) => o.value === answers.skinType)?.label ?? ""],
    ["Tình trạng", questions[2].options.find((o) => o.value === answers.history)?.label ?? ""],
    ["Ngân sách", questions[3].options.find((o) => o.value === answers.budget)?.label ?? ""],
    ["Hướng chăm da", questions[4].options.find((o) => o.value === answers.goal)?.label ?? ""],
  ];
  return [...labels.map(([key, val]) => `${key}: ${val}`), `SP gợi ý: ${code}`].join("\n");
}

function showResult(): void {
  if (!isComplete(state)) return;

  const result = buildConsultationResult(state);
  const message = buildMessengerMessage(state, result.code);
  const encoded = encodeURIComponent(message);

  if (resultTitle) resultTitle.textContent = result.title;
  if (resultNote) {
    resultNote.innerHTML = `
      <span><strong>Giá tham khảo:</strong> ${result.priceRange}</span>
      <span>${result.note}</span>
    `;
  }
  if (resultCode) resultCode.textContent = result.code;
  if (resultFit) resultFit.textContent = result.fitLevel;
  if (resultReasons) {
    resultReasons.innerHTML = result.reasons.map((reason) => `<li>${reason}</li>`).join("");
  }
  if (careMorning) careMorning.textContent = result.morning.join(" + ");
  if (careEvening) careEvening.textContent = result.evening.join(" + ");
  if (resultFollowups) {
    resultFollowups.innerHTML = result.followUpQuestions.map((question) => `<li>${question}</li>`).join("");
  }
  if (messengerLink) messengerLink.href = `https://m.me/PhungHa29?text=${encoded}`;
  resultCard?.classList.remove("is-hidden");
}

renderQuestions();
updateProgress();

questionList?.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "radio") return;

  const question = questions.find((item) => item.key === input.name);
  const option = question?.options.find((item) => item.value === input.value);
  if (!question || !option) return;

  setAnswer(question.key, option.value);
  renderQuestions();
  updateProgress();

  if (isComplete(state)) {
    showResult();
    resultCard?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

quizForm?.addEventListener("submit", (event) => {
  event.preventDefault();
});

resetButton?.addEventListener("click", () => {
  questions.forEach((question) => {
    delete state[question.key];
  });
  resultCard?.classList.add("is-hidden");
  renderQuestions();
  updateProgress();
});

document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const target = document.querySelector(anchor.getAttribute("href") ?? "");
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
