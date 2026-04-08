import { describe, expect, it } from 'vitest';
import {
  createFreezeAssetTransaction,
  createIssueDepinTransaction,
  createIssueRestrictedTransaction,
  createPaymentTransaction,
  createQualifierTagTransaction,
  createStandardAssetTransferTransaction,
  getBurnAddressForOperation,
  getBurnAmountSats,
  xnaToSatoshis
} from '../src/index.js';

const LEGACY_TEST = 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA';
const PQ_TEST = 'tnq1ps6h07gxnzwrgk0hpzaqdzyavgl7j98kz4nfkk3';

describe('builders', () => {
  it('creates standard payment transactions', () => {
    const built = createPaymentTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 1 }],
      payments: [{ address: LEGACY_TEST, valueSats: 5000n }]
    });

    expect(built.outputs).toHaveLength(1);
    expect(built.rawTx).toBe(
      `0200000001${'11'.repeat(32)}0100000000ffffffff0188130000000000001976a914e295c733ad2c8e92954d547603f9f63d99eae6c488ac00000000`
    );
  });

  it('reproduces the known PQ TAG raw transaction exactly in hash20 mode', () => {
    const built = createQualifierTagTransaction({
      qualifierName: '#OTHER1',
      operation: 'tag',
      targetAddresses: [PQ_TEST],
      inputs: [
        {
          txid: 'cd3a248d3c8061fce20a251b6d4395811a53c0594049d180f587223c10ecee09',
          vout: 1
        },
        {
          txid: 'cd3a248d3c8061fce20a251b6d4395811a53c0594049d180f587223c10ecee09',
          vout: 2
        }
      ],
      burnAddress: 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA',
      burnAmountSats: 20000000n,
      xnaChangeAddress: PQ_TEST,
      xnaChangeSats: 3377843585545n,
      qualifierChangeAddress: PQ_TEST,
      qualifierChangeAmountRaw: 900000000n,
      nullAssetDestinationMode: 'hash20'
    });

    expect(built.rawTx).toBe(
      '020000000209eeec103c2287f580d1494059c0531a8195436d1b250ae2fc61803c8d243acd0100000000ffffffff09eeec103c2287f580d1494059c0531a8195436d1b250ae2fc61803c8d243acd0200000000ffffffff04002d3101000000001976a914e295c733ad2c8e92954d547603f9f63d99eae6c488ac09c22a771203000016511486aeff20d313868b3ee11740d113ac47fd229ec200000000000000002d511486aeff20d313868b3ee11740d113ac47fd229ec2c01472766e7407234f544845523100e9a4350000000075000000000000000020c01486aeff20d313868b3ee11740d113ac47fd229ec20907234f54484552310100000000'
    );
    expect(built.outputs[3].scriptPubKeyHex).toBe(
      'c01486aeff20d313868b3ee11740d113ac47fd229ec20907234f544845523101'
    );
  });

  it('creates restricted asset transactions with stripped verifier strings', () => {
    const built = createIssueRestrictedTransaction({
      inputs: [
        { txid: '11'.repeat(32), vout: 0 },
        { txid: '22'.repeat(32), vout: 1 }
      ],
      burnAddress: getBurnAddressForOperation('xna-pq-test', 'ISSUE_RESTRICTED'),
      burnAmountSats: getBurnAmountSats('ISSUE_RESTRICTED'),
      xnaChangeAddress: PQ_TEST,
      xnaChangeSats: xnaToSatoshis(2),
      toAddress: PQ_TEST,
      assetName: '$PRINTE',
      quantityRaw: xnaToSatoshis(100),
      verifierString: '#TAG & #KYC',
      units: 0,
      reissuable: true
    });

    expect(built.outputs).toHaveLength(5);
    expect(built.outputs[2].scriptPubKeyHex).toBe('c0500a092354414726234b5943');
  });

  it('creates DEPIN transactions with explicit DEPIN rules', () => {
    const built = createIssueDepinTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 0 }],
      burnAddress: getBurnAddressForOperation('xna-pq-test', 'ISSUE_DEPIN'),
      burnAmountSats: getBurnAmountSats('ISSUE_DEPIN'),
      xnaChangeAddress: PQ_TEST,
      xnaChangeSats: xnaToSatoshis(1),
      toAddress: PQ_TEST,
      assetName: '&SENSOR',
      quantityRaw: 1n
    });

    expect(built.outputs).toHaveLength(4);
    expect(built.outputs[0].valueSats).toBe(1000000000n);
    expect(built.outputs[3].scriptPubKeyHex).toContain('72766e71');
    expect(built.outputs[3].scriptPubKeyHex).toContain('2653454e534f52');
  });

  it('rejects invalid DEPIN names', () => {
    expect(() =>
      createIssueDepinTransaction({
        inputs: [{ txid: '11'.repeat(32), vout: 0 }],
        burnAddress: getBurnAddressForOperation('xna-pq-test', 'ISSUE_DEPIN'),
        burnAmountSats: getBurnAmountSats('ISSUE_DEPIN'),
        xnaChangeAddress: PQ_TEST,
        xnaChangeSats: 1n,
        toAddress: PQ_TEST,
        assetName: 'SENSOR',
        quantityRaw: 1n
      })
    ).toThrow(/Invalid DEPIN asset name/);
  });

  it('creates global freeze transactions with owner return and global restriction output', () => {
    const built = createFreezeAssetTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 0 }],
      assetName: '$PRINTE',
      operation: 'freeze',
      ownerChangeAddress: PQ_TEST,
      xnaChangeAddress: PQ_TEST,
      xnaChangeSats: 1n
    });

    expect(built.outputs).toHaveLength(3);
    expect(built.outputs[2].scriptPubKeyHex).toBe('c050500907245052494e544503');
  });

  it('creates mixed asset transfer transactions', () => {
    const built = createStandardAssetTransferTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 0 }],
      payments: [{ address: LEGACY_TEST, valueSats: 1000n }],
      transfers: [{ address: PQ_TEST, assetName: 'ASSET', amountRaw: 1n }],
      transferMessages: [{
        address: LEGACY_TEST,
        assetName: 'ASSET',
        amountRaw: 1n,
        message: '9c2c8e121a0139ba39bffd3ca97267bca9d4c0c1e84ac0c34a883c28e7a912ca',
        expireTime: 123n
      }]
    });

    expect(built.outputs).toHaveLength(3);
    expect(built.outputs[1].scriptPubKeyHex).toContain('72766e74054153534554');
    expect(built.outputs[2].scriptPubKeyHex).toContain('54209c2c8e121a0139ba39bffd3ca97267bca9d4c0c1e84ac0c34a883c28e7a912ca');
  });
});
