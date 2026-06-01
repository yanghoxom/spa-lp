export function getVisibleQuestionKeys<T extends string>(
  questionKeys: readonly T[],
  answers: Partial<Record<T, unknown>>,
): T[] {
  const nextQuestion = questionKeys.find((key) => !answers[key]);

  return nextQuestion ? [nextQuestion] : [];
}
