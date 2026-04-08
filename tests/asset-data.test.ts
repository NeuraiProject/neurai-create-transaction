import { describe, expect, it } from 'vitest';
import {
  decodeAssetDataReferenceHex,
  encodeAssetDataReference,
  formatAssetDataReferenceHex,
  IPFS_LENGTH,
  IPFS_PREFIX,
  isCidV0AssetReference,
  isEncodedAssetDataReferenceHex,
  isRawAssetDataReferenceHex,
  isTxidAssetReference,
  TXID_PREFIX
} from '../src/asset-data.js';

describe('asset-data', () => {
  it('encodes empty asset data as empty bytes', () => {
    expect(encodeAssetDataReference()).toHaveLength(0);
    expect(formatAssetDataReferenceHex('')).toBe('');
  });

  it('encodes CIDv0 asset references to 34 raw bytes', () => {
    const cid = 'QmacSRmrkVmvJfbCpmU6pK72furJ8E8fbKHindrLxmYMQo';
    const encoded = encodeAssetDataReference(cid);
    expect(encoded).toHaveLength(34);
    expect(encoded[0]).toBe(IPFS_PREFIX);
    expect(encoded[1]).toBe(IPFS_LENGTH);
    expect(isCidV0AssetReference(cid)).toBe(true);
  });

  it('encodes txid asset references with Neurai txid prefix', () => {
    const txid = '9c2c8e121a0139ba39bffd3ca97267bca9d4c0c1e84ac0c34a883c28e7a912ca';
    const hex = decodeAssetDataReferenceHex(txid);
    expect(hex).toBe(`5420${txid}`);
    expect(isTxidAssetReference(txid)).toBe(true);
  });

  it('accepts already encoded raw 34-byte asset references', () => {
    const raw = '1220d5d6f0d2634f0ef8813d95bc0d7d97f99f138c5e7a744f3e709e3de2f5558db4';
    const encoded = encodeAssetDataReference(raw);
    expect(encoded).toHaveLength(34);
    expect(isRawAssetDataReferenceHex(raw)).toBe(true);
    expect(isEncodedAssetDataReferenceHex(raw)).toBe(true);
  });

  it('rejects unsupported asset data formats', () => {
    expect(() => encodeAssetDataReference('bafyfoobar')).toThrow(/Unsupported asset data reference/);
    expect(() => encodeAssetDataReference('1234')).toThrow(/Unsupported asset data reference/);
  });

  it('exports protocol marker constants', () => {
    expect(IPFS_PREFIX).toBe(0x12);
    expect(IPFS_LENGTH).toBe(0x20);
    expect(TXID_PREFIX).toBe(0x54);
  });
});
