/**
 * Runs `task` again after each delay while it throws an error `shouldRetry` accepts.
 * The last error is rethrown. Several slips sent at once can briefly hit rate limits
 * on Telegram, Drive, Gemini or the database; a short wait usually clears them.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  options: { delaysMs?: readonly number[]; shouldRetry?: (error: unknown) => boolean } = {},
): Promise<T> {
  const delays = options.delaysMs ?? [1000, 3000];
  const shouldRetry = options.shouldRetry ?? (() => true);
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= delays.length || !shouldRetry(error)) throw error;
      // Jitter keeps parallel uploads from retrying in lockstep.
      const delay = delays[attempt];
      await new Promise((resolve) => setTimeout(resolve, delay > 0 ? delay + Math.random() * delay * 0.5 : 0));
    }
  }
}

/** A short description for logs: the error name plus its message, with no request details. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  const code = (error as { code?: unknown }).code;
  const parts = [error.name, typeof code === "string" ? code : null, error.message.split("\n")[0].slice(0, 160)];
  return parts.filter(Boolean).join(" ");
}
