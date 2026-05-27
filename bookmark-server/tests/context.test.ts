import { describe, it, expect } from 'vitest';
import { runWithUser, getUserId } from '../src/context.js';

describe('userContext', () => {
  it('provides userId inside runWithUser', async () => {
    let captured = '';
    await runWithUser('user-123', async () => {
      captured = getUserId();
    });
    expect(captured).toBe('user-123');
  });

  it('throws outside runWithUser', () => {
    expect(() => getUserId()).toThrow('No user context');
  });
});
