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
    title: "Chị muốn cải thiện điều gì nhất ở làn da?",
    options: [
      { value: "melasma", label: "Nám, sạm da", hint: "Có đốm hoặc mảng sẫm màu" },
      { value: "acne", label: "Mụn và vết thâm", hint: "Mụn ẩn, thâm sau mụn" },
      { value: "dull", label: "Da xỉn màu", hint: "Muốn da trông tươi tắn hơn" },
      { value: "pores", label: "Da dầu, lỗ chân lông", hint: "Dễ bóng dầu, bề mặt da sần" },
      { value: "aging", label: "Nếp nhăn, da kém săn", hint: "Muốn da trông mịn màng hơn" },
    ],
  },
  {
    key: "skinType",
    title: "Da chị thường như thế nào?",
    options: [
      { value: "oily", label: "Da dầu", hint: "Dễ bóng dầu, nhất là giữa ngày" },
      { value: "dry", label: "Da khô", hint: "Hay khô căng, đôi khi bong nhẹ" },
      { value: "combination", label: "Da hỗn hợp", hint: "Dầu ở trán, mũi; má thường khô" },
      { value: "sensitive", label: "Da nhạy cảm", hint: "Dễ đỏ, rát khi dùng mỹ phẩm" },
      { value: "unknown", label: "Chưa rõ loại da", hint: "Để Hà cùng chị tìm hiểu" },
    ],
  },
  {
    key: "history",
    title: "Gần đây, tình trạng da của chị ra sao?",
    options: [
      { value: "healthy", label: "Da đang ổn", hint: "Muốn chăm kỹ hơn mỗi ngày" },
      { value: "sensitive", label: "Dễ kích ứng", hint: "Hay đỏ, rát khi đổi mỹ phẩm" },
      { value: "active", label: "Đang dùng sản phẩm đặc trị", hint: "Cho Hà biết tên sản phẩm nhé" },
      { value: "beginner", label: "Mới bắt đầu chăm da", hint: "Muốn được hướng dẫn từng bước" },
      { value: "used-many", label: "Đã thử nhiều, chưa thấy hợp", hint: "Muốn Hà cùng xem lại cách chăm" },
    ],
  },
  {
    key: "budget",
    title: "Chị muốn chọn mỹ phẩm trong khoảng nào?",
    options: [
      { value: "low", label: "Dưới 500 nghìn", hint: "Chọn món cần thiết trước" },
      { value: "mid", label: "500 nghìn – 1 triệu", hint: "Chọn những bước cơ bản" },
      { value: "upper", label: "1 – 3 triệu", hint: "Chăm kỹ điều chị quan tâm" },
      { value: "premium", label: "Trên 3 triệu", hint: "Chọn từng món thật hợp với chị" },
    ],
  },
  {
    key: "goal",
    title: "Chị thích chăm da theo cách nào?",
    options: [
      { value: "simple", label: "Gọn nhẹ, dễ dùng", hint: "Ít bước, hợp ngày bận rộn" },
      { value: "safe", label: "Dưỡng dịu nhẹ, phục hồi", hint: "Theo dõi da qua từng bước" },
      { value: "brightening", label: "Dưỡng sáng, đều màu", hint: "Chăm vùng da sạm, xỉn màu" },
      { value: "glow", label: "Da ẩm mịn, căng mướt", hint: "Muốn vẻ rạng rỡ tự nhiên" },
      { value: "complete", label: "Chăm đủ bước sáng, tối", hint: "Nhờ Hà chọn bộ phù hợp" },
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

function renderQuestions(focusQuestion = false): void {
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
      <legend tabindex="-1"><span>0${stepNumber}</span>${question.title}</legend>
      <div class="option-grid">${options}</div>
    </fieldset>
  `;

  updateNavButtons();
  if (focusQuestion) questionList.querySelector<HTMLElement>("legend")?.focus({ preventScroll: true });
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
      completed >= questions.length && currentStep === questions.length - 1 ? "Chị đã trả lời đủ 5 câu" : `Câu ${currentStep + 1}/${questions.length}`;
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
      <span><strong>Khoảng tiền chị muốn dành:</strong> ${result.priceRange}</span>
      <span>${result.note}</span>
    `;
  }
  if (resultCode) resultCode.textContent = result.code;
  if (resultFit) resultFit.textContent = result.fitLevel === "Cần Hà kiểm tra thêm" ? "Hà cần hỏi thêm" : "Nhắn Hà để được tư vấn";
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
  resultCard?.closest(".quiz-grid")?.classList.add("has-result");
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
  updateNavButtons();
  updateProgress();
  if (isComplete(state)) {
    showResult();
    if (currentStep === questions.length - 1) {
      resultCard?.focus({ preventScroll: true });
      resultCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
});

quizForm?.addEventListener("submit", (event) => {
  event.preventDefault();
});

prevButton?.addEventListener("click", () => {
  if (currentStep > 0) {
    currentStep--;
    renderQuestions(true);
    updateProgress();
  }
});

nextButton?.addEventListener("click", () => {
  if (currentStep < questions.length - 1 && state[questions[currentStep].key]) {
    currentStep++;
    renderQuestions(true);
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
  resultCard?.closest(".quiz-grid")?.classList.remove("has-result");
  if (copyFeedback) copyFeedback.textContent = "Chị sao chép kết quả, mở Messenger rồi dán vào tin nhắn gửi Hà nhé. Website không lưu câu trả lời của chị.";
  renderQuestions(true);
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
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    field.remove();
  }
  if (copyFeedback) {
    copyFeedback.textContent = copied
      ? "Đã sao chép rồi chị nhé. Chị mở Messenger, dán kết quả vào tin nhắn rồi gửi Hà để được tư vấn thêm."
      : "Chưa sao chép được. Chị cứ mở Messenger, kể Hà nghe về làn da của mình nhé.";
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
