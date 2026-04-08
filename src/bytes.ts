export function ensureHex(hex: string, label = 'hex'): string {
  const normalized = String(hex || '').trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error(`Invalid ${label}: expected even-length hex string`);
  }
  return normalized;
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = ensureHex(hex);
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function asciiBytes(text: string): Uint8Array {
  return Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0)));
}

export function serializeString(text: string): Uint8Array {
  const bytes = asciiBytes(text);
  return concatBytes(compactSize(bytes.length), bytes);
}

export function reverseBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(Array.from(bytes).reverse());
}

export function u32LE(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`uint32 out of range: ${value}`);
  }
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint32(0, value, true);
  return out;
}

export function u64LE(value: bigint | number): Uint8Array {
  const bigintValue = typeof value === 'bigint' ? value : BigInt(value);
  if (bigintValue < 0n || bigintValue > 0xffffffffffffffffn) {
    throw new Error(`uint64 out of range: ${bigintValue}`);
  }
  const out = new Uint8Array(8);
  let remaining = bigintValue;
  for (let i = 0; i < 8; i += 1) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
}

export function i64LE(value: bigint | number): Uint8Array {
  const bigintValue = typeof value === 'bigint' ? value : BigInt(value);
  if (bigintValue < -0x8000000000000000n || bigintValue > 0x7fffffffffffffffn) {
    throw new Error(`int64 out of range: ${bigintValue}`);
  }
  const out = new Uint8Array(8);
  const view = new DataView(out.buffer);
  view.setBigInt64(0, bigintValue, true);
  return out;
}

export function compactSize(value: bigint | number): Uint8Array {
  const bigintValue = typeof value === 'bigint' ? value : BigInt(value);
  if (bigintValue < 0n) throw new Error('CompactSize cannot encode negative numbers');

  if (bigintValue < 253n) {
    return Uint8Array.of(Number(bigintValue));
  }
  if (bigintValue <= 0xffffn) {
    return concatBytes(Uint8Array.of(0xfd), u16LE(Number(bigintValue)));
  }
  if (bigintValue <= 0xffffffffn) {
    return concatBytes(Uint8Array.of(0xfe), u32LE(Number(bigintValue)));
  }
  return concatBytes(Uint8Array.of(0xff), u64LE(bigintValue));
}

function u16LE(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`uint16 out of range: ${value}`);
  }
  const out = new Uint8Array(2);
  const view = new DataView(out.buffer);
  view.setUint16(0, value, true);
  return out;
}

export function pushData(data: Uint8Array): Uint8Array {
  if (data.length > 0xffff) {
    throw new Error(`Pushdata too large for current implementation: ${data.length} bytes`);
  }
  if (data.length < 0x4c) {
    return concatBytes(Uint8Array.of(data.length), data);
  }
  if (data.length <= 0xff) {
    return concatBytes(Uint8Array.of(0x4c, data.length), data);
  }
  return concatBytes(Uint8Array.of(0x4d), u16LE(data.length), data);
}
