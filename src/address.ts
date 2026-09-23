import { bech32m } from 'bech32';
import bs58check from 'bs58check';
import { resolveAddressInput } from './address-input.js';
import { concatBytes, hexToBytes, pushData } from './bytes.js';
import {
  LEGACY_MAINNET_PREFIX,
  LEGACY_TESTNET_PREFIX,
  OP_1,
  OP_XNA_ASSET,
  witnessFamilyByHrp,
  witnessFamilyByVersion,
  witnessVersionOpcode
} from './networks.js';
import type {
  AddressDestination,
  AddressLike,
  DestinationType,
  LegacyAddressDestination,
  NullAssetDestinationMode,
  SupportedNetwork,
  WitnessAddressDestination,
  WitnessVersion
} from './types.js';

// Longest Bech32m string the node's decoder accepts (bech32.cpp).
const BECH32M_MAX_LENGTH = 90;
const AUTHSCRIPT_PROGRAM_LENGTH = 32;

type Bech32mParts = { hrp: string; words: number[] };

function tryBech32mDecode(address: string): Bech32mParts | null {
  try {
    const { prefix, words } = bech32m.decode(address, BECH32M_MAX_LENGTH);
    return { hrp: prefix.toLowerCase(), words };
  } catch {
    return null;
  }
}

function decodeWitnessAddress(address: string, parts: Bech32mParts): WitnessAddressDestination {
  const owner = witnessFamilyByHrp(parts.hrp);
  if (!owner) {
    throw new Error(`Unsupported Bech32m prefix "${parts.hrp}" for ${address}`);
  }
  if (parts.words.length === 0) {
    throw new Error(`Empty witness program in ${address}`);
  }
  const version = parts.words[0];
  const { family, chain } = owner;
  if (version !== family.witnessVersion) {
    const actual = witnessFamilyByVersion(version);
    const hint = actual
      ? `; witness v${version} addresses use the "${actual.hrp[chain]}" prefix`
      : '';
    const legacyHint =
      family.type === 'ecdsa' && version === 1
        ? ' Generic AuthScript v1 addresses are now encoded as nc1p… / tnc1p… ' +
          '(same scriptPubKey): regenerate the address (neurai-key xna-authscript networks).'
        : '';
    throw new Error(
      `Address ${address}: the "${parts.hrp}" prefix only encodes witness v${family.witnessVersion}, ` +
        `not v${version}${hint}.${legacyHint}`
    );
  }
  let program: Uint8Array;
  try {
    program = Uint8Array.from(bech32m.fromWords(parts.words.slice(1)));
  } catch {
    throw new Error(`Invalid witness program padding in ${address}`);
  }
  if (program.length !== AUTHSCRIPT_PROGRAM_LENGTH) {
    throw new Error(
      `Unsupported AuthScript program length ${program.length} for ${address} (expected ${AUTHSCRIPT_PROGRAM_LENGTH})`
    );
  }
  return {
    address,
    type: family.type,
    witnessVersion: family.witnessVersion,
    network: family.network[chain],
    program,
    commitment: program
  };
}

function decodeLegacyAddress(address: string): LegacyAddressDestination {
  const payload = Uint8Array.from(bs58check.decode(address));
  if (payload.length !== 21) {
    throw new Error(`Unsupported legacy address payload length for ${address}`);
  }
  const prefix = payload[0];
  if (prefix !== LEGACY_MAINNET_PREFIX && prefix !== LEGACY_TESTNET_PREFIX) {
    throw new Error(`Unsupported legacy address prefix ${prefix} for ${address}`);
  }
  return {
    address,
    type: 'p2pkh',
    network: prefix === LEGACY_MAINNET_PREFIX ? 'xna-legacy' : 'xna-legacy-test',
    program: payload.slice(1),
    hash: payload.slice(1)
  };
}

/**
 * Decode a Neurai address the way the node does (base58.cpp
 * `DecodeDestination`): Bech32m first, Base58Check otherwise.
 *
 * - Base58 P2PKH → `type: 'p2pkh'`, network `xna-legacy` / `xna-legacy-test`
 *   (an `xna-old-legacy` address is indistinguishable and reports
 *   `xna-legacy`).
 * - Bech32m → `authscript` (v1, `nc`/`tnc`), `pq` (v2, `pq`/`tpq`) or
 *   `ecdsa` (v3, `nq`/`tnq`), with `witnessVersion` and the 32-byte
 *   commitment. Any other HRP/version pair is rejected, including the old
 *   `nq1p…` / `tnq1p…` encoding of generic AuthScript v1.
 *
 * The decoder does not know whether a witness family is active on the
 * target chain: before activation the node refuses v2/v3 addresses and a
 * witness output is anyone-can-spend.
 */
export function decodeAddress(address: AddressLike): AddressDestination {
  const normalized = resolveAddressInput(address);
  if (!normalized) throw new Error('Address is required');

  const bech32mParts = tryBech32mDecode(normalized);
  if (bech32mParts) {
    return decodeWitnessAddress(normalized, bech32mParts) as AddressDestination;
  }

  try {
    return decodeLegacyAddress(normalized);
  } catch (legacyError) {
    // Not Base58 either. When the string carries a known Bech32m prefix the
    // Bech32m failure (bad checksum, mixed case…) is the useful diagnosis.
    const separator = normalized.lastIndexOf('1');
    const hrp = separator > 0 ? normalized.slice(0, separator).toLowerCase() : '';
    if (witnessFamilyByHrp(hrp)) {
      throw new Error(`Invalid Bech32m address ${normalized} (checksum, case or character error)`);
    }
    throw legacyError;
  }
}

/** Chain-family label of an address: see `decodeAddress`. */
export function inferNetworkFromAddress(address: AddressLike): SupportedNetwork {
  return decodeAddress(address).network;
}

/** True for the Bech32m (AuthScript v1, PQ v2, ECDSA v3) destinations. */
export function isWitnessDestination(
  destination: AddressDestination
): destination is Extract<AddressDestination, WitnessAddressDestination> {
  return destination.type !== 'p2pkh';
}

/** `OP_n 0x20 <32-byte commitment>` for witness version `n` (1, 2 or 3). */
export function encodeWitnessProgramScript(
  witnessVersion: WitnessVersion,
  commitment: Uint8Array | string
): Uint8Array {
  const bytes = typeof commitment === 'string' ? hexToBytes(commitment) : commitment;
  if (bytes.length !== AUTHSCRIPT_PROGRAM_LENGTH) {
    throw new Error(`AuthScript commitment must be ${AUTHSCRIPT_PROGRAM_LENGTH} bytes, got ${bytes.length}`);
  }
  return concatBytes(Uint8Array.of(witnessVersionOpcode(witnessVersion)), pushData(bytes));
}

export function encodeP2PKHScript(address: AddressLike): Uint8Array {
  const destination = decodeAddress(address);
  if (destination.type !== 'p2pkh') {
    throw new Error(`Address ${resolveAddressInput(address)} is not legacy P2PKH`);
  }
  return Uint8Array.of(
    0x76,
    0xa9,
    0x14,
    ...destination.hash,
    0x88,
    0xac
  );
}

/**
 * scriptPubKey of an AuthScript destination of any witness version:
 * `OP_1` (generic v1), `OP_2` (PQ) or `OP_3` (ECDSA) followed by the
 * 32-byte commitment.
 */
export function encodeAuthScriptDestinationScript(address: AddressLike): Uint8Array {
  const destination = decodeAddress(address);
  if (!isWitnessDestination(destination)) {
    throw new Error(
      `Address ${resolveAddressInput(address)} is not an AuthScript (witness v1, v2 or v3) address`
    );
  }
  return encodeWitnessProgramScript(destination.witnessVersion, destination.commitment);
}

export function encodeDestinationScript(address: AddressLike): Uint8Array {
  const destination = decodeAddress(address);
  return isWitnessDestination(destination)
    ? encodeWitnessProgramScript(destination.witnessVersion, destination.commitment)
    : encodeP2PKHScript(address);
}

export function encodeNullAssetDestinationScript(
  address: AddressLike,
  mode: NullAssetDestinationMode = 'strict'
): Uint8Array {
  const destination = decodeAddress(address);
  if (isWitnessDestination(destination)) {
    if (mode === 'hash20') {
      throw new Error('hash20 null-asset mode is not supported for AuthScript destinations');
    }
    return concatBytes(
      Uint8Array.of(OP_XNA_ASSET, witnessVersionOpcode(destination.witnessVersion)),
      pushData(destination.commitment)
    );
  }

  return concatBytes(
    Uint8Array.of(OP_XNA_ASSET),
    pushData(destination.hash)
  );
}

/**
 * @deprecated The name predates the PQ witness v2 family: it encodes every
 * AuthScript witness version. Use `encodeAuthScriptDestinationScript`.
 */
export const encodePQWitnessScript = encodeAuthScriptDestinationScript;

export interface ScriptPubKeyKind {
  /** `unknown` for any shape that is not P2PKH or AuthScript `OP_n <32B>`. */
  type: DestinationType | 'unknown';
  /** 1, 2 or 3 for AuthScript destinations. */
  witnessVersion?: WitnessVersion;
  /** 20-byte hash (P2PKH) or 32-byte commitment (AuthScript). */
  program?: Uint8Array;
  /** Bytes after the destination prefix, e.g. an OP_XNA_ASSET wrapper. */
  hasSuffix: boolean;
}

/**
 * Classify a scriptPubKey by its destination prefix, ignoring any trailing
 * asset wrapper: `76a914<20>88ac…` is P2PKH, `5120<32>…`, `5220<32>…` and
 * `5320<32>…` are AuthScript v1 (generic), v2 (PQ) and v3 (ECDSA).
 */
export function classifyScriptPubKey(script: Uint8Array | string): ScriptPubKeyKind {
  const bytes = typeof script === 'string' ? hexToBytes(script) : script;
  if (
    bytes.length >= 25 &&
    bytes[0] === 0x76 &&
    bytes[1] === 0xa9 &&
    bytes[2] === 0x14 &&
    bytes[23] === 0x88 &&
    bytes[24] === 0xac
  ) {
    return { type: 'p2pkh', program: bytes.slice(3, 23), hasSuffix: bytes.length > 25 };
  }
  if (bytes.length >= 34 && bytes[1] === 0x20) {
    const family = witnessFamilyByVersion(bytes[0] - (OP_1 - 1));
    if (family) {
      return {
        type: family.type,
        witnessVersion: family.witnessVersion,
        program: bytes.slice(2, 34),
        hasSuffix: bytes.length > 34
      };
    }
  }
  return { type: 'unknown', hasSuffix: false };
}
export { resolveAddressInput } from './address-input.js';
