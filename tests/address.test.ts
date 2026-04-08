import { describe, expect, it } from 'vitest';
import {
  decodeAddress,
  encodeDestinationScript,
  encodeNullAssetDestinationScript,
  encodeP2PKHScript,
  encodePQWitnessScript
} from '../src/address.js';
import { bytesToHex } from '../src/bytes.js';

const LEGACY_TEST = 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA';
const PQ_TEST = 'tnq1ps6h07gxnzwrgk0hpzaqdzyavgl7j98kz4nfkk3';

describe('address', () => {
  it('decodes legacy testnet addresses', () => {
    const decoded = decodeAddress(LEGACY_TEST);
    expect(decoded.type).toBe('p2pkh');
    expect(decoded.network).toBe('xna-test');
    expect(bytesToHex(decoded.hash)).toBe('e295c733ad2c8e92954d547603f9f63d99eae6c4');
  });

  it('decodes PQ testnet addresses', () => {
    const decoded = decodeAddress(PQ_TEST);
    expect(decoded.type).toBe('pq');
    expect(decoded.network).toBe('xna-pq-test');
    expect(bytesToHex(decoded.hash)).toBe('86aeff20d313868b3ee11740d113ac47fd229ec2');
  });

  it('encodes legacy and PQ destination scripts', () => {
    expect(bytesToHex(encodeP2PKHScript(LEGACY_TEST))).toBe(
      '76a914e295c733ad2c8e92954d547603f9f63d99eae6c488ac'
    );
    expect(bytesToHex(encodePQWitnessScript(PQ_TEST))).toBe(
      '511486aeff20d313868b3ee11740d113ac47fd229ec2'
    );
    expect(bytesToHex(encodeDestinationScript(PQ_TEST))).toBe(
      '511486aeff20d313868b3ee11740d113ac47fd229ec2'
    );
  });

  it('encodes null-asset destination scripts in strict and hash20 modes', () => {
    expect(bytesToHex(encodeNullAssetDestinationScript(PQ_TEST, 'strict'))).toBe(
      'c0511486aeff20d313868b3ee11740d113ac47fd229ec2'
    );
    expect(bytesToHex(encodeNullAssetDestinationScript(PQ_TEST, 'hash20'))).toBe(
      'c01486aeff20d313868b3ee11740d113ac47fd229ec2'
    );
    expect(bytesToHex(encodeNullAssetDestinationScript(LEGACY_TEST))).toBe(
      'c014e295c733ad2c8e92954d547603f9f63d99eae6c4'
    );
  });

  it('rejects unsupported or empty addresses', () => {
    expect(() => decodeAddress('')).toThrow(/Address is required/);
    expect(() => decodeAddress('1badaddress')).toThrow();
  });
});
