import { bech32m } from 'bech32';
import bs58check from 'bs58check';
import { resolveAddressInput } from './address-input.js';
import { concatBytes, pushData } from './bytes.js';
import {
  inferNetworkFromAddress,
  LEGACY_MAINNET_PREFIX,
  LEGACY_TESTNET_PREFIX,
  OP_1,
  OP_XNA_ASSET,
  PQ_MAINNET_HRP,
  PQ_TESTNET_HRP
} from './networks.js';
import type { AddressDestination, AddressLike, NullAssetDestinationMode, SupportedNetwork } from './types.js';

export function decodeAddress(address: AddressLike): AddressDestination {
  const normalized = resolveAddressInput(address);
  const lowered = normalized.toLowerCase();
  if (!normalized) throw new Error('Address is required');

  if (lowered.startsWith(PQ_MAINNET_HRP + '1') || lowered.startsWith(PQ_TESTNET_HRP + '1')) {
    const decoded = bech32m.decode(normalized);
    const version = decoded.words[0];
    const program = Uint8Array.from(bech32m.fromWords(decoded.words.slice(1)));
    if (version !== 1 || program.length !== 32) {
      throw new Error(`Unsupported AuthScript address program for ${address}`);
    }
    const network: SupportedNetwork = lowered.startsWith(PQ_TESTNET_HRP + '1') ? 'xna-pq-test' : 'xna-pq';
    return { address: normalized, type: 'authscript', network, program, commitment: program };
  }

  const payload = Uint8Array.from(bs58check.decode(normalized));
  if (payload.length !== 21) {
    throw new Error(`Unsupported legacy address payload length for ${address}`);
  }
  const prefix = payload[0];
  if (prefix !== LEGACY_MAINNET_PREFIX && prefix !== LEGACY_TESTNET_PREFIX) {
    throw new Error(`Unsupported legacy address prefix ${prefix} for ${address}`);
  }

  return {
    address: normalized,
    type: 'p2pkh',
    network: inferNetworkFromAddress(normalized),
    program: payload.slice(1),
    hash: payload.slice(1)
  };
}

export function encodeP2PKHScript(address: AddressLike): Uint8Array {
  const destination = decodeAddress(address);
  if (destination.type !== 'p2pkh') {
    throw new Error(`Address ${address} is not legacy P2PKH`);
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

export function encodeAuthScriptDestinationScript(address: AddressLike): Uint8Array {
  const destination = decodeAddress(address);
  if (destination.type !== 'authscript') {
    throw new Error(`Address ${address} is not AuthScript witness v1`);
  }
  return concatBytes(Uint8Array.of(OP_1), pushData(destination.commitment));
}

export function encodeDestinationScript(address: AddressLike): Uint8Array {
  const destination = decodeAddress(address);
  return destination.type === 'authscript'
    ? encodeAuthScriptDestinationScript(address)
    : encodeP2PKHScript(address);
}

export function encodeNullAssetDestinationScript(
  address: AddressLike,
  mode: NullAssetDestinationMode = 'strict'
): Uint8Array {
  const destination = decodeAddress(address);
  if (destination.type === 'authscript') {
    if (mode === 'hash20') {
      throw new Error('hash20 null-asset mode is not supported for AuthScript destinations');
    }
    return concatBytes(
      Uint8Array.of(OP_XNA_ASSET, OP_1),
      pushData(destination.commitment)
    );
  }

  return concatBytes(
    Uint8Array.of(OP_XNA_ASSET),
    pushData(destination.hash)
  );
}

export const encodePQWitnessScript = encodeAuthScriptDestinationScript;
export { resolveAddressInput } from './address-input.js';
