import { AsyncLocalStorage } from 'async_hooks';

interface UserCtx {
  userId: string;
}

const storage = new AsyncLocalStorage<UserCtx>();

export function runWithUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ userId }, fn);
}

export function getUserId(): string {
  const ctx = storage.getStore();
  if (!ctx) throw new Error('No user context — tool called outside request handler');
  return ctx.userId;
}
