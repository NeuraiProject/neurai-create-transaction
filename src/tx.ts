import { compactSize, concatBytes, ensureHex, hexToBytes, reverseBytes, u32LE, u64LE } from './bytes.js';
import type { SerializedTxOutput, TxInput, UnsignedTransaction } from './types.js';

export function serializeInput(input: TxInput): Uint8Array {
  const txidBytes = reverseBytes(hexToBytes(input.txid));
  const scriptSig = input.scriptSigHex ? hexToBytes(input.scriptSigHex) : new Uint8Array();

  return concatBytes(
    txidBytes,
    u32LE(input.vout),
    compactSize(scriptSig.length),
    scriptSig,
    u32LE(input.sequence ?? 0xffffffff)
  );
}

export function serializeOutput(output: SerializedTxOutput): Uint8Array {
  const scriptPubKey = hexToBytes(ensureHex(output.scriptPubKeyHex, 'scriptPubKeyHex'));
  return concatBytes(
    u64LE(output.valueSats),
    compactSize(scriptPubKey.length),
    scriptPubKey
  );
}

export function createUnsignedTransaction(tx: UnsignedTransaction): string {
  const version = tx.version ?? 2;
  const locktime = tx.locktime ?? 0;

  const inputs = tx.inputs.map(serializeInput);
  const outputs = tx.outputs.map(serializeOutput);

  const bytes = concatBytes(
    u32LE(version),
    compactSize(inputs.length),
    ...inputs,
    compactSize(outputs.length),
    ...outputs,
    u32LE(locktime)
  );

  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}
