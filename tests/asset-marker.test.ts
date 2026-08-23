import { describe, expect, it } from 'vitest';
import {
  assetPayloadPrefix,
  createAssetTransferOutput,
  createDepinSelfRevokeTransaction,
  createDepinTransferTransaction,
  createFreezeAddressesTransaction,
  createFreezeAssetTransaction,
  createFromOperation,
  createIssueAssetTransaction,
  createIssueDepinTransaction,
  createIssueQualifierTransaction,
  createIssueRestrictedTransaction,
  createIssueSubAssetTransaction,
  createIssueUniqueAssetTransaction,
  createOwnerAssetIssueOutput,
  createOwnerAssetTransferOutput,
  createQualifierTagTransaction,
  createReissueRestrictedTransaction,
  createReissueTransaction,
  createStandardAssetTransferTransaction,
  DEFAULT_ASSET_MARKER,
  encodeAssetTransferPayload,
  encodeAssetTransferScriptToScript,
  encodeNewAssetPayload,
  encodeOwnerAssetPayload,
  encodeP2PKHScript,
  encodeReissueAssetPayload,
  getBurnAddressForOperation,
  getBurnAmountSats,
  resolveAssetMarker,
  xnaToSatoshis
} from '../src/index.js';
import type { AssetMarker, BuiltTransaction, SerializedTxOutput } from '../src/index.js';
import { bytesToHex } from '../src/bytes.js';

// NIP-040: the marker is consensus per network and height. The library never
// infers it — the caller passes getblockchaininfo.asset_marker — so these
// tests only check that the value given is the value emitted, everywhere.

const LEGACY_TEST = 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA';
const AUTHSCRIPT_TEST = 'tnq1p83wfxfypfr3tqpwakdgmk5r0pwpsemq5ngdsx7gef8yc84pndfmqjer8rk';
const LEGACY_MAIN = 'NbURNXXXXXXXXXXXXXXXXXXXXXXXT65Gdr';
const INPUT = { txid: '11'.repeat(32), vout: 0 };

const RVN = '72766e';
const XNA = '786e61';

// Every asset payload starts with `c0 <push> <marker>`: collect the marker
// bytes of each asset output and nothing else (XNA outputs have no c0).
function markersOf(built: BuiltTransaction): string[] {
  return built.outputs
    .map((o) => /c0(?:4c)?[0-9a-f]{2}(72766e|786e61)[0-9a-f]{2}/.exec(o.scriptPubKeyHex))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[1]);
}

function expectAllMarkers(built: BuiltTransaction, marker: string, atLeast: number) {
  const found = markersOf(built);
  expect(found.length).toBeGreaterThanOrEqual(atLeast);
  expect(new Set(found)).toEqual(new Set([marker]));
}

describe('assetPayloadPrefix / resolveAssetMarker', () => {
  it('assembles the eight marker+type prefixes byte for byte', () => {
    expect(bytesToHex(assetPayloadPrefix('rvn', 'transfer'))).toBe('72766e74');
    expect(bytesToHex(assetPayloadPrefix('rvn', 'new'))).toBe('72766e71');
    expect(bytesToHex(assetPayloadPrefix('rvn', 'owner'))).toBe('72766e6f');
    expect(bytesToHex(assetPayloadPrefix('rvn', 'reissue'))).toBe('72766e72');
    expect(bytesToHex(assetPayloadPrefix('xna', 'transfer'))).toBe('786e6174');
    expect(bytesToHex(assetPayloadPrefix('xna', 'new'))).toBe('786e6171');
    expect(bytesToHex(assetPayloadPrefix('xna', 'owner'))).toBe('786e616f');
    expect(bytesToHex(assetPayloadPrefix('xna', 'reissue'))).toBe('786e6172');
  });

  it('defaults to rvn and rejects anything else', () => {
    expect(DEFAULT_ASSET_MARKER).toBe('rvn');
    expect(resolveAssetMarker(undefined)).toBe('rvn');
    expect(resolveAssetMarker('rvn')).toBe('rvn');
    expect(resolveAssetMarker('xna')).toBe('xna');
    // null is what a missing/null JSON field becomes: never a silent default.
    for (const bad of [null, 'XNA', 'rvn ', true, 1, {}, 'auto']) {
      expect(() => resolveAssetMarker(bad)).toThrow(/Invalid assetMarker/);
      expect(() => assetPayloadPrefix(bad as AssetMarker, 'transfer')).toThrow(/Invalid assetMarker/);
    }
    expect(() => assetPayloadPrefix('xna', 'bogus' as never)).toThrow(/Unknown asset payload type/);
  });
});

describe('payload helpers', () => {
  it('emit the requested marker and keep the rvn default', () => {
    expect(bytesToHex(encodeAssetTransferPayload('ASSET', 1n))).toBe('72766e740541535345540100000000000000');
    expect(bytesToHex(encodeAssetTransferPayload('ASSET', 1n, undefined, undefined, { assetMarker: 'xna' }))).toBe(
      '786e61740541535345540100000000000000'
    );
    expect(bytesToHex(encodeNewAssetPayload('OTHER1', 1n, 0, true, undefined, { assetMarker: 'xna' }))).toBe(
      '786e6171064f54484552310100000000000000000100'
    );
    expect(bytesToHex(encodeOwnerAssetPayload('OTHER1!', { assetMarker: 'xna' }))).toBe('786e616f074f544845523121');
    expect(bytesToHex(encodeReissueAssetPayload('OTHER1', 1n, 0, true, undefined, { assetMarker: 'xna' }))).toBe(
      '786e6172064f544845523101000000000000000001'
    );
  });

  it('positional output helpers take a trailing options argument', () => {
    expect(createAssetTransferOutput(LEGACY_TEST, 'CAT', 1n).scriptPubKeyHex).toContain(RVN + '74');
    expect(createAssetTransferOutput(LEGACY_TEST, 'CAT', 1n, { assetMarker: 'xna' }).scriptPubKeyHex).toContain(XNA + '74');
    expect(createOwnerAssetIssueOutput(LEGACY_TEST, 'CAT!', { assetMarker: 'xna' }).scriptPubKeyHex).toContain(XNA + '6f');
    expect(createOwnerAssetTransferOutput(LEGACY_TEST, 'CAT!', { assetMarker: 'xna' }).scriptPubKeyHex).toContain(XNA + '74');
    const spk = bytesToHex(encodeP2PKHScript(LEGACY_TEST));
    expect(bytesToHex(encodeAssetTransferScriptToScript(spk, 'CAT', 1n, undefined, undefined, { assetMarker: 'xna' }))).toContain(
      XNA + '74'
    );
  });

  it('obeys the marker regardless of the address network (no inference)', () => {
    expect(createAssetTransferOutput(LEGACY_MAIN, 'CAT', 1n, { assetMarker: 'xna' }).scriptPubKeyHex).toContain(XNA);
    expect(createAssetTransferOutput(AUTHSCRIPT_TEST, 'CAT', 1n).scriptPubKeyHex).toContain(RVN);
  });
});

describe('builders propagate the transaction-level marker to every asset output', () => {
  const envelope = (op: 'ISSUE_ROOT' | 'ISSUE_SUB' | 'ISSUE_UNIQUE' | 'ISSUE_QUALIFIER' | 'ISSUE_RESTRICTED' | 'REISSUE' | 'REISSUE_RESTRICTED' | 'ISSUE_DEPIN' | 'TAG_ADDRESS') => ({
    inputs: [INPUT],
    burnAddress: getBurnAddressForOperation('xna-test', op),
    burnAmountSats: getBurnAmountSats(op),
    xnaChangeAddress: LEGACY_TEST,
    xnaChangeSats: xnaToSatoshis(1)
  });

  const cases: Array<[string, (assetMarker: AssetMarker) => BuiltTransaction, number]> = [
    ['standard transfer (transfers + message + to script)', (assetMarker) => createStandardAssetTransferTransaction({
      inputs: [INPUT], assetMarker,
      transfers: [{ address: LEGACY_TEST, assetName: 'CAT', amountRaw: 1n }],
      transferMessages: [{ address: AUTHSCRIPT_TEST, assetName: 'CAT', amountRaw: 1n, message: '9c2c8e121a0139ba39bffd3ca97267bca9d4c0c1e84ac0c34a883c28e7a912ca' }],
      transfersToScript: [{ scriptPubKeyHex: bytesToHex(encodeP2PKHScript(LEGACY_TEST)), assetName: 'CAT', amountRaw: 1n }]
    }), 3],
    ['issue root (owner + issue)', (assetMarker) => createIssueAssetTransaction({ ...envelope('ISSUE_ROOT'), assetMarker, toAddress: LEGACY_TEST, assetName: 'CAT', quantityRaw: 1n }), 2],
    ['issue sub (parent owner transfer + owner + issue)', (assetMarker) => createIssueSubAssetTransaction({ ...envelope('ISSUE_SUB'), assetMarker, toAddress: LEGACY_TEST, assetName: 'CAT/SUB', quantityRaw: 1n }), 3],
    ['issue DEPIN root', (assetMarker) => createIssueDepinTransaction({ ...envelope('ISSUE_DEPIN'), assetMarker, toAddress: LEGACY_TEST, assetName: '&DEVICE', quantityRaw: 1n }), 2],
    ['issue sub-DEPIN', (assetMarker) => createIssueDepinTransaction({ ...envelope('ISSUE_DEPIN'), assetMarker, toAddress: LEGACY_TEST, assetName: '&DEVICE/SENSOR', quantityRaw: 1n }), 3],
    ['DEPIN transfer (transfer + owner escort)', (assetMarker) => createDepinTransferTransaction({ inputs: [INPUT], assetMarker, transfers: [{ address: LEGACY_TEST, assetName: '&DEVICE', amountRaw: 1n }], ownerChangeAddress: LEGACY_TEST }), 2],
    ['DEPIN self-revoke (self transfer)', (assetMarker) => createDepinSelfRevokeTransaction({ inputs: [INPUT], assetMarker, assetName: '&DEVICE', holderAddress: LEGACY_TEST, amountRaw: 1n }), 1],
    ['issue unique (owner transfer + 2 issues)', (assetMarker) => createIssueUniqueAssetTransaction({ ...envelope('ISSUE_UNIQUE'), assetMarker, toAddress: LEGACY_TEST, rootName: 'CAT', assetTags: ['A', 'B'] }), 3],
    ['issue sub-qualifier (root change + issue)', (assetMarker) => createIssueQualifierTransaction({ ...envelope('ISSUE_QUALIFIER'), assetMarker, toAddress: LEGACY_TEST, assetName: '#ROOT/#SUB', quantityRaw: 1n }), 2],
    ['issue restricted (owner transfer + issue)', (assetMarker) => createIssueRestrictedTransaction({ ...envelope('ISSUE_RESTRICTED'), assetMarker, toAddress: LEGACY_TEST, assetName: '$CAT', quantityRaw: 1n, verifierString: '#KYC' }), 2],
    ['reissue (owner transfer + reissue)', (assetMarker) => createReissueTransaction({ ...envelope('REISSUE'), assetMarker, toAddress: LEGACY_TEST, assetName: 'CAT', quantityRaw: 1n }), 2],
    ['reissue restricted', (assetMarker) => createReissueRestrictedTransaction({ ...envelope('REISSUE_RESTRICTED'), assetMarker, toAddress: LEGACY_TEST, assetName: '$CAT', quantityRaw: 1n, verifierString: '#KYC' }), 2],
    ['tag addresses (qualifier change)', (assetMarker) => createQualifierTagTransaction({ ...envelope('TAG_ADDRESS'), assetMarker, qualifierName: '#KYC', operation: 'tag', targetAddresses: [LEGACY_TEST], qualifierChangeAddress: LEGACY_TEST, qualifierChangeAmountRaw: 1n }), 1],
    ['freeze addresses (owner transfer)', (assetMarker) => createFreezeAddressesTransaction({ inputs: [INPUT], assetMarker, assetName: '$CAT', operation: 'freeze', targetAddresses: [AUTHSCRIPT_TEST], ownerChangeAddress: LEGACY_TEST }), 1],
    ['freeze asset (owner transfer)', (assetMarker) => createFreezeAssetTransaction({ inputs: [INPUT], assetMarker, assetName: '$CAT', operation: 'freeze', ownerChangeAddress: LEGACY_TEST }), 1],
    ['createFromOperation passes params through', (assetMarker) => createFromOperation({ operationType: 'ISSUE_ROOT', params: { ...envelope('ISSUE_ROOT'), assetMarker, toAddress: LEGACY_TEST, assetName: 'CAT', quantityRaw: 1n } }), 2]
  ];

  it.each(cases)('%s → xna when asked, rvn by default', (_name, build, assetOutputs) => {
    expectAllMarkers(build('xna'), XNA, assetOutputs);
    expectAllMarkers(build('rvn'), RVN, assetOutputs);
    expectAllMarkers(build(undefined as unknown as AssetMarker), RVN, assetOutputs);
  });

  it('rejects an invalid transaction-level marker', () => {
    expect(() =>
      createStandardAssetTransferTransaction({
        inputs: [INPUT],
        assetMarker: 'XNA' as AssetMarker,
        transfers: [{ address: LEGACY_TEST, assetName: 'CAT', amountRaw: 1n }]
      })
    ).toThrow(/Invalid assetMarker/);
  });
});

describe('precedence and opacity', () => {
  it('an output-level marker overrides the transaction-level one, in both directions', () => {
    const built = createStandardAssetTransferTransaction({
      inputs: [INPUT],
      assetMarker: 'xna',
      transfers: [
        { address: LEGACY_TEST, assetName: 'CAT', amountRaw: 1n },
        { address: LEGACY_TEST, assetName: 'CAT', amountRaw: 1n, assetMarker: 'rvn' }
      ]
    });
    expect(markersOf(built)).toEqual([XNA, RVN]);

    const reverse = createStandardAssetTransferTransaction({
      inputs: [INPUT],
      transfers: [{ address: LEGACY_TEST, assetName: 'CAT', amountRaw: 1n, assetMarker: 'xna' }]
    });
    expect(markersOf(reverse)).toEqual([XNA]);
  });

  it('issue/reissue output params carry their own marker', () => {
    const built = createIssueAssetTransaction({
      inputs: [INPUT], assetMarker: 'xna', toAddress: LEGACY_TEST, assetName: 'CAT', quantityRaw: 1n
    });
    // owner (xna) + issue (xna)
    expect(markersOf(built)).toEqual([XNA, XNA]);
  });

  it('extraOutputs are appended verbatim, whatever the transaction marker', () => {
    const legacy: SerializedTxOutput = createAssetTransferOutput(LEGACY_TEST, 'OLD', 1n); // rvn
    const built = createStandardAssetTransferTransaction({
      inputs: [INPUT],
      assetMarker: 'xna',
      transfers: [{ address: LEGACY_TEST, assetName: 'CAT', amountRaw: 1n }],
      extraOutputs: [legacy]
    });
    expect(markersOf(built)).toEqual([XNA, RVN]);
    expect(built.outputs[1]).toEqual(legacy);
  });
});
