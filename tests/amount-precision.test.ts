import { describe, expect, it } from 'vitest';
import { createPaymentTransaction, encodeAssetTransferPayload, parseTransaction, xnaToSatoshis } from '../src/index.js';
import { u64LE } from '../src/bytes.js';
const ADDRESS = 'tJEy5RHfmXnGhoj4PhkdDC9YDsdQ6JtmXy';
const MAX = 2100000000000000000n;
describe('exact amounts through the Neurai monetary range', () => {
  it.each([
    ['0.00000001', 1n], ['4.35', 435000000n],
    ['90071992.54740993', 9007199254740993n],
    ['100000000.00000001', 10000000000000001n],
    ['105552176.16498300', 10555217616498300n],
    ['21000000000', MAX],
  ])('converts %s exactly', (input, expected) => {
    expect(xnaToSatoshis(input as any)).toBe(expected);
  });
  it.each([NaN, Infinity, null, '', '1.000000001', '21000000000.00000001', -1])('rejects invalid amount %s', input => {
    expect(() => xnaToSatoshis(input as any)).toThrow();
  });
  it('rejects already unsafe integer inputs before encoding', () => {
    expect(() => u64LE(Number(9007199254740993n))).toThrow();
  });
  it.each([9007199254740993n,10000000000000001n,10555217616498300n,MAX])('round trips a large payment %s', valueSats => {
    const tx=createPaymentTransaction({inputs:[{txid:'cc'.repeat(32),vout:0}],payments:[{address:ADDRESS,valueSats}]});
    expect(parseTransaction(tx.rawTx).outputs[0].valueSats).toBe(valueSats);
  });
  it('rejects monetary overflow in payment and asset outputs', () => {
    expect(() => createPaymentTransaction({inputs:[],payments:[{address:ADDRESS,valueSats:MAX+1n}]})).toThrow();
    expect(() => encodeAssetTransferPayload('TEST',MAX+1n)).toThrow();
    expect(() => createPaymentTransaction({inputs:[],payments:[{address:ADDRESS,valueSats:MAX},{address:ADDRESS,valueSats:1n}]})).toThrow();
  });
});

import { decimalToSatoshis, satoshisToDecimal, toRawInteger } from '../src/amounts.js';
describe('shared exact primitives', () => {
  it('formats signed deltas and round trips without floating point', () => {
    for (const raw of [-9007199254740993n, 0n, 1n, 10000000000000001n, MAX]) {
      expect(decimalToSatoshis(satoshisToDecimal(raw))).toBe(raw);
    }
  });
  it('preserves safe decimal number compatibility and scientific notation', () => {
    expect(decimalToSatoshis(0.00000001)).toBe(1n);
    expect(decimalToSatoshis(4.35)).toBe(435000000n);
    expect(decimalToSatoshis('1e8')).toBe(10000000000000000n);
    expect(() => decimalToSatoshis(100000000.00000001)).toThrow(/strings/);
    expect(() => decimalToSatoshis('1e999999')).toThrow();
  });
  it('rejects rounded raw numbers and invalid types', () => {
    expect(toRawInteger('9007199254740993')).toBe(9007199254740993n);
    for (const input of [9007199254740992, 1.1, NaN, Infinity, null, '1e8']) {
      expect(() => toRawInteger(input as any)).toThrow();
    }
  });
});
