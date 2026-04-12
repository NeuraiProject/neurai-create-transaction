import { describe, expect, it } from 'vitest';
import {
  assertDepinAssetName,
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

  it('detects DEPIN names explicitly', () => {
    expect(isDepinAssetName('&DEVICE')).toBe(true);
    expect(isDepinAssetName('&DEVICE/SUB')).toBe(true);
    expect(isDepinAssetName('ASSET')).toBe(false);
    expect(() => assertDepinAssetName('ASSET')).toThrow(/Invalid DEPIN asset name/);
  });

  it('infers networks and exports protocol constants', () => {
    expect(inferNetworkFromAnyAddress('tnq1p83wfxfypfr3tqpwakdgmk5r0pwpsemq5ngdsx7gef8yc84pndfmqjer8rk')).toBe('xna-pq-test');
    expect(OWNER_ASSET_AMOUNT).toBe(100000000n);
    expect(UNIQUE_ASSET_AMOUNT).toBe(100000000n);
    expect(UNIQUE_ASSET_UNITS).toBe(0);
  });
});
