export class TimeoutError extends Error {}

export function comTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new TimeoutError(`Operação excedeu ${ms}ms`)), ms)
    }),
  ])
}
