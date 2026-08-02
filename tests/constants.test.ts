import { describe, expect, it } from 'vitest';
import {
  assertDepinAssetName,
  assertDepinNetwork,
  DEPIN_MAX_NAME_LENGTH,
  getBurnAddressForOperation,
  getBurnAmountSats,
  getOwnerTokenName,
  getParentAssetName,
  getUniqueAssetName,
  inferNetworkFromAnyAddress,
  isDepinAssetName,
  normalizeVerifierString,
  OWNER_ASSET_AMOUNT,
  UNIQUE_ASSET_AMOUNT,
  UNIQUE_ASSET_UNITS
} from '../src/constants.js';

describe('constants', () => {
  it('returns burn addresses and amounts for named operations', () => {
    expect(getBurnAddressForOperation('xna-pq-test', 'ISSUE_DEPIN')).toBe(
      'tUniqueAssetXXXXXXXXXXXXXXXXVCgpLs'
    );
    expect(getBurnAmountSats('ISSUE_DEPIN')).toBe(1000000000n);
    expect(getBurnAmountSats('TAG_ADDRESS')).toBe(20000000n);
  });

  it('handles asset name helpers', () => {
    expect(getOwnerTokenName('ASSET')).toBe('ASSET!');
    expect(getOwnerTokenName('$ASSET')).toBe('ASSET!');
    expect(getParentAssetName('ROOT/SUB')).toBe('ROOT');
    expect(getUniqueAssetName('ROOT', '001')).toBe('ROOT#001');
    expect(normalizeVerifierString('#TAG & #KYC')).toBe('TAG&KYC');
    expect(normalizeVerifierString('!#KYC')).toBe('!KYC');
    expect(normalizeVerifierString('(#A|#B)&!#C')).toBe('(A|B)&!C');
  });

  it('resolves the immediate parent for multilevel names', () => {
    expect(getParentAssetName('ROOT/SUB/LEAF')).toBe('ROOT/SUB');
    expect(getParentAssetName('&ABC/DEF/GHI')).toBe('&ABC/DEF');
    expect(getParentAssetName('ROOT')).toBeNull();
  });

  it('detects DEPIN names explicitly', () => {
    expect(isDepinAssetName('&DEVICE')).toBe(true);
    expect(isDepinAssetName('&DEVICE/SUB')).toBe(true);
    expect(isDepinAssetName('ASSET')).toBe(false);
    expect(() => assertDepinAssetName('ASSET')).toThrow(/Invalid DEPIN asset name/);
  });

  it('requires 3 real chars per segment, including the root of hierarchical names', () => {
    expect(isDepinAssetName('&ABC')).toBe(true);
    expect(isDepinAssetName('&AB')).toBe(false);
    expect(isDepinAssetName('&ABC/DEF')).toBe(true);
    // "&AB/CDE" passes the node parser but can never be issued: its parent
    // "&AB" is not a valid root, so the parent owner token cannot exist.
    expect(isDepinAssetName('&AB/CDE')).toBe(false);
    expect(isDepinAssetName('&A/CDE')).toBe(false);
    expect(isDepinAssetName('&ABC/DE')).toBe(false);
    expect(isDepinAssetName('&ABC//DEF')).toBe(false);
  });

  it('caps DEPIN names at 120 so the owner token stays nameable', () => {
    expect(DEPIN_MAX_NAME_LENGTH).toBe(120);
    expect(isDepinAssetName('&' + 'A'.repeat(119))).toBe(true);
    expect(isDepinAssetName('&' + 'A'.repeat(120))).toBe(false);
  });

  it('classifies xna-legacy as mainnet for burn addresses', () => {
    expect(getBurnAddressForOperation('xna-legacy', 'ISSUE_ROOT')).toBe(
      'NbURNXXXXXXXXXXXXXXXXXXXXXXXT65Gdr'
    );
    expect(getBurnAddressForOperation('xna-legacy-test', 'ISSUE_ROOT')).toBe(
      'tBURNXXXXXXXXXXXXXXXXXXXXXXXVZLroy'
    );
  });

  it('rejects mainnet networks for DEPIN and accepts testnet families', () => {
    for (const network of ['xna', 'xna-pq', 'xna-legacy'] as const) {
      expect(() => assertDepinNetwork(network)).toThrow(/only available on testnet\/regtest/);
    }
    for (const network of ['xna-test', 'xna-pq-test', 'xna-legacy-test'] as const) {
      expect(() => assertDepinNetwork(network)).not.toThrow();
    }
    expect(() => assertDepinNetwork(undefined)).not.toThrow();
  });

  it('infers networks and exports protocol constants', () => {
    expect(inferNetworkFromAnyAddress('tnq1p83wfxfypfr3tqpwakdgmk5r0pwpsemq5ngdsx7gef8yc84pndfmqjer8rk')).toBe('xna-pq-test');
    expect(OWNER_ASSET_AMOUNT).toBe(100000000n);
    expect(UNIQUE_ASSET_AMOUNT).toBe(100000000n);
    expect(UNIQUE_ASSET_UNITS).toBe(0);
  });
});
