import { describe, expect, it } from 'vitest';
import { bytesToHex } from '../src/bytes.js';
import { createXnaOutput } from '../src/assets.js';
import { createUnsignedTransaction, serializeInput, serializeOutput } from '../src/tx.js';

const LEGACY_TEST = 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA';

describe('tx', () => {
  it('serializes a raw input', () => {
    const input = serializeInput({
      txid: '11'.repeat(32),
      vout: 1
    });

    expect(bytesToHex(input)).toBe(
      `${'11'.repeat(32)}0100000000ffffffff`
    );
  });

  it('serializes a raw output', () => {
    const output = serializeOutput(createXnaOutput(LEGACY_TEST, 5000n));
    expect(bytesToHex(output)).toBe(
      '88130000000000001976a914e295c733ad2c8e92954d547603f9f63d99eae6c488ac'
    );
  });

  it('creates a deterministic unsigned payment transaction', () => {
    const raw = createUnsignedTransaction({
      version: 2,
      inputs: [{ txid: '11'.repeat(32), vout: 1 }],
      outputs: [createXnaOutput(LEGACY_TEST, 5000n)],
      locktime: 0
    });

    expect(raw).toBe(
      `0200000001${'11'.repeat(32)}0100000000ffffffff0188130000000000001976a914e295c733ad2c8e92954d547603f9f63d99eae6c488ac00000000`
    );
  });
});
