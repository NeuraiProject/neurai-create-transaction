import { describe, expect, it } from 'vitest';
import {
  createAssetTransferToScriptOutput,
  createOwnerAssetIssueOutput,
  createOwnerAssetTransferOutput,
  createTransferWithMessageOutput,
  encodeAssetTransferPayload,
  encodeAssetTransferScript,
  encodeAssetTransferScriptToScript,
  encodeGlobalRestrictionScript,
  encodeNewAssetPayload,
  encodeNullAssetTagScript,
  encodeOwnerAssetPayload,
  encodeReissueAssetPayload,
  encodeVerifierStringScript,
  xnaToSatoshis
} from '../src/assets.js';
import { encodeP2PKHScript } from '../src/address.js';
import { bytesToHex } from '../src/bytes.js';

const LEGACY_TEST = 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA';
const AUTHSCRIPT_TEST = 'tnq1p83wfxfypfr3tqpwakdgmk5r0pwpsemq5ngdsx7gef8yc84pndfmqjer8rk';
const AUTHSCRIPT_COMMITMENT = '3c5c93248148e2b005ddb351bb506f0b830cec149a1b03791949c983d4336a76';

// Fixture: scriptPubKey of a partial-fill sell-order covenant produced by
// @neuraiproject/neurai-scripts v0.1.1 (legacy variant, ECDSA cancel).
//
//   buildPartialFillScriptHex({
//     sellerAddress: 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA',
//     tokenId: 'CAT',
//     unitPriceSats: 100_000_000n,
//   })
//
// Regenerate this fixture whenever `neurai-scripts` changes the covenant
// layout (see §4.1 of plan-adaptacion-create-transaction-v2.md). These tests
// verify wrapper shape only — they do NOT detect drift of the covenant
// itself; that detection happens in consumers (neurai-private-dex on testnet).
const COVENANT_SPK_FIXTURE_HEX =
  '6376a914e295c733ad2c8e92954d547603f9f63d99eae6c488ac67760400e1f5059500cc7ca26900cd1976a914e295c733ad2c8e92954d547603f9f63d99eae6c488ac88765152ce885151ce034341548852cd53b6885251ce03434154885252ce780052cf7c9488755168';

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

  // ---------------------------------------------------------------------------
  // Transfer to raw scriptPubKey (covenants, P2SH, bare non-standard locks)
  // ---------------------------------------------------------------------------

  it('encodeAssetTransferScriptToScript matches address-based variant when fed the same spk', () => {
    const spk = encodeP2PKHScript(LEGACY_TEST);
    const viaAddr = encodeAssetTransferScript(LEGACY_TEST, 'CAT', 100n);
    const viaSpkBytes = encodeAssetTransferScriptToScript(spk, 'CAT', 100n);
    const viaSpkHex = encodeAssetTransferScriptToScript(bytesToHex(spk), 'CAT', 100n);

    expect(bytesToHex(viaSpkBytes)).toBe(bytesToHex(viaAddr));
    expect(bytesToHex(viaSpkHex)).toBe(bytesToHex(viaAddr));
  });

  it('encodeAssetTransferScriptToScript preserves transferwithmessage payload shape', () => {
    const spk = encodeP2PKHScript(LEGACY_TEST);
    const viaAddr = encodeAssetTransferScript(
      LEGACY_TEST,
      'ASSET',
      1n,
      '9c2c8e121a0139ba39bffd3ca97267bca9d4c0c1e84ac0c34a883c28e7a912ca',
      123n
    );
    const viaSpk = encodeAssetTransferScriptToScript(
      spk,
      'ASSET',
      1n,
      '9c2c8e121a0139ba39bffd3ca97267bca9d4c0c1e84ac0c34a883c28e7a912ca',
      123n
    );
    expect(bytesToHex(viaSpk)).toBe(bytesToHex(viaAddr));
  });

  it('createAssetTransferToScriptOutput wraps a covenant scriptPubKey correctly', () => {
    const out = createAssetTransferToScriptOutput({
      scriptPubKeyHex: COVENANT_SPK_FIXTURE_HEX,
      assetName: 'CAT',
      amountRaw: 100n
    });

    // 1) The resulting scriptPubKey starts with the covenant bytes verbatim.
    expect(out.scriptPubKeyHex.startsWith(COVENANT_SPK_FIXTURE_HEX)).toBe(true);

    // 2) Immediately after the covenant comes OP_XNA_ASSET (0xc0).
    const tailHex = out.scriptPubKeyHex.slice(COVENANT_SPK_FIXTURE_HEX.length);
    expect(tailHex.slice(0, 2)).toBe('c0');

    // 3) Script ends with OP_DROP (0x75).
    expect(tailHex.endsWith('75')).toBe(true);

    // 4) Asset-only output carries no XNA.
    expect(out.valueSats).toBe(0n);

    // 5) Transfer payload for "CAT" 100 (amountRaw=100 → 8-byte LE = 6400000000000000).
    expect(out.scriptPubKeyHex).toContain('72766e7403434154');   // 'rvnt' + 0x03 + 'CAT'
    expect(out.scriptPubKeyHex).toContain('6400000000000000');   // 100n little-endian
  });

  it('createAssetTransferToScriptOutput rejects malformed hex', () => {
    expect(() =>
      createAssetTransferToScriptOutput({
        scriptPubKeyHex: 'zz',
        assetName: 'CAT',
        amountRaw: 1n
      })
    ).toThrow(/Invalid recipientScriptPubKey/);
  });
});
