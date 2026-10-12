/** Throws an Error with `message` when `condition` is falsy. Narrows the condition type. */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Exhaustiveness helper for discriminated unions. */
export function unreachable(value: never, context = 'valeur inattendue'): never {
  throw new Error(`${context} : ${JSON.stringify(value)}`);
}

/** Formats any thrown value as an Error (never swallows the original information). */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : JSON.stringify(err));
}
