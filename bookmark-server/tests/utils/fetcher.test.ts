import { describe, it, expect } from 'vitest';
import { fetchAndParse } from '../../src/utils/fetcher.js';

describe('fetchAndParse', () => {
  it('extracts title and text from a URL', async () => {
    const result = await fetchAndParse('https://example.com');
    expect(result.title).toBeTruthy();
    expect(result.content).toBeTruthy();
    expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(0);
  }, 15_000);

  it('returns empty strings for unreachable URL without throwing', async () => {
    const result = await fetchAndParse('http://localhost:19999/nonexistent');
    expect(result.title).toBe('');
    expect(result.content).toBe('');
    expect(result.error).toBeTruthy();
  }, 10_000);
});
