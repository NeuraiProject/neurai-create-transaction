/**
 * The three behaviours this library got wrong relative to the node, pinned.
 *
 * Each one was measured against `neurai-regtest-depin:347362b` before being
 * fixed; the vectors it is compared to live in
 * `tests/fixtures/node-compatibility.ts` with their provenance.
 */

import { describe, expect, it } from 'vitest';
import {
  assertDepinNetwork,
  createFreezeAddressesTransaction,
  createFreezeAssetTransaction,
  createFromOperation,
  createReissueAssetOutput,
  createReissueRestrictedTransaction,
  createReissueTransaction,
  encodeReissueAssetPayload,
  encodeReissueAssetScript,
  getBurnAddressForOperation,
  REGTEST_GLOBAL_BURN_ADDRESS
} from '../src/index.js';
import type { SupportedNetwork } from '../src/index.js';

const INPUTS = [{ txid: '11'.repeat(32), vout: 0 }];
const LEGACY_TEST = 'tKCkEUQGbZqX91vyo2mpZ23pmYwfWCVfan';

/** Last byte of the last output: the null-asset data flag. */
function restrictionFlag(scriptPubKeyHex: string): string {
  return scriptPubKeyHex.slice(-2);
}

/** The units byte of a reissue payload: second-to-last, before `reissuable`. */
function reissueUnitsByte(scriptPubKeyHex: string): string {
  // ... <amount:8B> <units:1B> <reissuable:1B> OP_DROP
  return scriptPubKeyHex.slice(-6, -4);
}

describe('global restriction flag (§2.1)', () => {
  it('freezes with 0x01', () => {
    const built = createFreezeAssetTransaction({
      inputs: INPUTS,
      assetName: '$PROBE',
      operation: 'freeze',
      ownerChangeAddress: LEGACY_TEST
    });
    expect(restrictionFlag(built.outputs.at(-1)!.scriptPubKeyHex)).toBe('01');
  });

  it('unfreezes with 0x00', () => {
    const built = createFreezeAssetTransaction({
      inputs: INPUTS,
      assetName: '$PROBE',
      operation: 'unfreeze',
      ownerChangeAddress: LEGACY_TEST
    });
    expect(restrictionFlag(built.outputs.at(-1)!.scriptPubKeyHex)).toBe('00');
  });

  it('never emits 0x02 or 0x03 again', () => {
    for (const operation of ['freeze', 'unfreeze'] as const) {
      const built = createFreezeAssetTransaction({
        inputs: INPUTS,
        assetName: '$PROBE',
        operation,
        ownerChangeAddress: LEGACY_TEST
      });
      expect(['02', '03']).not.toContain(restrictionFlag(built.outputs.at(-1)!.scriptPubKeyHex));
    }
  });

  it('leaves per-address freeze/unfreeze on 0x01 / 0x00', () => {
    // These were already correct and accepted by the node; the fix must not
    // have reached them.
    for (const [operation, flag] of [['freeze', '01'], ['unfreeze', '00']] as const) {
      const built = createFreezeAddressesTransaction({
        inputs: INPUTS,
        assetName: '$PROBE',
        operation,
        targetAddresses: [LEGACY_TEST],
        ownerChangeAddress: LEGACY_TEST
      });
      expect(restrictionFlag(built.outputs.at(-1)!.scriptPubKeyHex)).toBe(flag);
    }
  });

  it('reaches the same flags through createFromOperation', () => {
    for (const [operationType, flag] of [['FREEZE_ASSET', '01'], ['UNFREEZE_ASSET', '00']] as const) {
      const built = createFromOperation({
        operationType,
        params: { inputs: INPUTS, assetName: '$PROBE', ownerChangeAddress: LEGACY_TEST }
      });
      expect(restrictionFlag(built.outputs.at(-1)!.scriptPubKeyHex)).toBe(flag);
    }
  });
});

describe('reissue units byte (§2.2)', () => {
  const payloadUnits = (units?: number): string => {
    const hex = Buffer.from(
      encodeReissueAssetPayload('PROBE', 500000000n, units, true)
    ).toString('hex');
    // marker(3) + type(1) + len(1) + name + amount(8) + units(1) + reissuable(1)
    return hex.slice(-4, -2);
  };

  it('encodes omitted units as 0xff (keep)', () => {
    expect(payloadUnits(undefined)).toBe('ff');
  });

  it('encodes an explicit -1 as 0xff', () => {
    expect(payloadUnits(-1)).toBe('ff');
  });

  it('encodes an explicit 0 as 0x00, not 0xff', () => {
    expect(payloadUnits(0)).toBe('00');
  });

  it('encodes 1..8 as themselves', () => {
    for (let units = 1; units <= 8; units += 1) {
      expect(payloadUnits(units)).toBe(units.toString(16).padStart(2, '0'));
    }
  });

  it('rejects values outside -1..8 instead of masking them', () => {
    // `units & 0xff` used to turn -2 into 0xfe and 255 into 0xff, i.e. it
    // manufactured a valid-looking "unchanged" byte out of an invalid input.
    for (const units of [-2, 9, 255, 1.5, Number.NaN]) {
      expect(() => payloadUnits(units)).toThrow(/Invalid reissue units/);
    }
  });

  it('applies the same contract at every layer', () => {
    const layers: Array<[string, (units?: number) => string]> = [
      ['encodeReissueAssetScript', (units) =>
        reissueUnitsByte(Buffer.from(
          encodeReissueAssetScript(LEGACY_TEST, 'PROBE', 500000000n, units, true)
        ).toString('hex'))],
      ['createReissueAssetOutput', (units) =>
        reissueUnitsByte(createReissueAssetOutput({
          address: LEGACY_TEST, assetName: 'PROBE', quantityRaw: 500000000n, units
        }).scriptPubKeyHex)],
      ['createReissueTransaction', (units) =>
        reissueUnitsByte(createReissueTransaction({
          inputs: INPUTS, toAddress: LEGACY_TEST, assetName: 'PROBE',
          quantityRaw: 500000000n, units, ownerChangeAddress: LEGACY_TEST
        }).outputs.at(-1)!.scriptPubKeyHex)],
      ['createReissueRestrictedTransaction', (units) =>
        reissueUnitsByte(createReissueRestrictedTransaction({
          inputs: INPUTS, toAddress: LEGACY_TEST, assetName: '$PROBE',
          quantityRaw: 500000000n, units, ownerChangeAddress: LEGACY_TEST
        }).outputs.at(-1)!.scriptPubKeyHex)]
    ];

    for (const [name, encode] of layers) {
      expect(encode(undefined), `${name}: omitted`).toBe('ff');
      expect(encode(-1), `${name}: -1`).toBe('ff');
      expect(encode(0), `${name}: 0`).toBe('00');
      expect(encode(8), `${name}: 8`).toBe('08');
      expect(() => encode(9), `${name}: 9`).toThrow(/Invalid reissue units/);
      expect(() => encode(-2), `${name}: -2`).toThrow(/Invalid reissue units/);
    }
  });

  it('reaches the same contract through createFromOperation', () => {
    for (const operationType of ['REISSUE', 'REISSUE_RESTRICTED'] as const) {
      const built = createFromOperation({
        operationType,
        params: {
          inputs: INPUTS, toAddress: LEGACY_TEST, assetName: '$PROBE',
          quantityRaw: 500000000n, ownerChangeAddress: LEGACY_TEST
        }
      });
      expect(reissueUnitsByte(built.outputs.at(-1)!.scriptPubKeyHex)).toBe('ff');
    }
  });

  it('leaves issuance alone: omitted units still mean 0 for a new asset', () => {
    // A new asset has no "current units" to keep, so 0 is the right default.
    // The reissue fix must not have leaked into the issue path.
    const built = createFromOperation({
      operationType: 'ISSUE_ROOT',
      params: { inputs: INPUTS, toAddress: LEGACY_TEST, assetName: 'PROBE', quantityRaw: 500000000n }
    });
    // ... <amount:8B> <units:1B> <reissuable:1B> <has_ipfs:1B> OP_DROP
    const issue = built.outputs.at(-1)!.scriptPubKeyHex;
    expect(issue.slice(-8, -6)).toBe('00');
  });
});

describe('unknown network (§2.3)', () => {
  const asNetwork = (value: string): SupportedNetwork => value as SupportedNetwork;

  it('rejects the alias "mainnet" instead of resolving it as testnet', () => {
    // The whole point: 'mainnet' used to land in the testnet branch and slip
    // past the DEPIN guard, while the canonical 'xna' triggered it.
    expect(() => assertDepinNetwork(asNetwork('mainnet'))).toThrow(/Unsupported network/);
    expect(() => getBurnAddressForOperation(asNetwork('mainnet'), 'ISSUE_ROOT'))
      .toThrow(/Unsupported network/);
  });

  it('rejects any other unrecognised label', () => {
    for (const value of ['testnet', 'regtest', 'XNA', '', 'xna-testnet']) {
      expect(() => assertDepinNetwork(asNetwork(value)), value).toThrow(/Unsupported network/);
    }
  });

  it('names the accepted values and points regtest at the global burn address', () => {
    let message = '';
    try {
      getBurnAddressForOperation(asNetwork('regtest'), 'ISSUE_SUB');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('xna-test');
    expect(message).toContain('REGTEST_GLOBAL_BURN_ADDRESS');
    expect(REGTEST_GLOBAL_BURN_ADDRESS).toBe('tBURNXXXXXXXXXXXXXXXXXXXXXXXVZLroy');
  });

  it('still activates the DEPIN guard on canonical mainnet labels', () => {
    for (const network of ['xna', 'xna-pq', 'xna-legacy'] as const) {
      expect(() => assertDepinNetwork(network), network)
        .toThrow(/only available on testnet\/regtest/);
    }
  });

  it('keeps every supported testnet label working', () => {
    for (const network of ['xna-test', 'xna-pq-test', 'xna-legacy-test'] as const) {
      expect(() => assertDepinNetwork(network), network).not.toThrow();
      expect(getBurnAddressForOperation(network, 'ISSUE_ROOT')).toMatch(/^t/);
    }
  });

  it('keeps mainnet burn addresses resolving', () => {
    expect(getBurnAddressForOperation('xna', 'ISSUE_ROOT')).toMatch(/^N/);
    expect(getBurnAddressForOperation('xna-pq', 'ISSUE_ROOT')).toMatch(/^N/);
  });

  it('accepts an undefined network, which means "do not check"', () => {
    expect(() => assertDepinNetwork(undefined)).not.toThrow();
  });
});
