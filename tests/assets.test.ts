import { describe, expect, it } from 'vitest';
import {
  createOwnerAssetIssueOutput,
  createOwnerAssetTransferOutput,
  createTransferWithMessageOutput,
  encodeAssetTransferPayload,
  encodeAssetTransferScript,
  encodeGlobalRestrictionScript,
  encodeNewAssetPayload,
  encodeNullAssetTagScript,
  encodeOwnerAssetPayload,
  encodeReissueAssetPayload,
  encodeVerifierStringScript,
  xnaToSatoshis
} from '../src/assets.js';
import { bytesToHex } from '../src/bytes.js';

const LEGACY_TEST = 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA';
const AUTHSCRIPT_TEST = 'tnq1p83wfxfypfr3tqpwakdgmk5r0pwpsemq5ngdsx7gef8yc84pndfmqjer8rk';
const AUTHSCRIPT_COMMITMENT = '3c5c93248148e2b005ddb351bb506f0b830cec149a1b03791949c983d4336a76';

describe('assets', () => {
  it('encodes asset transfer payloads exactly', () => {
    expect(bytesToHex(encodeAssetTransferPayload('ASSET', 1n))).toBe(
      '72766e740541535345540100000000000000'
    );
  });

  it('encodes transfer scripts for AuthScript outputs', () => {
    expect(bytesToHex(encodeAssetTransferScript(AUTHSCRIPT_TEST, '#OTHER1', xnaToSatoshis(9)))).toBe(
      `5120${AUTHSCRIPT_COMMITMENT}c01472766e7407234f544845523100e9a4350000000075`
    );
  });

  it('encodes new asset, owner and reissue payloads', () => {
    expect(bytesToHex(encodeNewAssetPayload('OTHER1', 1n, 0, true))).toBe(
      '72766e71064f54484552310100000000000000000100'
    );
    expect(bytesToHex(encodeOwnerAssetPayload('OTHER1!'))).toBe(
      '72766e6f074f544845523121'
    );
    expect(bytesToHex(encodeReissueAssetPayload('OTHER1', 1n, 0, true))).toBe(
      '72766e72064f544845523101000000000000000001'
    );
  });

  it('separates owner issuance scripts from owner transfer scripts', () => {
    const ownerIssue = createOwnerAssetIssueOutput(LEGACY_TEST, 'OTHER1!');
    const ownerTransfer = createOwnerAssetTransferOutput(LEGACY_TEST, 'OTHER1!');

    expect(ownerIssue.scriptPubKeyHex).toContain('72766e6f');
    expect(ownerTransfer.scriptPubKeyHex).toContain('72766e74');
    expect(ownerTransfer.scriptPubKeyHex).not.toContain('72766e6f');
  });

  it('encodes null-asset tag scripts for AuthScript outputs canonically', () => {
    expect(bytesToHex(encodeNullAssetTagScript(AUTHSCRIPT_TEST, '#OTHER1', 'tag', 'strict'))).toBe(
      `c05120${AUTHSCRIPT_COMMITMENT}0907234f544845523101`
    );
    expect(() => encodeNullAssetTagScript(AUTHSCRIPT_TEST, '#OTHER1', 'tag', 'hash20')).toThrow(
      /hash20 null-asset mode is not supported/
    );
  });

  it('encodes verifier and global restriction scripts', () => {
    expect(bytesToHex(encodeVerifierStringScript('TAG&KYC'))).toBe(
      'c0500807544147264b5943'
    );
    expect(bytesToHex(encodeGlobalRestrictionScript('$PRINTE', 3))).toBe(
      'c050500907245052494e544503'
    );
  });

  it('encodes transferwithmessage outputs', () => {
    const output = createTransferWithMessageOutput({
      address: LEGACY_TEST,
      assetName: 'ASSET',
      amountRaw: 1n,
      message: '9c2c8e121a0139ba39bffd3ca97267bca9d4c0c1e84ac0c34a883c28e7a912ca',
      expireTime: 123n
    });

    expect(output.valueSats).toBe(0n);
    expect(output.scriptPubKeyHex).toContain('72766e740541535345540100000000000000');
    expect(output.scriptPubKeyHex).toContain('54209c2c8e121a0139ba39bffd3ca97267bca9d4c0c1e84ac0c34a883c28e7a912ca');
    expect(output.scriptPubKeyHex.endsWith('7b0000000000000075')).toBe(true);
  });
});
