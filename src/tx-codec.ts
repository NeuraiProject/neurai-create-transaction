import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, compactSize, concatBytes, ensureHex, hexToBytes, reverseBytes, u32LE, u64LE } from './bytes.js';
import type { SerializedTxOutput } from './types.js';

// Hard deserialization bound, mirroring the node (serialize.h MAX_SIZE):
// ReadCompactSize rejects anything above it, canonical or not.
const MAX_SIZE = 0x02000000;

export interface DecodedTxInput {
  /** Transaction id in display order (big-endian hex, as RPC shows it). */
  txid: string;
  vout: number;
  scriptSigHex: string;
  sequence: number;
  /** Witness stack, one hex string per element. Absent/empty = no witness. */
  witness?: string[];
}

/** NIP-014 reference input: a COutPoint (36 bytes) with no script or witness. */
export interface RefInput {
  txid: string;
  vout: number;
}

export interface DecodedTransaction {
  version: number;
  inputs: DecodedTxInput[];
  outputs: SerializedTxOutput[];
  /** Always present after parsing; only serialized when version === 3. */
  vrefin: RefInput[];
  locktime: number;
}

export interface TransactionSizes {
  /** Full serialized size, witness included. */
  size: number;
  /** Serialized size without witness data (the txid serialization). */
  strippedSize: number;
  /** strippedSize * 3 + size (consensus/validation.h). */
  weight: number;
  /** ceil(weight / 4). */
  vsize: number;
}

function hash256(bytes: Uint8Array): Uint8Array {
  return sha256(sha256(bytes));
}

class ByteReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  private need(count: number): void {
    if (count > this.bytes.length - this.offset) {
      throw new Error(
        `Transaction hex truncated: need ${count} more byte(s) at offset ${this.offset}, ` +
          `${this.bytes.length - this.offset} remaining`
      );
    }
  }

  readBytes(count: number): Uint8Array {
    this.need(count);
    const slice = this.bytes.subarray(this.offset, this.offset + count);
    this.offset += count;
    return slice;
  }

  readU8(): number {
    return this.readBytes(1)[0];
  }

  readU32(): number {
    const slice = this.readBytes(4);
    return (slice[0] | (slice[1] << 8) | (slice[2] << 16) | (slice[3] << 24)) >>> 0;
  }

  readU64(): bigint {
    const slice = this.readBytes(8);
    let value = 0n;
    for (let i = 7; i >= 0; i -= 1) {
      value = (value << 8n) | BigInt(slice[i]);
    }
    return value;
  }

  // Canonical CompactSize with the node's range bound: the shortest encoding
  // is mandatory and anything above MAX_SIZE throws, exactly like
  // ReadCompactSize. Lengths are validated against the remaining bytes by the
  // callers BEFORE any allocation or iteration.
  readCompactSize(): number {
    const first = this.readU8();
    let value: number;
    if (first < 0xfd) {
      value = first;
    } else if (first === 0xfd) {
      const slice = this.readBytes(2);
      value = slice[0] | (slice[1] << 8);
      if (value < 0xfd) throw new Error('Non-canonical CompactSize (0xfd form for value < 253)');
    } else if (first === 0xfe) {
      value = this.readU32();
      if (value < 0x10000) throw new Error('Non-canonical CompactSize (0xfe form for value < 0x10000)');
    } else {
      const big = this.readU64();
      if (big < 0x100000000n) throw new Error('Non-canonical CompactSize (0xff form for value < 2^32)');
      if (big > BigInt(MAX_SIZE)) throw new Error(`CompactSize exceeds MAX_SIZE: ${big}`);
      value = Number(big);
    }
    if (value > MAX_SIZE) {
      throw new Error(`CompactSize exceeds MAX_SIZE: ${value}`);
    }
    return value;
  }

  /** Read a length prefix that must fit in the remaining bytes at `bytesPerItem`. */
  readCount(bytesPerItem: number, label: string): number {
    const count = this.readCompactSize();
    if (count * bytesPerItem > this.bytes.length - this.offset) {
      throw new Error(
        `Declared ${label} count ${count} does not fit in the remaining ` +
          `${this.bytes.length - this.offset} byte(s)`
      );
    }
    return count;
  }

  get finished(): boolean {
    return this.offset === this.bytes.length;
  }

  get position(): number {
    return this.offset;
  }
}

function readOutpoint(reader: ByteReader): RefInput {
  const txid = bytesToHex(reverseBytes(reader.readBytes(32)));
  const vout = reader.readU32();
  return { txid, vout };
}

function readInput(reader: ByteReader): DecodedTxInput {
  const { txid, vout } = readOutpoint(reader);
  const scriptLength = reader.readCount(1, 'scriptSig');
  const scriptSigHex = bytesToHex(reader.readBytes(scriptLength));
  const sequence = reader.readU32();
  return { txid, vout, scriptSigHex, sequence };
}

function readOutput(reader: ByteReader): SerializedTxOutput {
  const valueSats = reader.readU64();
  const scriptLength = reader.readCount(1, 'scriptPubKey');
  const scriptPubKeyHex = bytesToHex(reader.readBytes(scriptLength));
  return { valueSats, scriptPubKeyHex };
}

// Minimum serialized size per item, used only to bound counts before reading:
// input = outpoint(36) + compactSize(1) + sequence(4); output = value(8) +
// compactSize(1); witness element = compactSize(1).
const MIN_INPUT_SIZE = 41;
const MIN_OUTPUT_SIZE = 9;

export function parseTransaction(hex: string): DecodedTransaction {
  const reader = new ByteReader(hexToBytes(ensureHex(hex, 'transaction hex')));

  // nVersion is a signed int32 (negative versions exist on-chain historically).
  const version = reader.readU32() | 0;

  const inputs: DecodedTxInput[] = [];
  const outputs: SerializedTxOutput[] = [];
  let flags = 0;

  const vinCount = reader.readCount(MIN_INPUT_SIZE, 'input');
  if (vinCount === 0) {
    // Either a dummy marker for the extended (witness) format, or a genuinely
    // empty vin. Mirrors UnserializeTransaction: a flags byte follows; when it
    // is non-zero the real vin/vout follow, when zero the vout is NOT read.
    flags = reader.readU8();
    if (flags !== 0) {
      const realVinCount = reader.readCount(MIN_INPUT_SIZE, 'input');
      for (let i = 0; i < realVinCount; i += 1) inputs.push(readInput(reader));
      const voutCount = reader.readCount(MIN_OUTPUT_SIZE, 'output');
      for (let i = 0; i < voutCount; i += 1) outputs.push(readOutput(reader));
    }
  } else {
    for (let i = 0; i < vinCount; i += 1) inputs.push(readInput(reader));
    const voutCount = reader.readCount(MIN_OUTPUT_SIZE, 'output');
    for (let i = 0; i < voutCount; i += 1) outputs.push(readOutput(reader));
  }

  // NIP-014: vrefin sits between vout and witness, v3 only (even when empty).
  const vrefin: RefInput[] = [];
  if (version === 3) {
    const refCount = reader.readCount(36, 'refinput');
    for (let i = 0; i < refCount; i += 1) vrefin.push(readOutpoint(reader));
  }

  if (flags & 1) {
    flags ^= 1;
    for (const input of inputs) {
      const stackSize = reader.readCount(1, 'witness element');
      const stack: string[] = [];
      for (let i = 0; i < stackSize; i += 1) {
        const elementLength = reader.readCount(1, 'witness bytes');
        stack.push(bytesToHex(reader.readBytes(elementLength)));
      }
      input.witness = stack;
    }
  }
  if (flags) {
    throw new Error(`Unknown transaction optional data (flags 0x${flags.toString(16)})`);
  }

  const locktime = reader.readU32();

  if (!reader.finished) {
    throw new Error(`Trailing bytes after transaction (offset ${reader.position})`);
  }

  return { version, inputs, outputs, vrefin, locktime };
}

function serializeOutpoint(ref: RefInput): Uint8Array {
  const txid = hexToBytes(ensureHex(ref.txid, 'txid'));
  if (txid.length !== 32) {
    throw new Error(`Invalid txid: expected 32 bytes, got ${txid.length}`);
  }
  return concatBytes(reverseBytes(txid), u32LE(ref.vout));
}

function serializeCodecInput(input: DecodedTxInput): Uint8Array {
  const scriptSig = hexToBytes(ensureHex(input.scriptSigHex ?? '', 'scriptSigHex'));
  return concatBytes(
    serializeOutpoint(input),
    compactSize(scriptSig.length),
    scriptSig,
    u32LE(input.sequence ?? 0xffffffff)
  );
}

function serializeCodecOutput(output: SerializedTxOutput): Uint8Array {
  const script = hexToBytes(ensureHex(output.scriptPubKeyHex, 'scriptPubKeyHex'));
  return concatBytes(u64LE(output.valueSats), compactSize(script.length), script);
}

function inputHasWitness(input: DecodedTxInput): boolean {
  return (input.witness?.length ?? 0) > 0;
}

export interface SerializeTransactionOptions {
  /**
   * false forces the stripped (no-witness) form that feeds the txid. true (the
   * default) keeps node parity: the extended marker/flags format is only
   * emitted when at least one input carries a non-empty witness stack — it is
   * never forced onto a witness-less transaction.
   */
  includeWitness?: boolean;
}

export function serializeTransaction(
  tx: DecodedTransaction,
  options: SerializeTransactionOptions = {}
): string {
  if (!Number.isInteger(tx.version) || tx.version < -0x80000000 || tx.version > 0x7fffffff) {
    throw new Error(`Transaction version out of int32 range: ${tx.version}`);
  }
  const vrefin = tx.vrefin ?? [];
  if (tx.version !== 3 && vrefin.length > 0) {
    throw new Error(`vrefin requires transaction version 3 (got version ${tx.version})`);
  }

  const withWitness = (options.includeWitness ?? true) && tx.inputs.some(inputHasWitness);

  const parts: Uint8Array[] = [u32LE(tx.version >>> 0)];
  if (withWitness) {
    // Extended format: dummy empty vin + flags byte.
    parts.push(Uint8Array.of(0x00, 0x01));
  }
  parts.push(compactSize(tx.inputs.length));
  for (const input of tx.inputs) parts.push(serializeCodecInput(input));
  parts.push(compactSize(tx.outputs.length));
  for (const output of tx.outputs) parts.push(serializeCodecOutput(output));

  if (tx.version === 3) {
    parts.push(compactSize(vrefin.length));
    for (const ref of vrefin) parts.push(serializeOutpoint(ref));
  }

  if (withWitness) {
    // One stack per input, empty (CompactSize 0) where the input has none.
    for (const input of tx.inputs) {
      const stack = input.witness ?? [];
      parts.push(compactSize(stack.length));
      for (const element of stack) {
        const bytes = hexToBytes(ensureHex(element, 'witness element'));
        parts.push(compactSize(bytes.length), bytes);
      }
    }
  }

  parts.push(u32LE(tx.locktime));
  return bytesToHex(concatBytes(...parts));
}

function toDecoded(txOrHex: DecodedTransaction | string): DecodedTransaction {
  return typeof txOrHex === 'string' ? parseTransaction(txOrHex) : txOrHex;
}

export function computeTxid(txOrHex: DecodedTransaction | string): string {
  const stripped = serializeTransaction(toDecoded(txOrHex), { includeWitness: false });
  return bytesToHex(reverseBytes(hash256(hexToBytes(stripped))));
}

export function computeWtxid(txOrHex: DecodedTransaction | string): string {
  const full = serializeTransaction(toDecoded(txOrHex));
  return bytesToHex(reverseBytes(hash256(hexToBytes(full))));
}

export function estimateTransactionSize(txOrHex: DecodedTransaction | string): TransactionSizes {
  const tx = toDecoded(txOrHex);
  const size = serializeTransaction(tx).length / 2;
  const strippedSize = serializeTransaction(tx, { includeWitness: false }).length / 2;
  // consensus/validation.h: weight = stripped * (WITNESS_SCALE_FACTOR - 1) + total.
  const weight = strippedSize * 3 + size;
  return { size, strippedSize, weight, vsize: Math.ceil(weight / 4) };
}
