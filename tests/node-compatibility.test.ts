import { describe, expect, it } from 'vitest';
import {
  createFreezeAssetTransaction,
  createFreezeAddressesTransaction,
  createIssueRestrictedTransaction,
  createReissueRestrictedTransaction,
  getBurnAddressForOperation,
  getBurnAmountSats,
  xnaToSatoshis
} from '../src/index.js';
import {
  NODE_COMPAT_INPUTS,
  NODE_COMPAT_LEGACY_ADDRESS,
  NODE_COMPAT_PQ_ADDRESS,
  NODE_COMPAT_BURN_TAG,
  NODE_FIXTURE_FREEZE_ADDRESSES,
  NODE_FIXTURE_ISSUE_RESTRICTED,
  NODE_FIXTURE_REISSUE_RESTRICTED,
  NODE_FIXTURE_REISSUE_RESTRICTED_NO_VERIFIER,
  NODE_FIXTURE_UNFREEZE_ADDRESSES,
  NODE_FIXTURE_UNFREEZE_ASSET
} from './fixtures/node-compatibility.js';

describe('node compatibility fixtures', () => {
  it('matches node-style issue_restricted raw transaction exactly', () => {
    const built = createIssueRestrictedTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      burnAddress: getBurnAddressForOperation('xna-pq-test', 'ISSUE_RESTRICTED'),
      burnAmountSats: getBurnAmountSats('ISSUE_RESTRICTED'),
      xnaChangeAddress: NODE_COMPAT_PQ_ADDRESS,
      xnaChangeSats: xnaToSatoshis(2),
      toAddress: NODE_COMPAT_PQ_ADDRESS,
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
      xnaChangeAddress: NODE_COMPAT_PQ_ADDRESS,
      xnaChangeSats: xnaToSatoshis(3),
      toAddress: NODE_COMPAT_PQ_ADDRESS,
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
      xnaChangeAddress: NODE_COMPAT_PQ_ADDRESS,
      xnaChangeSats: xnaToSatoshis(3),
      toAddress: NODE_COMPAT_PQ_ADDRESS,
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

  it('matches node-style unfreeze_asset raw transaction exactly', () => {
    const built = createFreezeAssetTransaction({
      inputs: [...NODE_COMPAT_INPUTS],
      assetName: '$PRINTE',
      operation: 'unfreeze',
      ownerChangeAddress: NODE_COMPAT_LEGACY_ADDRESS,
      xnaChangeAddress: NODE_COMPAT_LEGACY_ADDRESS,
      xnaChangeSats: 12345n
    });

    expect(built.rawTx).toBe(NODE_FIXTURE_UNFREEZE_ASSET.rawTx);
    expect(built.outputs.map((output) => output.scriptPubKeyHex)).toEqual(
      NODE_FIXTURE_UNFREEZE_ASSET.outputScripts
    );
  });
});
