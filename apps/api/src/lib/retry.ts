export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delayMs?: number;
    label?: string;
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? 15;
  const delayMs = options.delayMs ?? 2000;
  const label = options.label ?? "operation";

  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i === attempts) break;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[retry] ${label} attempt ${i}/${attempts} failed: ${msg}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
