import { describe, expect, it } from 'vitest';
import {
  computeTxid,
  computeWtxid,
  estimateTransactionSize,
  parseTransaction,
  serializeTransaction
} from '../src/index.js';
import type { DecodedTransaction } from '../src/index.js';
import { TX_CODEC_FIXTURES } from './fixtures/tx-codec.js';

const BASE = TX_CODEC_FIXTURES[0];

function baseTx(): DecodedTransaction {
  return parseTransaction(BASE.hex);
}

describe('tx-codec: node fixtures', () => {
  for (const fixture of TX_CODEC_FIXTURES) {
    it(`round-trips and matches node txid/hash/sizes: ${fixture.name}`, () => {
      const decoded = parseTransaction(fixture.hex);
      expect(decoded.version).toBe(fixture.version);
      expect(decoded.inputs).toHaveLength(fixture.vinCount);
      expect(decoded.outputs).toHaveLength(fixture.voutCount);

      expect(serializeTransaction(decoded)).toBe(fixture.hex);
      expect(computeTxid(fixture.hex)).toBe(fixture.txid);
      expect(computeWtxid(fixture.hex)).toBe(fixture.hash);

      const sizes = estimateTransactionSize(fixture.hex);
      expect(sizes.size).toBe(fixture.size);
      expect(sizes.vsize).toBe(fixture.vsize);
      expect(sizes.weight).toBe(sizes.strippedSize * 3 + sizes.size);
    });
  }

  it('reports witness stacks and vrefin contents faithfully', () => {
    const witness = parseTransaction(TX_CODEC_FIXTURES[1].hex);
    expect(witness.inputs[0].witness).toEqual(['aabbccdd', '']);
    expect(witness.inputs[1].witness).toEqual([]);

    const vrefin = parseTransaction(TX_CODEC_FIXTURES[3].hex);
    expect(vrefin.vrefin).toEqual([
      { txid: 'ab'.repeat(32), vout: 7 },
      { txid: 'cd'.repeat(32), vout: 0 }
    ]);
  });
});

describe('tx-codec: serialization invariants', () => {
  it('round-trips version -1 as signed int32', () => {
    const tx = { ...baseTx(), version: -1 };
    const hex = serializeTransaction(tx);
    expect(hex.startsWith('ffffffff')).toBe(true);
    expect(parseTransaction(hex).version).toBe(-1);
  });

  it('rejects non-empty vrefin outside version 3', () => {
    const tx = { ...baseTx(), vrefin: [{ txid: 'ab'.repeat(32), vout: 0 }] };
    expect(() => serializeTransaction(tx)).toThrow(/requires transaction version 3/);
  });

  it('never emits marker/flags without a non-empty witness stack', () => {
    const tx = baseTx();
    expect(serializeTransaction(tx, { includeWitness: true })).toBe(
      serializeTransaction(tx, { includeWitness: false })
    );

    const emptyStacks = {
      ...tx,
      inputs: tx.inputs.map((input) => ({ ...input, witness: [] }))
    };
    expect(serializeTransaction(emptyStacks, { includeWitness: true })).toBe(
      serializeTransaction(tx, { includeWitness: false })
    );
  });

  it('serializes vrefin with 65 refs as a single-byte CompactSize (no policy cap)', () => {
    const refs = Array.from({ length: 65 }, (_, i) => ({ txid: 'ab'.repeat(32), vout: i }));
    const tx = { ...baseTx(), version: 3, vrefin: refs };
    const hex = serializeTransaction(tx);
    const withoutRefs = serializeTransaction({ ...baseTx(), version: 3, vrefin: [] });
    // The empty-vrefin form ends with '00' + locktime; the 65-ref form must
    // encode the count as one byte 0x41 at the same offset.
    const countOffset = withoutRefs.length - 8 - 2;
    expect(hex.slice(countOffset, countOffset + 2)).toBe('41');
    expect(parseTransaction(hex).vrefin).toHaveLength(65);
    expect(computeTxid(hex)).toBe(computeWtxid(hex)); // still no witness
  });

  it('serializes vrefin with 253 refs as a 3-byte CompactSize (0xfd fd 00)', () => {
    const refs = Array.from({ length: 253 }, (_, i) => ({ txid: 'cd'.repeat(32), vout: i }));
    const tx = { ...baseTx(), version: 3, vrefin: refs };
    const hex = serializeTransaction(tx);
    const withoutRefs = serializeTransaction({ ...baseTx(), version: 3, vrefin: [] });
    const countOffset = withoutRefs.length - 8 - 2;
    expect(hex.slice(countOffset, countOffset + 6)).toBe('fdfd00');
    expect(parseTransaction(hex).vrefin).toHaveLength(253);

    const sizes = estimateTransactionSize(hex);
    expect(sizes.size).toBe(withoutRefs.length / 2 + 2 + 253 * 36);
    expect(sizes.strippedSize).toBe(sizes.size);
  });

  it('rejects out-of-range versions', () => {
    expect(() => serializeTransaction({ ...baseTx(), version: 0x80000000 })).toThrow(/int32/);
  });

  it('rejects outpoints whose txid is not exactly 32 bytes', () => {
    const tx = baseTx();
    tx.inputs[0].txid = 'ab';
    expect(() => serializeTransaction(tx)).toThrow(/expected 32 bytes/);
  });
});

describe('tx-codec: parser robustness', () => {
  it('rejects non-canonical CompactSize encodings', () => {
    // version 2 + vin count encoded as 0xfd 0x2a 0x00 (42 must be 1 byte)
    expect(() => parseTransaction('02000000fd2a00')).toThrow(/Non-canonical CompactSize/);
  });

  it('rejects CompactSize values above MAX_SIZE', () => {
    // 0xff form with value 2^32 (canonical for the form, above MAX_SIZE)
    expect(() => parseTransaction('02000000ff0000000001000000')).toThrow(/MAX_SIZE/);
  });

  it('rejects declared counts that cannot fit in the remaining bytes', () => {
    // claims 252 inputs with no bytes behind them — must throw before iterating
    expect(() => parseTransaction('02000000fc')).toThrow(/does not fit/);
  });

  it('rejects trailing bytes after locktime', () => {
    expect(() => parseTransaction(`${BASE.hex}aa`)).toThrow(/Trailing bytes/);
  });

  it('rejects unknown flags', () => {
    // version + dummy vin + flags 0x02 + empty vin/vout
    expect(() => parseTransaction('020000000002000000000000')).toThrow(/Unknown transaction optional data/);
  });

  it('rejects truncation in the middle of any field', () => {
    const hex = BASE.hex;
    for (const cut of [8, 10, 12, 80, hex.length - 2]) {
      expect(() => parseTransaction(hex.slice(0, cut))).toThrow(/truncated|does not fit/);
    }
  });
});
