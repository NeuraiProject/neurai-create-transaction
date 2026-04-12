import { resolveAddressInput } from './address-input.js';
import type { AddressLike, SupportedNetwork } from './types.js';

export const LEGACY_MAINNET_PREFIX = 53;
export const LEGACY_TESTNET_PREFIX = 127;
export const PQ_MAINNET_HRP = 'nq';
export const PQ_TESTNET_HRP = 'tnq';
export const OP_XNA_ASSET = 0xc0;
export const OP_DROP = 0x75;
export const OP_1 = 0x51;
export const OP_RESERVED = 0x50;

export const XNA_TRANSFER_PREFIX = new Uint8Array([
  0x72, 0x76, 0x6e, 0x74
]);

export const XNA_ISSUE_PREFIX = new Uint8Array([
  0x72, 0x76, 0x6e, 0x71
]);

export const XNA_OWNER_PREFIX = new Uint8Array([
  0x72, 0x76, 0x6e, 0x6f
]);

export const XNA_REISSUE_PREFIX = new Uint8Array([
  0x72, 0x76, 0x6e, 0x72
]);

export function inferNetworkFromAddress(address: AddressLike): SupportedNetwork {
  const normalized = resolveAddressInput(address).toLowerCase();
  if (normalized.startsWith(PQ_MAINNET_HRP + '1')) return 'xna-pq';
  if (normalized.startsWith(PQ_TESTNET_HRP + '1')) return 'xna-pq-test';
  if (normalized.startsWith('n')) return 'xna';
  if (normalized.startsWith('t')) return 'xna-test';
  throw new Error(`Unsupported Neurai address: ${address}`);
}
