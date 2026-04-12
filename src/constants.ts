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

function resolveNetworkFamily(network: SupportedNetwork): 'mainnet' | 'testnet' {
  return network === 'xna' || network === 'xna-pq' ? 'mainnet' : 'testnet';
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
  const slashIndex = assetName.indexOf('/');
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

export function isDepinAssetName(assetName: string): boolean {
  const normalized = String(assetName || '').trim();
  return /^&[A-Z0-9._]{3,}$/.test(normalized) || /^&[A-Z0-9._]+\/[A-Z0-9._/]+$/.test(normalized);
}

export function assertDepinAssetName(assetName: string): void {
  if (!isDepinAssetName(assetName)) {
    throw new Error(`Invalid DEPIN asset name: ${assetName}`);
  }
}
