import type { AssetMarker, AssetPayloadType, SupportedNetwork, WitnessDestinationType, WitnessVersion } from './types.js';

export const LEGACY_MAINNET_PREFIX = 53;
export const LEGACY_TESTNET_PREFIX = 127;
export const OP_XNA_ASSET = 0xc0;
export const OP_DROP = 0x75;
export const OP_1 = 0x51;
export const OP_2 = 0x52;
export const OP_3 = 0x53;
export const OP_RESERVED = 0x50;

/**
 * Bech32m address families, as the node pairs them (base58.cpp
 * `DecodeDestination`): every HRP only goes with one witness version, and
 * the program is always the 32-byte AuthScript commitment. Regtest shares
 * the testnet HRPs.
 *
 * | type         | witness | mainnet | testnet / regtest | network (neurai-key 5)          |
 * |--------------|---------|---------|-------------------|---------------------------------|
 * | `authscript` | v1      | `nc`    | `tnc`             | `xna-authscript[-test]`         |
 * | `pq`         | v2      | `pq`    | `tpq`             | `xna-pq[-test]`                 |
 * | `ecdsa`      | v3      | `nq`    | `tnq`             | `xna[-test]`                    |
 */
export interface WitnessFamily {
  type: WitnessDestinationType;
  witnessVersion: WitnessVersion;
  hrp: { mainnet: string; testnet: string };
  network: { mainnet: SupportedNetwork; testnet: SupportedNetwork };
}

export const WITNESS_FAMILIES: readonly WitnessFamily[] = [
  {
    type: 'authscript',
    witnessVersion: 1,
    hrp: { mainnet: 'nc', testnet: 'tnc' },
    network: { mainnet: 'xna-authscript', testnet: 'xna-authscript-test' }
  },
  {
    type: 'pq',
    witnessVersion: 2,
    hrp: { mainnet: 'pq', testnet: 'tpq' },
    network: { mainnet: 'xna-pq', testnet: 'xna-pq-test' }
  },
  {
    type: 'ecdsa',
    witnessVersion: 3,
    hrp: { mainnet: 'nq', testnet: 'tnq' },
    network: { mainnet: 'xna', testnet: 'xna-test' }
  }
];

export const AUTHSCRIPT_MAINNET_HRP = 'nc';
export const AUTHSCRIPT_TESTNET_HRP = 'tnc';
export const PQ_MAINNET_HRP = 'pq';
export const PQ_TESTNET_HRP = 'tpq';
export const ECDSA_MAINNET_HRP = 'nq';
export const ECDSA_TESTNET_HRP = 'tnq';

/** The family that owns `hrp` (lowercase), with the chain it encodes. */
export function witnessFamilyByHrp(
  hrp: string
): { family: WitnessFamily; chain: 'mainnet' | 'testnet' } | undefined {
  for (const family of WITNESS_FAMILIES) {
    if (family.hrp.mainnet === hrp) return { family, chain: 'mainnet' };
    if (family.hrp.testnet === hrp) return { family, chain: 'testnet' };
  }
  return undefined;
}

/** The family encoded by `witnessVersion`, or undefined for any other version. */
export function witnessFamilyByVersion(witnessVersion: number): WitnessFamily | undefined {
  return WITNESS_FAMILIES.find((family) => family.witnessVersion === witnessVersion);
}

/** `OP_1`, `OP_2` or `OP_3`: the scriptPubKey opcode of a witness version. */
export function witnessVersionOpcode(witnessVersion: WitnessVersion): number {
  if (!witnessFamilyByVersion(witnessVersion)) {
    throw new Error(`Unsupported AuthScript witness version: ${String(witnessVersion)} (expected 1, 2 or 3)`);
  }
  return OP_1 - 1 + witnessVersion;
}

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
