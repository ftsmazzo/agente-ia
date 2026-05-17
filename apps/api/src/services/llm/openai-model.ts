/** Modelos com tokens de raciocínio (GPT-5, o-series). */
export function isOpenAiReasoningModel(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.startsWith("gpt-5") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4")
  );
}

/**
 * GPT-5 precisa de orçamento alto: tokens de reasoning consomem o limite antes do texto visível.
 * @see https://developers.openai.com/api/docs/guides/reasoning
 */
export function resolveOpenAiMaxOutputTokens(
  model: string,
  requested: number,
): number {
  if (isOpenAiReasoningModel(model)) {
    const min = 2500;
    const max = 8000;
    const value =
      Number.isFinite(requested) && requested > 0 ? requested : min;
    return Math.min(Math.max(value, min), max);
  }

  const value =
    Number.isFinite(requested) && requested > 0 ? requested : 600;
  return Math.min(value, 4096);
}
