import { randomBytes, randomInt, createHash } from 'crypto';

const PASS_ALPHABET = '0123456789';

/** Human-readable event pass, printed on the QR card as `#KD-8492`. */
export function generatePassCode(): string {
  let digits = '';
  for (let i = 0; i < 4; i += 1) digits += PASS_ALPHABET[randomInt(PASS_ALPHABET.length)];
  return `KD-${digits}`;
}

export function generateNumericOtp(length: number): string {
  let code = '';
  for (let i = 0; i < length; i += 1) code += randomInt(10).toString();
  return code;
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 is correct for high-entropy tokens; passwords use argon2 instead. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
