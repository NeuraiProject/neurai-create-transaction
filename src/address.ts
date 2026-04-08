import { bech32m } from 'bech32';
import bs58check from 'bs58check';
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
import type { AddressDestination, NullAssetDestinationMode, SupportedNetwork } from './types.js';

export function decodeAddress(address: string): AddressDestination {
  const normalized = String(address || '').trim();
  if (!normalized) throw new Error('Address is required');

  if (normalized.startsWith(PQ_MAINNET_HRP + '1') || normalized.startsWith(PQ_TESTNET_HRP + '1')) {
    const decoded = bech32m.decode(normalized);
    const version = decoded.words[0];
    const program = Uint8Array.from(bech32m.fromWords(decoded.words.slice(1)));
    if (version !== 1 || program.length !== 20) {
      throw new Error(`Unsupported PQ address program for ${address}`);
    }
    const network: SupportedNetwork = normalized.startsWith(PQ_TESTNET_HRP + '1') ? 'xna-pq-test' : 'xna-pq';
    return { address: normalized, type: 'pq', network, hash: program };
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
    hash: payload.slice(1)
  };
}

export function encodeP2PKHScript(address: string): Uint8Array {
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

export function encodePQWitnessScript(address: string): Uint8Array {
  const destination = decodeAddress(address);
  if (destination.type !== 'pq') {
    throw new Error(`Address ${address} is not PQ witness v1`);
  }
  return concatBytes(Uint8Array.of(OP_1), pushData(destination.hash));
}

export function encodeDestinationScript(address: string): Uint8Array {
  const destination = decodeAddress(address);
  return destination.type === 'pq'
    ? encodePQWitnessScript(address)
    : encodeP2PKHScript(address);
}

export function encodeNullAssetDestinationScript(
  address: string,
  mode: NullAssetDestinationMode = 'strict'
): Uint8Array {
  const destination = decodeAddress(address);
  if (destination.type === 'pq') {
    if (mode === 'hash20') {
      return concatBytes(
        Uint8Array.of(OP_XNA_ASSET),
        pushData(destination.hash)
      );
    }
    return concatBytes(
      Uint8Array.of(OP_XNA_ASSET, OP_1),
      pushData(destination.hash)
    );
  }

  return concatBytes(
    Uint8Array.of(OP_XNA_ASSET),
    pushData(destination.hash)
  );
}
