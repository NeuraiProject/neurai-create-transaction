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
// Kept as a NEGATIVE fixture: appending the asset wrapper to a bare covenant
// is consensus-invalid on every network (node OP_XNA_ASSET placement rules,
// tmp/PLAN-ADAPTACION-NODO-2026-08.md §3). A real production covenant makes a
// better rejection vector than a synthetic script; there is no need to
// regenerate it when the covenant layout changes.
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
  // Transfer to raw scriptPubKey — only P2PKH-shape (25B) and AuthScript-shape
  // (34B) survive the node's OP_XNA_ASSET placement rules; anything else must
  // be rejected locally instead of producing a consensus-invalid output.
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

  it('encodeAssetTransferScriptToScript matches address-based variant for AuthScript spk', () => {
    const spk = `5120${AUTHSCRIPT_COMMITMENT}`;
    const viaAddr = encodeAssetTransferScript(AUTHSCRIPT_TEST, 'CAT', 100n);
    const viaSpk = encodeAssetTransferScriptToScript(spk, 'CAT', 100n);

    expect(bytesToHex(viaSpk)).toBe(bytesToHex(viaAddr));
  });

  it('rejects a bare covenant scriptPubKey (consensus placement rules)', () => {
    expect(() =>
      createAssetTransferToScriptOutput({
        scriptPubKeyHex: COVENANT_SPK_FIXTURE_HEX,
        assetName: 'CAT',
        amountRaw: 100n
      })
    ).toThrow(/OP_XNA_ASSET placement rules/);
  });

  it('rejects near-valid prefixes with the wrong shape', () => {
    const p2pkh = bytesToHex(encodeP2PKHScript(LEGACY_TEST));
    const nearValid = [
      // P2PKH with a 0x13 hash push (24-byte script).
      '76a913' + 'e2'.repeat(19) + '88ac',
      // P2PKH with a 0x15 hash push (26-byte script).
      '76a915' + 'e2'.repeat(21) + '88ac',
      // Valid 25-byte P2PKH plus one trailing byte (c0 would land at 26).
      p2pkh + '00',
      // OP_1 with a 33-byte push (35-byte script).
      '5121' + 'ab'.repeat(33),
      // Valid 34-byte AuthScript plus one trailing byte (c0 would land at 35).
      `5120${AUTHSCRIPT_COMMITMENT}00`,
      // Empty script.
      ''
    ];

    for (const scriptPubKeyHex of nearValid) {
      expect(
        () =>
          createAssetTransferToScriptOutput({
            scriptPubKeyHex,
            assetName: 'CAT',
            amountRaw: 1n
          }),
        `script ${scriptPubKeyHex || '(empty)'} should be rejected`
      ).toThrow(/OP_XNA_ASSET placement rules/);
    }
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
