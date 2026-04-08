import { describe, expect, it } from 'vitest';
import {
  asciiBytes,
  bytesToHex,
  compactSize,
  concatBytes,
  ensureHex,
  hexToBytes,
  i64LE,
  pushData,
  reverseBytes,
  serializeString,
  u32LE,
  u64LE
} from '../src/bytes.js';

describe('bytes', () => {
  it('normalizes valid hex and rejects invalid hex', () => {
    expect(ensureHex('A0ff')).toBe('a0ff');
    expect(() => ensureHex('xyz')).toThrow(/Invalid hex/);
    expect(() => ensureHex('abc')).toThrow(/even-length/);
  });

  it('converts between hex and bytes', () => {
    const bytes = hexToBytes('deadbeef');
    expect(Array.from(bytes)).toEqual([0xde, 0xad, 0xbe, 0xef]);
    expect(bytesToHex(bytes)).toBe('deadbeef');
  });

  it('concatenates and reverses bytes', () => {
    const joined = concatBytes(Uint8Array.of(1, 2), Uint8Array.of(3, 4));
    expect(Array.from(joined)).toEqual([1, 2, 3, 4]);
    expect(Array.from(reverseBytes(joined))).toEqual([4, 3, 2, 1]);
  });

  it('serializes ASCII strings with CompactSize length', () => {
    expect(bytesToHex(asciiBytes('XNA'))).toBe('584e41');
    expect(bytesToHex(serializeString('XNA'))).toBe('03584e41');
  });

  it('encodes integers in little endian', () => {
    expect(bytesToHex(u32LE(513))).toBe('01020000');
    expect(bytesToHex(u64LE(5000))).toBe('8813000000000000');
    expect(bytesToHex(i64LE(-1))).toBe('ffffffffffffffff');
  });

  it('encodes CompactSize values', () => {
    expect(bytesToHex(compactSize(252))).toBe('fc');
    expect(bytesToHex(compactSize(253))).toBe('fdfd00');
    expect(bytesToHex(compactSize(65536))).toBe('fe00000100');
  });

  it('encodes pushdata payloads', () => {
    expect(bytesToHex(pushData(Uint8Array.of(0xaa, 0xbb)))).toBe('02aabb');
    expect(bytesToHex(pushData(new Uint8Array(80)))).toMatch(/^4c50/);
  });
});
