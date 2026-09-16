/** Exact monetary primitives. This module has no runtime dependencies. */
export const SATS_PER_XNA = 100000000n;
export const MAX_MONEY = 2100000000000000000n;
export type RawAmount = bigint | string | number;
export type DecimalAmount = string | number;

/** Normalize a raw integer without preserving an already rounded number. */
export function toRawInteger(value: RawAmount, label = 'amount'): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value) && value.length <= 100) return BigInt(value);
  throw new Error(`${label}: expected an exact integer; use bigint or an integer string for large values`);
}

export function assertMoneyRange(value: RawAmount, label = 'amount'): bigint {
  const raw = toRawInteger(value, label);
  if (raw < 0n || raw > MAX_MONEY) throw new Error(`${label} outside Neurai monetary range`);
  return raw;
}

/** Parse decimal units exactly, including scientific notation, with at most 8 decimals. */
export function decimalToSatoshis(value: DecimalAmount): bigint {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Expected decimal string or number');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Amount must be finite');
  const text = String(value);
  if (text.length > 100) throw new Error('Amount too long');
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) throw new Error('Invalid decimal amount');
  const exponent = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) throw new Error('Invalid decimal exponent');
  const fraction = match[3] ?? '';
  const shift = 8 + exponent - fraction.length;
  let raw = BigInt(match[2] + fraction);
  if (shift >= 0) raw *= 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    if (raw % divisor !== 0n) throw new Error('Amount has more than 8 decimals');
    raw /= divisor;
  }
  if (typeof value === 'number' && raw > BigInt(Number.MAX_SAFE_INTEGER) && !Number.isSafeInteger(value)) {
    throw new Error('Large fractional amounts must be supplied as decimal strings');
  }
  return match[1] ? -raw : raw;
}

/** Format signed raw units without converting to floating point. */
export function satoshisToDecimal(value: RawAmount): string {
  const raw = toRawInteger(value);
  const abs = raw < 0n ? -raw : raw;
  const fraction = (abs % SATS_PER_XNA).toString().padStart(8, '0').replace(/0+$/, '');
  return `${raw < 0n ? '-' : ''}${abs / SATS_PER_XNA}${fraction ? '.' + fraction : ''}`;
}
