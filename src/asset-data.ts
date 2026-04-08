import bs58 from 'bs58';
import { bytesToHex, ensureHex, hexToBytes } from './bytes.js';

const IPFS_PREFIX = 0x12;
const IPFS_LENGTH = 0x20;
const TXID_PREFIX = 0x54;

export function encodeAssetDataReference(value?: string): Uint8Array {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return new Uint8Array();
  }

  if (normalized.startsWith('Qm') && normalized.length === 46) {
    const decoded = Uint8Array.from(bs58.decode(normalized));
    if (decoded.length !== 34) {
      throw new Error(`Invalid CIDv0 length for asset data: ${decoded.length}`);
    }
    return decoded;
  }

  if (normalized.length === 64 && /^[0-9a-fA-F]+$/.test(normalized)) {
    const txidBytes = hexToBytes(normalized);
    return Uint8Array.of(TXID_PREFIX, IPFS_LENGTH, ...txidBytes);
  }

  if (normalized.length === 68 && /^[0-9a-fA-F]+$/.test(normalized)) {
    const raw = hexToBytes(normalized);
    if (raw[1] !== IPFS_LENGTH) {
      throw new Error('Invalid raw asset data reference length prefix');
    }
    return raw;
  }

  throw new Error(
    'Unsupported asset data reference. Expected CIDv0 (Qm...), 64-char txid, or 68-char raw hex'
  );
}

export function decodeAssetDataReferenceHex(value?: string): string {
  return bytesToHex(encodeAssetDataReference(value));
}

export function isEncodedAssetDataReferenceHex(hex: string): boolean {
  const normalized = ensureHex(hex);
  return normalized.length === 68 || normalized.length === 0;
}

export function isCidV0AssetReference(value?: string): boolean {
  const normalized = String(value || '').trim();
  return normalized.startsWith('Qm') && normalized.length === 46;
}

export function isTxidAssetReference(value?: string): boolean {
  const normalized = String(value || '').trim();
  return normalized.length === 64 && /^[0-9a-fA-F]+$/.test(normalized);
}

export function isRawAssetDataReferenceHex(value?: string): boolean {
  const normalized = String(value || '').trim();
  return normalized.length === 68 && /^[0-9a-fA-F]+$/.test(normalized);
}

export function formatAssetDataReferenceHex(value?: string): string {
  return bytesToHex(encodeAssetDataReference(value));
}

export {
  IPFS_LENGTH,
  IPFS_PREFIX,
  TXID_PREFIX
};
