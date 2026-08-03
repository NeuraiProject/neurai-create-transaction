import type { AddressLike, BurnOperationType, SupportedNetwork } from './types.js';
import { inferNetworkFromAddress } from './networks.js';

export const OWNER_ASSET_AMOUNT = 100000000n;
export const UNIQUE_ASSET_AMOUNT = 100000000n;
export const UNIQUE_ASSET_UNITS = 0;
export const UNIQUE_ASSETS_REISSUABLE = false;

const MAINNET_BURN_ADDRESSES: Record<BurnOperationType, string> = {
  ISSUE_ROOT: 'NbURNXXXXXXXXXXXXXXXXXXXXXXXT65Gdr',
  ISSUE_SUB: 'NXissueSubAssetXXXXXXXXXXXXXX6B2JF',
  ISSUE_UNIQUE: 'NXissueUniqueAssetXXXXXXXXXXUBzP4Z',
  ISSUE_DEPIN: 'NXissueUniqueAssetXXXXXXXXXXUBzP4Z',
  ISSUE_MSGCHANNEL: 'NXissueMsgChanneLAssetXXXXXXTUzrtJ',
  REISSUE: 'NXReissueAssetXXXXXXXXXXXXXXWLe4Ao',
  REISSUE_RESTRICTED: 'NXReissueAssetXXXXXXXXXXXXXXWLe4Ao',
  ISSUE_RESTRICTED: 'NXissueRestrictedXXXXXXXXXXXWpXx4H',
  ISSUE_QUALIFIER: 'NXissueQuaLifierXXXXXXXXXXXXWurNcU',
  ISSUE_SUB_QUALIFIER: 'NXissueSubQuaLifierXXXXXXXXXV71vM3',
  TAG_ADDRESS: 'NXaddTagBurnXXXXXXXXXXXXXXXXWucUTr',
  UNTAG_ADDRESS: 'NXaddTagBurnXXXXXXXXXXXXXXXXWucUTr'
};

const TESTNET_BURN_ADDRESSES: Record<BurnOperationType, string> = {
  ISSUE_ROOT: 'tBURNXXXXXXXXXXXXXXXXXXXXXXXVZLroy',
  ISSUE_SUB: 'tSubAssetXXXXXXXXXXXXXXXXXXXXGTvF4',
  ISSUE_UNIQUE: 'tUniqueAssetXXXXXXXXXXXXXXXXVCgpLs',
  ISSUE_DEPIN: 'tUniqueAssetXXXXXXXXXXXXXXXXVCgpLs',
  ISSUE_MSGCHANNEL: 'tMsgChanneLAssetXXXXXXXXXXXXVsJoya',
  REISSUE: 'tAssetXXXXXXXXXXXXXXXXXXXXXXas6pz8',
  REISSUE_RESTRICTED: 'tAssetXXXXXXXXXXXXXXXXXXXXXXas6pz8',
  ISSUE_RESTRICTED: 'tRestrictedXXXXXXXXXXXXXXXXXVyPBEK',
  ISSUE_QUALIFIER: 'tQuaLifierXXXXXXXXXXXXXXXXXXT5czoV',
  ISSUE_SUB_QUALIFIER: 'tSubQuaLifierXXXXXXXXXXXXXXXW5MmGk',
  TAG_ADDRESS: 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA',
  UNTAG_ADDRESS: 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA'
};

const BURN_COSTS_XNA: Record<BurnOperationType, number> = {
  ISSUE_ROOT: 1000,
  ISSUE_SUB: 200,
  ISSUE_UNIQUE: 10,
  ISSUE_DEPIN: 10,
  ISSUE_MSGCHANNEL: 200,
  ISSUE_QUALIFIER: 2000,
  ISSUE_SUB_QUALIFIER: 200,
  ISSUE_RESTRICTED: 3000,
  REISSUE: 200,
  REISSUE_RESTRICTED: 200,
  TAG_ADDRESS: 0.2,
  UNTAG_ADDRESS: 0.2
};

// Regtest chainparams use one global burn address for every operation
// (node chainparams.cpp strGlobalBurnAddress). Pass it as the
// `burnAddress` override of the issuance/reissue builders when targeting
// regtest; `getBurnAddressForOperation` only models mainnet/testnet.
export const REGTEST_GLOBAL_BURN_ADDRESS = 'tBURNXXXXXXXXXXXXXXXXXXXXXXXVZLroy';

function resolveNetworkFamily(network: SupportedNetwork): 'mainnet' | 'testnet' {
  return network === 'xna' || network === 'xna-pq' || network === 'xna-legacy'
    ? 'mainnet'
    : 'testnet';
}

export function getBurnAddressForOperation(
  network: SupportedNetwork,
  operation: BurnOperationType
): string {
  const byFamily = resolveNetworkFamily(network) === 'mainnet'
    ? MAINNET_BURN_ADDRESSES
    : TESTNET_BURN_ADDRESSES;
  return byFamily[operation];
}

export function getBurnAmountXna(operation: BurnOperationType, multiplier = 1): number {
  return BURN_COSTS_XNA[operation] * multiplier;
}

export function getBurnAmountSats(operation: BurnOperationType, multiplier = 1): bigint {
  return BigInt(Math.round(getBurnAmountXna(operation, multiplier) * 1e8));
}

export function inferNetworkFromAnyAddress(address: AddressLike): SupportedNetwork {
  return inferNetworkFromAddress(address);
}

export function getOwnerTokenName(assetName: string): string {
  if (assetName.startsWith('$')) {
    return `${assetName.slice(1)}!`;
  }
  return `${assetName}!`;
}

export function getParentAssetName(assetName: string): string | null {
  // The parent is the immediate one, not the root: "A/B/C" is owned by "A/B!"
  // (node GetParentName resolves with find_last_of for SUB and DEPIN alike).
  const slashIndex = assetName.lastIndexOf('/');
  if (slashIndex === -1) {
    return null;
  }
  return assetName.slice(0, slashIndex);
}

export function getUniqueAssetName(rootName: string, tag: string): string {
  return `${rootName}#${tag}`;
}

export function normalizeVerifierString(verifierString: string): string {
  return String(verifierString || '')
    .replace(/\s+/g, '')
    .replace(/#/g, '');
}

// The node accepts DEPIN names up to 121 chars where DePIN is enabled, but a
// 121-char base name yields a 122-char owner token ("&X!") that fails the
// global name-length check, making the asset untransferable. Capped at 120
// here so every name this library issues keeps a nameable owner token.
export const DEPIN_MAX_NAME_LENGTH = 120;

export function isDepinAssetName(assetName: string): boolean {
  const normalized = String(assetName || '').trim();
  if (normalized.length > DEPIN_MAX_NAME_LENGTH) {
    return false;
  }
  if (!normalized.includes('/')) {
    return /^&[A-Z0-9._]{3,}$/.test(normalized);
  }
  if (!/^&[A-Z0-9._]+\/[A-Z0-9._/]+$/.test(normalized)) {
    return false;
  }
  // The node parser lets the first part count its leading '&' toward the
  // 3-char minimum ("&AB/CDE" parses), but such an asset can never be issued:
  // its parent "&AB" is not a valid root, so the parent owner token "&AB!"
  // required at issuance cannot exist. Require 3 real chars in every segment.
  const [root, ...rest] = normalized.split('/');
  return root.length >= 4 && rest.every((part) => part.length >= 3);
}

export function assertDepinAssetName(assetName: string): void {
  if (!isDepinAssetName(assetName)) {
    throw new Error(`Invalid DEPIN asset name: ${assetName}`);
  }
}

export function assertDepinNetwork(network?: SupportedNetwork): void {
  if (network !== undefined && resolveNetworkFamily(network) === 'mainnet') {
    throw new Error(`DEPIN assets are only available on testnet/regtest networks: ${network}`);
  }
}
