import { randomInt } from 'node:crypto';

const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// 62^7 ≈ 3.5 trillion combinations, so collisions stay rare for a long time.
export const CODE_LENGTH = 7;
export const CODE_PATTERN = /^[0-9A-Za-z]{7}$/;

// randomInt draws from a CSPRNG without modulo bias, so codes are evenly
// distributed and can't be predicted from earlier ones.
export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
