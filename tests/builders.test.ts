import { getAddressByPath, getHDKey, getNoAuthAddress } from '@neuraiproject/neurai-key';
import { describe, expect, it } from 'vitest';
import {
  createFromOperation,
  createFreezeAssetTransaction,
  createIssueAssetTransaction,
  createIssueDepinTransaction,
  createIssueRestrictedTransaction,
  createIssueSubAssetTransaction,
  createIssueUniqueAssetTransaction,
  createPaymentTransaction,
  createQualifierTagTransaction,
  createReissueTransaction,
  createStandardAssetTransferTransaction,
  encodeDestinationScript,
  getBurnAddressForOperation,
  getBurnAmountSats,
  xnaToSatoshis
} from '../src/index.js';
import { bytesToHex } from '../src/bytes.js';

const LEGACY_TEST = 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA';
const AUTHSCRIPT_TEST = 'tnq1p83wfxfypfr3tqpwakdgmk5r0pwpsemq5ngdsx7gef8yc84pndfmqjer8rk';
const AUTHSCRIPT_COMMITMENT = '3c5c93248148e2b005ddb351bb506f0b830cec149a1b03791949c983d4336a76';
const LEGACY_HD_OBJECT = getAddressByPath(
  'xna-test',
  getHDKey('xna-test', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'),
  'm/0/0'
);
const NOAUTH_OBJECT = getNoAuthAddress('xna-pq-test');

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

  it('allows extra outputs on higher-level builders for more complex transactions', () => {
    const built = createIssueAssetTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 0 }],
      burnAddress: getBurnAddressForOperation('xna-pq-test', 'ISSUE_ROOT'),
      burnAmountSats: getBurnAmountSats('ISSUE_ROOT'),
      xnaChangeAddress: AUTHSCRIPT_TEST,
      xnaChangeSats: xnaToSatoshis(1),
      toAddress: AUTHSCRIPT_TEST,
      assetName: 'EXTRA',
      quantityRaw: 1n,
      extraOutputs: [{
        valueSats: 0n,
        scriptPubKeyHex: '6a00'
      }]
    });

    expect(built.outputs[built.outputs.length - 1]?.scriptPubKeyHex).toBe('6a00');
  });

  it('accepts neurai-key address objects across builders', () => {
    const built = createPaymentTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 1 }],
      payments: [
        { address: LEGACY_HD_OBJECT, valueSats: 5000n },
        { address: NOAUTH_OBJECT, valueSats: 7000n }
      ]
    });

    expect(built.outputs[0].scriptPubKeyHex).toBe(bytesToHex(encodeDestinationScript(LEGACY_HD_OBJECT)));
    expect(built.outputs[1].scriptPubKeyHex).toBe(bytesToHex(encodeDestinationScript(NOAUTH_OBJECT)));
  });

  it('uses owner issuance for root issuance and owner transfer for unique/reissue flows', () => {
    const root = createIssueAssetTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 0 }],
      burnAddress: getBurnAddressForOperation('xna-test', 'ISSUE_ROOT'),
      burnAmountSats: getBurnAmountSats('ISSUE_ROOT'),
      xnaChangeAddress: LEGACY_TEST,
      xnaChangeSats: xnaToSatoshis(1),
      toAddress: LEGACY_TEST,
      assetName: 'MAKIER',
      quantityRaw: xnaToSatoshis(1000),
      units: 0,
      reissuable: true
    });

    const unique = createIssueUniqueAssetTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 0 }, { txid: '22'.repeat(32), vout: 1 }],
      burnAddress: getBurnAddressForOperation('xna-test', 'ISSUE_UNIQUE'),
      burnAmountSats: getBurnAmountSats('ISSUE_UNIQUE'),
      xnaChangeAddress: LEGACY_TEST,
      xnaChangeSats: xnaToSatoshis(1),
      toAddress: LEGACY_TEST,
      rootName: 'MAKIER',
      assetTags: ['001'],
      ownerTokenAddress: LEGACY_TEST
    });

    const reissue = createReissueTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 0 }, { txid: '22'.repeat(32), vout: 1 }],
      burnAddress: getBurnAddressForOperation('xna-test', 'REISSUE'),
      burnAmountSats: getBurnAmountSats('REISSUE'),
      xnaChangeAddress: LEGACY_TEST,
      xnaChangeSats: xnaToSatoshis(1),
      toAddress: LEGACY_TEST,
      assetName: 'MAKIER',
      quantityRaw: xnaToSatoshis(4),
      units: 0,
      ownerChangeAddress: LEGACY_TEST
    });

    expect(root.outputs[2].scriptPubKeyHex).toContain('72766e6f');
    expect(unique.outputs[2].scriptPubKeyHex).toContain('72766e74');
    expect(unique.outputs[2].scriptPubKeyHex).not.toContain('72766e6f');
    expect(reissue.outputs[2].scriptPubKeyHex).toContain('72766e74');
    expect(reissue.outputs[2].scriptPubKeyHex).not.toContain('72766e6f');
  });

  it('uses parent owner transfer and child owner issuance for sub-asset flows', () => {
    const sub = createIssueSubAssetTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 0 }, { txid: '22'.repeat(32), vout: 1 }],
      burnAddress: getBurnAddressForOperation('xna-test', 'ISSUE_SUB'),
      burnAmountSats: getBurnAmountSats('ISSUE_SUB'),
      xnaChangeAddress: LEGACY_TEST,
      xnaChangeSats: xnaToSatoshis(1),
      toAddress: LEGACY_TEST,
      assetName: 'MAKIER/RIVER',
      quantityRaw: xnaToSatoshis(10),
      units: 0,
      reissuable: true,
      parentOwnerAddress: LEGACY_TEST,
      ownerTokenAddress: LEGACY_TEST
    });

    expect(sub.outputs).toHaveLength(5);
    expect(sub.outputs[2].scriptPubKeyHex).toContain('72766e74');
    expect(sub.outputs[2].scriptPubKeyHex).toContain('4d414b49455221');
    expect(sub.outputs[2].scriptPubKeyHex).not.toContain('72766e6f');
    expect(sub.outputs[3].scriptPubKeyHex).toContain('72766e6f');
    expect(sub.outputs[3].scriptPubKeyHex).toContain('4d414b4945522f524956455221');
    expect(sub.outputs[4].scriptPubKeyHex).toContain('72766e71');
    expect(sub.outputs[4].scriptPubKeyHex).toContain('4d414b4945522f5249564552');
  });

  it('reproduces the known AuthScript TAG output canonically', () => {
    const built = createQualifierTagTransaction({
      qualifierName: '#OTHER1',
      operation: 'tag',
      targetAddresses: [AUTHSCRIPT_TEST],
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
      xnaChangeAddress: AUTHSCRIPT_TEST,
      xnaChangeSats: 3377843585545n,
      qualifierChangeAddress: AUTHSCRIPT_TEST,
      qualifierChangeAmountRaw: 900000000n
    });

    expect(built.outputs[3].scriptPubKeyHex).toBe(
      `c05120${AUTHSCRIPT_COMMITMENT}0907234f544845523101`
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
      xnaChangeAddress: AUTHSCRIPT_TEST,
      xnaChangeSats: xnaToSatoshis(2),
      toAddress: AUTHSCRIPT_TEST,
      assetName: '$PRINTE',
      quantityRaw: xnaToSatoshis(100),
      verifierString: '#TAG & #KYC',
      units: 0,
      reissuable: true
    });

    expect(built.outputs).toHaveLength(5);
    expect(built.outputs[2].scriptPubKeyHex).toBe('c0500807544147264b5943');
  });

  it('creates DEPIN transactions with explicit DEPIN rules', () => {
    const built = createIssueDepinTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 0 }],
      burnAddress: getBurnAddressForOperation('xna-pq-test', 'ISSUE_DEPIN'),
      burnAmountSats: getBurnAmountSats('ISSUE_DEPIN'),
      xnaChangeAddress: AUTHSCRIPT_TEST,
      xnaChangeSats: xnaToSatoshis(1),
      toAddress: AUTHSCRIPT_TEST,
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
        xnaChangeAddress: AUTHSCRIPT_TEST,
        xnaChangeSats: 1n,
        toAddress: AUTHSCRIPT_TEST,
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
      ownerChangeAddress: AUTHSCRIPT_TEST,
      xnaChangeAddress: AUTHSCRIPT_TEST,
      xnaChangeSats: 1n
    });

    expect(built.outputs).toHaveLength(3);
    expect(built.outputs[1].scriptPubKeyHex).toContain('72766e74');
    expect(built.outputs[2].scriptPubKeyHex).toBe('c050500907245052494e544503');
  });

  it('creates mixed asset transfer transactions', () => {
    const built = createStandardAssetTransferTransaction({
      inputs: [{ txid: '11'.repeat(32), vout: 0 }],
      payments: [{ address: LEGACY_TEST, valueSats: 1000n }],
      transfers: [{ address: AUTHSCRIPT_TEST, assetName: 'ASSET', amountRaw: 1n }],
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

  it('dispatches tag operations from explicit operation metadata', () => {
    const built = createFromOperation({
      operationType: 'TAG_ADDRESSES',
      params: {
        qualifierName: '#OTHER1',
        targetAddresses: [AUTHSCRIPT_TEST],
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
        xnaChangeAddress: AUTHSCRIPT_TEST,
        xnaChangeSats: 3377843585545n,
        qualifierChangeAddress: AUTHSCRIPT_TEST,
        qualifierChangeAmountRaw: 900000000n
      }
    });

    expect(built.outputs[3].scriptPubKeyHex).toBe(
      `c05120${AUTHSCRIPT_COMMITMENT}0907234f544845523101`
    );
  });

  it('dispatches sub-qualifier issuance from explicit operation metadata', () => {
    const built = createFromOperation({
      operationType: 'ISSUE_SUB_QUALIFIER',
      params: {
        inputs: [{ txid: '11'.repeat(32), vout: 0 }],
        burnAddress: getBurnAddressForOperation('xna-pq-test', 'ISSUE_SUB_QUALIFIER'),
        burnAmountSats: getBurnAmountSats('ISSUE_SUB_QUALIFIER'),
        xnaChangeAddress: AUTHSCRIPT_TEST,
        xnaChangeSats: xnaToSatoshis(1),
        toAddress: AUTHSCRIPT_TEST,
        assetName: '#ROOT/SUB',
        quantityRaw: 1n,
        rootChangeAddress: AUTHSCRIPT_TEST,
        changeQuantityRaw: xnaToSatoshis(10)
      }
    });

    expect(built.outputs).toHaveLength(4);
    expect(built.outputs[2].scriptPubKeyHex).toContain('72766e740523524f4f54');
    expect(built.outputs[3].scriptPubKeyHex).toContain('72766e71');
  });
});
