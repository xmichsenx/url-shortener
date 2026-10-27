import { CODE_LENGTH, CODE_PATTERN, generateCode } from './code.js';

describe('generateCode', () => {
  it('returns a base62 code of the expected length', () => {
    const code = generateCode();
    expect(code).toHaveLength(CODE_LENGTH);
    expect(code).toMatch(CODE_PATTERN);
  });

  it('does not repeat codes across many draws', () => {
    const codes = new Set(Array.from({ length: 10_000 }, generateCode));
    expect(codes.size).toBe(10_000);
  });
});
