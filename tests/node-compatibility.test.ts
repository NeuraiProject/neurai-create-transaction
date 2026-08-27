import { describe, expect, it } from 'vitest';
import {
  createFreezeAssetTransaction,
  createFreezeAddressesTransaction,
  createIssueRestrictedTransaction,
  createReissueRestrictedTransaction,
  createReissueTransaction,
  getBurnAddressForOperation,
  getBurnAmountSats,
  xnaToSatoshis
} from '../src/index.js';
import {
  NODE_COMPAT_INPUTS,
  NODE_COMPAT_LEGACY_ADDRESS,
  NODE_COMPAT_AUTHSCRIPT_ADDRESS,
  NODE_COMPAT_BURN_TAG,
  NODE_FIXTURE_FREEZE_ADDRESSES,
  NODE_FIXTURE_ISSUE_RESTRICTED,
  NODE_FIXTURE_REISSUE_RESTRICTED,
  NODE_FIXTURE_REISSUE_RESTRICTED_NO_VERIFIER,
  NODE_FIXTURE_UNFREEZE_ADDRESSES,
  NODE_FIXTURE_UNFREEZE_ASSET,
  NODE_VECTOR_GLOBAL_FREEZE,
  NODE_VECTOR_GLOBAL_UNFREEZE,
  NODE_VECTOR_PROVENANCE,
  NODE_VECTOR_REISSUE_UNITS_UNCHANGED
} from './fixtures/node-compatibility.js';

describe('node compatibility fixtures', () => {
  it('matches node-style issue_restricted raw transaction exactly', () => {
    const built = createIssueRestrictedTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      burnAddress: getBurnAddressForOperation('xna-pq-test', 'ISSUE_RESTRICTED'),
      burnAmountSats: getBurnAmountSats('ISSUE_RESTRICTED'),
      xnaChangeAddress: NODE_COMPAT_AUTHSCRIPT_ADDRESS,
      xnaChangeSats: xnaToSatoshis(2),
      toAddress: NODE_COMPAT_AUTHSCRIPT_ADDRESS,
      assetName: '$PRINTE',
      quantityRaw: xnaToSatoshis(100),
      verifierString: '#TAG & #KYC',
      units: 0,
      reissuable: true
    });

    expect(built.rawTx).toBe(NODE_FIXTURE_ISSUE_RESTRICTED.rawTx);
    expect(built.outputs.map((output) => output.scriptPubKeyHex)).toEqual(
      NODE_FIXTURE_ISSUE_RESTRICTED.outputScripts
    );
  });

  it('matches node-style reissue_restricted raw transaction exactly', () => {
    const built = createReissueRestrictedTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      burnAddress: getBurnAddressForOperation('xna-pq-test', 'REISSUE_RESTRICTED'),
      burnAmountSats: getBurnAmountSats('REISSUE_RESTRICTED'),
      xnaChangeAddress: NODE_COMPAT_AUTHSCRIPT_ADDRESS,
      xnaChangeSats: xnaToSatoshis(3),
      toAddress: NODE_COMPAT_AUTHSCRIPT_ADDRESS,
      assetName: '$PRINTE',
      quantityRaw: xnaToSatoshis(5),
      verifierString: '#TRIMPO',
      units: 0,
      reissuable: false,
      ownerChangeAddress: NODE_COMPAT_LEGACY_ADDRESS
    });

    expect(built.rawTx).toBe(NODE_FIXTURE_REISSUE_RESTRICTED.rawTx);
    expect(built.outputs.map((output) => output.scriptPubKeyHex)).toEqual(
      NODE_FIXTURE_REISSUE_RESTRICTED.outputScripts
    );
  });

  it('documents the chosen behavior for reissue_restricted without verifierString', () => {
    const built = createReissueRestrictedTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      burnAddress: getBurnAddressForOperation('xna-pq-test', 'REISSUE_RESTRICTED'),
      burnAmountSats: getBurnAmountSats('REISSUE_RESTRICTED'),
      xnaChangeAddress: NODE_COMPAT_AUTHSCRIPT_ADDRESS,
      xnaChangeSats: xnaToSatoshis(3),
      toAddress: NODE_COMPAT_AUTHSCRIPT_ADDRESS,
      assetName: '$PRINTE',
      quantityRaw: xnaToSatoshis(5),
      units: 0,
      reissuable: false,
      ownerChangeAddress: NODE_COMPAT_LEGACY_ADDRESS
    });

    expect(built.rawTx).toBe(NODE_FIXTURE_REISSUE_RESTRICTED_NO_VERIFIER.rawTx);
    expect(built.outputs).toHaveLength(4);
    expect(built.outputs.map((output) => output.scriptPubKeyHex)).toEqual(
      NODE_FIXTURE_REISSUE_RESTRICTED_NO_VERIFIER.outputScripts
    );
  });

  it('matches node-style freeze_addresses raw transaction exactly', () => {
    const built = createFreezeAddressesTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      assetName: '$PRINTE',
      operation: 'freeze',
      targetAddresses: [NODE_COMPAT_LEGACY_ADDRESS, NODE_COMPAT_BURN_TAG],
      ownerChangeAddress: NODE_COMPAT_LEGACY_ADDRESS,
      xnaChangeAddress: NODE_COMPAT_LEGACY_ADDRESS,
      xnaChangeSats: 12345n
    });

    expect(built.rawTx).toBe(NODE_FIXTURE_FREEZE_ADDRESSES.rawTx);
    expect(built.outputs.map((output) => output.scriptPubKeyHex)).toEqual(
      NODE_FIXTURE_FREEZE_ADDRESSES.outputScripts
    );
  });

  it('matches node-style unfreeze_addresses raw transaction exactly', () => {
    const built = createFreezeAddressesTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      assetName: '$PRINTE',
      operation: 'unfreeze',
      targetAddresses: [NODE_COMPAT_LEGACY_ADDRESS, NODE_COMPAT_BURN_TAG],
      ownerChangeAddress: NODE_COMPAT_LEGACY_ADDRESS,
      xnaChangeAddress: NODE_COMPAT_LEGACY_ADDRESS,
      xnaChangeSats: 12345n
    });

    expect(built.rawTx).toBe(NODE_FIXTURE_UNFREEZE_ADDRESSES.rawTx);
    expect(built.outputs.map((output) => output.scriptPubKeyHex)).toEqual(
      NODE_FIXTURE_UNFREEZE_ADDRESSES.outputScripts
    );
  });

  it('no longer produces the broken unfreeze_asset vector (flag 02)', () => {
    // Regression guard, not a compatibility check. That fixture encodes the
    // pre-0.7.1 global-restriction flag, which the node rejects with
    // bad-txns-null-data-flag-must-be-0-or-1. Matching it again would mean the
    // defect came back.
    const built = createFreezeAssetTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      assetName: '$PRINTE',
      operation: 'unfreeze',
      ownerChangeAddress: NODE_COMPAT_LEGACY_ADDRESS,
      xnaChangeAddress: NODE_COMPAT_LEGACY_ADDRESS,
      xnaChangeSats: 12345n
    });

    expect(built.rawTx).not.toBe(NODE_FIXTURE_UNFREEZE_ASSET.rawTx);

    const restriction = built.outputs.at(-1)!.scriptPubKeyHex;
    expect(restriction).toBe('c050500907245052494e544500');

    // Only the flag byte moved: the correction is one byte, not a reshape.
    const broken = NODE_FIXTURE_UNFREEZE_ASSET.outputScripts.at(-1)!;
    expect(restriction.slice(0, -2)).toBe(broken.slice(0, -2));
    expect(broken.slice(-2)).toBe('02');
  });
});

describe('post-NIP-040 node vectors', () => {
  // Captured from a running node; see NODE_VECTOR_PROVENANCE and
  // scripts/generate-node-fixtures.mjs. Compared on payload/script, never on
  // the whole raw: the node's wallet picks its own inputs, change and output
  // order, so a raw captured there is not reproducible here.
  it('records where the vectors came from', () => {
    expect(NODE_VECTOR_PROVENANCE.assetMarker).toBe('xna');
    expect(NODE_VECTOR_PROVENANCE.image).toBe('neurai-regtest-depin:347362b');
    expect(NODE_VECTOR_PROVENANCE.height).toBeGreaterThan(0);
  });

  it('global freeze matches the node byte for byte', () => {
    const built = createFreezeAssetTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      assetName: NODE_VECTOR_GLOBAL_FREEZE.assetName,
      operation: 'freeze',
      ownerChangeAddress: NODE_COMPAT_LEGACY_ADDRESS
    });

    expect(built.outputs.at(-1)!.scriptPubKeyHex).toBe(NODE_VECTOR_GLOBAL_FREEZE.scriptPubKeyHex);
  });

  it('global unfreeze matches the node byte for byte', () => {
    const built = createFreezeAssetTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      assetName: NODE_VECTOR_GLOBAL_UNFREEZE.assetName,
      operation: 'unfreeze',
      ownerChangeAddress: NODE_COMPAT_LEGACY_ADDRESS
    });

    expect(built.outputs.at(-1)!.scriptPubKeyHex).toBe(NODE_VECTOR_GLOBAL_UNFREEZE.scriptPubKeyHex);
  });

  it('reissue without units matches the node payload, 0xff included', () => {
    // The node vector pays a different address, so compare from the asset
    // wrapper onwards rather than the whole script.
    const payloadOf = (scriptHex: string): string => {
      const at = scriptHex.indexOf('c013786e6172');
      expect(at).toBeGreaterThan(-1);
      return scriptHex.slice(at);
    };

    const built = createReissueTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      toAddress: NODE_COMPAT_LEGACY_ADDRESS,
      assetName: NODE_VECTOR_REISSUE_UNITS_UNCHANGED.assetName,
      quantityRaw: NODE_VECTOR_REISSUE_UNITS_UNCHANGED.amountRaw,
      ownerChangeAddress: NODE_COMPAT_LEGACY_ADDRESS,
      assetMarker: 'xna'
      // units omitted on purpose: that is what must encode 0xff
    });

    expect(payloadOf(built.outputs.at(-1)!.scriptPubKeyHex)).toBe(
      payloadOf(NODE_VECTOR_REISSUE_UNITS_UNCHANGED.scriptPubKeyHex)
    );
  });
});
