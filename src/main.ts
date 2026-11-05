import "./styles.css";
import {
  type QuizAnswers,
  buildConsultationResult,
  createMessengerText,
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
      { value: "low", label: "Dưới 1 triệu", hint: "Gói Essential" },
      { value: "mid", label: "1 - 5 triệu", hint: "Gói Signature" },
      { value: "upper", label: "5 - 10 triệu", hint: "Gói Prestige" },
      { value: "premium", label: "Trên 10 triệu", hint: "Gói Royal" },
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

const questionList = document.querySelector<HTMLDivElement>("#question-list");
const quizForm = document.querySelector<HTMLFormElement>("#quiz-form");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-quiz");
const prevButton = document.querySelector<HTMLButtonElement>("#quiz-prev");
const nextButton = document.querySelector<HTMLButtonElement>("#quiz-next");
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
const copyButton = document.querySelector<HTMLButtonElement>("#copy-consultation");
const copyFeedback = document.querySelector<HTMLParagraphElement>("#copy-feedback");

let currentStep = 0;
let consultationMessage = "";

function isComplete(answers: Partial<QuizAnswers>): answers is QuizAnswers {
  return questions.every((question) => Boolean(answers[question.key]));
}

function setAnswer<Key extends QuestionKey>(key: Key, value: QuizAnswers[Key]): void {
  state[key] = value;
}

function renderQuestions(): void {
  if (!questionList) return;

  const question = questions[currentStep];
  if (!question) {
    questionList.innerHTML = "";
    return;
  }

  const stepNumber = currentStep + 1;
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

  questionList.innerHTML = `
    <fieldset class="question-block">
      <legend><span>0${stepNumber}</span>${question.title}</legend>
      <div class="option-grid">${options}</div>
    </fieldset>
  `;

  updateNavButtons();
}

function updateNavButtons(): void {
  if (prevButton) prevButton.disabled = currentStep === 0;
  if (nextButton) {
    const canGoNext = currentStep < questions.length - 1 && Boolean(state[questions[currentStep].key]);
    nextButton.disabled = !canGoNext;
  }
}

function updateProgress(): void {
  const completed = questions.filter((question) => Boolean(state[question.key])).length;

  if (progressFill) progressFill.style.width = `${(completed / questions.length) * 100}%`;
  if (questionProgress) {
    questionProgress.textContent =
      completed >= questions.length && currentStep === questions.length - 1 ? "Đã trả lời 5/5" : `Câu ${currentStep + 1}/${questions.length}`;
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

function showResult(): void {
  if (!isComplete(state)) return;

  const result = buildConsultationResult(state);
  consultationMessage = createMessengerText(state, result);

  if (resultTitle) resultTitle.textContent = result.title;
  if (resultNote) {
    resultNote.innerHTML = `
      <span><strong>Ngân sách bạn đã chọn:</strong> ${result.priceRange}</span>
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
  if (messengerLink) messengerLink.href = "https://m.me/PhungHa29";
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
  updateProgress();

  renderQuestions();
  updateProgress();
  if (isComplete(state)) {
    showResult();
    resultCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});

quizForm?.addEventListener("submit", (event) => {
  event.preventDefault();
});

prevButton?.addEventListener("click", () => {
  if (currentStep > 0) {
    currentStep--;
    renderQuestions();
    updateProgress();
  }
});

nextButton?.addEventListener("click", () => {
  if (currentStep < questions.length - 1 && state[questions[currentStep].key]) {
    currentStep++;
    renderQuestions();
    updateProgress();
  }
});

resetButton?.addEventListener("click", () => {
  questions.forEach((question) => {
    delete state[question.key];
  });
  currentStep = 0;
  consultationMessage = "";
  resultCard?.classList.add("is-hidden");
  if (copyFeedback) copyFeedback.textContent = "Sao chép kết quả rồi dán vào Messenger để Hà nắm thông tin. Website không lưu câu trả lời trên máy chủ.";
  renderQuestions();
  updateProgress();
});

copyButton?.addEventListener("click", async () => {
  if (!consultationMessage) return;
  let copied = false;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(consultationMessage);
    copied = true;
  } catch {
    const field = document.createElement("textarea");
    field.value = consultationMessage;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;top:-9999px;left:-9999px";
    document.body.append(field);
    field.select();
    copied = document.execCommand("copy");
    field.remove();
  }
  if (copyFeedback) {
    copyFeedback.textContent = copied
      ? "Đã sao chép. Hãy mở Messenger và dán kết quả để Hà có thông tin tư vấn."
      : "Trình duyệt không thể sao chép tự động. Hãy nhắn cho Hà trực tiếp qua Messenger.";
  }
});

document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const target = document.querySelector(anchor.getAttribute("href") ?? "");
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
