import { resolveAddressInput } from './address-input.js';
import type { AddressLike, AssetMarker, AssetPayloadType, SupportedNetwork } from './types.js';

export const LEGACY_MAINNET_PREFIX = 53;
export const LEGACY_TESTNET_PREFIX = 127;
export const PQ_MAINNET_HRP = 'nq';
export const PQ_TESTNET_HRP = 'tnq';
export const OP_XNA_ASSET = 0xc0;
export const OP_DROP = 0x75;
export const OP_1 = 0x51;
export const OP_RESERVED = 0x50;

/**
 * NIP-040 asset payload marker.
 *
 * Every transfer / new / owner / reissue payload opens with a 3-byte marker
 * followed by the type byte. The marker is consensus: blocks below the NIP-040
 * activation height of a network only accept `rvn` on new asset outputs and
 * blocks at or above it only accept `xna` (mainnet: not scheduled; testnet:
 * 303000; regtest: 1). This library does NOT know chain state and never
 * infers the marker from a network or an address: the caller passes the
 * value reported by the node for the next block
 * (`getblockchaininfo.asset_marker`, node commit 347362b) — or, when building
 * offline, the marker it knows to be right. Without it the default is `rvn`,
 * byte-for-byte identical to 0.6.0.
 */
export const DEFAULT_ASSET_MARKER: AssetMarker = 'rvn';

const ASSET_MARKER_BYTES: Record<AssetMarker, readonly [number, number, number]> = {
  rvn: [0x72, 0x76, 0x6e],
  xna: [0x78, 0x6e, 0x61]
};

const ASSET_PAYLOAD_TYPE_BYTE: Record<AssetPayloadType, number> = {
  transfer: 0x74, // 't'
  new: 0x71, // 'q'
  owner: 0x6f, // 'o'
  reissue: 0x72 // 'r'
};

/**
 * Applies the default only when the marker was not given at all (`undefined`)
 * and rejects anything else that is not `'rvn'` or `'xna'` — including
 * `null`, which is what a missing or null `asset_marker` in a JSON reply
 * becomes: it must fail loudly, not silently build a legacy output.
 */
export function resolveAssetMarker(value: unknown): AssetMarker {
  if (value === undefined) return DEFAULT_ASSET_MARKER;
  if (value === 'rvn' || value === 'xna') return value;
  throw new Error(
    `Invalid assetMarker: ${String(value)} (expected 'rvn' or 'xna', the value of getblockchaininfo.asset_marker)`
  );
}

/**
 * The only place marker bytes are assembled (mirror of the node's
 * `AppendAssetMarkerPrefix`): `<marker 3B> <type 1B>`.
 */
export function assetPayloadPrefix(marker: AssetMarker | undefined, type: AssetPayloadType): Uint8Array {
  const typeByte = ASSET_PAYLOAD_TYPE_BYTE[type];
  if (typeByte === undefined) {
    throw new Error(`Unknown asset payload type: ${String(type)}`);
  }
  const [a, b, c] = ASSET_MARKER_BYTES[resolveAssetMarker(marker)];
  return Uint8Array.of(a, b, c, typeByte);
}

export function inferNetworkFromAddress(address: AddressLike): SupportedNetwork {
  const normalized = resolveAddressInput(address).toLowerCase();
  if (normalized.startsWith(PQ_MAINNET_HRP + '1')) return 'xna-pq';
  if (normalized.startsWith(PQ_TESTNET_HRP + '1')) return 'xna-pq-test';
  if (normalized.startsWith('n')) return 'xna';
  if (normalized.startsWith('t')) return 'xna-test';
  throw new Error(`Unsupported Neurai address: ${address}`);
}
