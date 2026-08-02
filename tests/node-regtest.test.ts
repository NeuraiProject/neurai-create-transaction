import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDepinSelfRevokeTransaction,
  createDepinTransferTransaction,
  createFreezeAddressesTransaction,
  createIssueDepinTransaction,
  createReissueTransaction,
  createStandardAssetTransferTransaction,
  xnaToSatoshis
} from '../src/index.js';

// Live vectors against a throwaway neuraid regtest with -assetindex and
// -addressindex. Every transaction is BUILT BY THIS LIBRARY, signed by the
// node wallet (signrawtransaction) and validated with testmempoolaccept
// before mining.
//
// Node resolution, in order:
//   1. Docker container (default: neurai-wt2 with the DePIN-branch build at
//      /root/Neurai/src). Override via NEURAI_REGTEST_CONTAINER.
//   2. Local binaries via NEURAID_BIN / NEURAI_CLI_BIN.
//   3. Neither available -> the whole suite is skipped.
const CONTAINER = process.env.NEURAI_REGTEST_CONTAINER ?? 'neurai-wt2';
const CONTAINER_NEURAID = process.env.NEURAI_REGTEST_CONTAINER_NEURAID ?? '/root/Neurai/src/neuraid';
const CONTAINER_CLI = process.env.NEURAI_REGTEST_CONTAINER_CLI ?? '/root/Neurai/src/neurai-cli';
const LOCAL_NEURAID = process.env.NEURAID_BIN ?? '';
const LOCAL_CLI = process.env.NEURAI_CLI_BIN ?? '';

function dockerAvailable(): boolean {
  try {
    return (
      execFileSync('docker', ['inspect', '-f', '{{.State.Running}}', CONTAINER], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim() === 'true'
    );
  } catch {
    return false;
  }
}

const MODE: 'docker' | 'local' | 'skip' = dockerAvailable()
  ? 'docker'
  : LOCAL_NEURAID && LOCAL_CLI && existsSync(LOCAL_NEURAID) && existsSync(LOCAL_CLI)
    ? 'local'
    : 'skip';

// Regtest chainparams: single global burn address for every operation.
const BURN_REGTEST = 'tBURNXXXXXXXXXXXXXXXXXXXXXXXVZLroy';
// Neurai's minimum relay fee is well above bitcoin's defaults; 0.01 XNA per
// transaction clears it at every size used here.
const FEE = xnaToSatoshis(0.01);

const RPC_PORT = 20000 + (process.pid % 10000);
const P2P_PORT = RPC_PORT + 1;
const DATADIR = `/tmp/neurai-regtest-${process.pid}`;

let A = ''; // owner address
let B = ''; // holder address (self-revokes)
let C = ''; // freeze target address

function sh(args: string[], allowFail = false): string {
  const [bin, ...rest] =
    MODE === 'docker' ? ['docker', 'exec', CONTAINER, ...args] : args;
  try {
    return execFileSync(bin, rest, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFail) return '';
    throw error;
  }
}

const NODE_ARGS = [
  '-regtest',
  `-datadir=${DATADIR}`,
  '-rpcuser=t',
  '-rpcpassword=t',
  `-rpcport=${RPC_PORT}`
];

function cli(...args: Array<string | number>): string {
  const bin = MODE === 'docker' ? CONTAINER_CLI : LOCAL_CLI;
  return sh([bin, ...NODE_ARGS, ...args.map(String)]);
}

function cliJson(...args: Array<string | number>): any {
  return JSON.parse(cli(...args));
}

function xnaUtxo(address: string, minXna: number): { txid: string; vout: number; amount: number } {
  const utxos = cliJson('listunspent', 1, 9999999, JSON.stringify([address]));
  // Smallest sufficient utxo, so early tests do not swallow the big one the
  // reissue vector needs for its 200 XNA burn.
  const utxo = utxos
    .filter((u: any) => u.amount >= minXna)
    .sort((a: any, b: any) => a.amount - b.amount)[0];
  if (!utxo) throw new Error(`no XNA utxo >= ${minXna} at ${address}`);
  return utxo;
}

function assetUtxo(address: string, assetName: string): { txid: string; outputIndex: number } {
  const utxos = cliJson('getaddressutxos', JSON.stringify({ addresses: [address], assetName }));
  if (!utxos.length) throw new Error(`no ${assetName} utxo at ${address}`);
  return utxos[0];
}

function signAndTest(rawTx: string): { allowed: boolean; reason?: string; hex: string } {
  const signed = cliJson('signrawtransaction', rawTx);
  expect(signed.complete).toBe(true);
  const [result] = cliJson('testmempoolaccept', JSON.stringify([signed.hex]), 'true');
  // This node encodes "allowed" as 0/1, not JSON booleans.
  return { allowed: Boolean(result.allowed), reason: result['reject-reason'], hex: signed.hex };
}

function sendAndMine(hex: string): string {
  const txid = cli('sendrawtransaction', hex, 'true');
  cli('generate', 1);
  return txid;
}

describe.skipIf(MODE === 'skip')('DePIN regtest vectors (library-built, node-validated)', () => {
  beforeAll(async () => {
    const neuraid = MODE === 'docker' ? CONTAINER_NEURAID : LOCAL_NEURAID;
    sh(['rm', '-rf', DATADIR]);
    sh(['mkdir', '-p', DATADIR]);
    sh([
      neuraid,
      ...NODE_ARGS,
      '-daemon',
      '-server=1',
      '-listen=0',
      '-assetindex=1',
      '-addressindex=1',
      `-port=${P2P_PORT}`
    ]);

    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        cli('getblockcount');
        ready = true;
      } catch {
        // RPC not up yet
      }
    }
    if (!ready) throw new Error('neuraid did not come up');

    // Assets/messaging/restricted activate at height 1 on regtest, but mine
    // past coinbase maturity (100) to have spendable XNA.
    cli('generate', 110);

    A = cli('getnewaddress');
    B = cli('getnewaddress');
    C = cli('getnewaddress');
    // P2PKH coins for the library-built transactions (coinbase is bare P2PK).
    for (const amount of [30, 20, 20, 20, 20, 250]) {
      cli('sendtoaddress', A, amount);
    }
    cli('generate', 1);
  }, 120_000);

  afterAll(() => {
    try {
      cli('stop');
    } catch {
      // daemon already gone
    }
    sh(['rm', '-rf', DATADIR], true);
  });

  it('accepts a library-built DEPIN issuance', () => {
    const utxo = xnaUtxo(A, 30);
    const built = createIssueDepinTransaction({
      inputs: [{ txid: utxo.txid, vout: utxo.vout }],
      burnAddress: BURN_REGTEST,
      burnAmountSats: xnaToSatoshis(10),
      xnaChangeAddress: A,
      xnaChangeSats: xnaToSatoshis(utxo.amount - 10) - FEE,
      toAddress: A,
      assetName: '&DEVICE',
      quantityRaw: xnaToSatoshis(5)
    });

    const result = signAndTest(built.rawTx);
    expect(result.allowed, `reject: ${result.reason}`).toBe(true);

    const decoded = cliJson('decoderawtransaction', result.hex);
    const types = decoded.vout.map((v: any) => v.scriptPubKey.type);
    expect(types[types.length - 1]).toMatch(/asset/); // issue at vout[n-1]
    expect(types[types.length - 2]).toMatch(/asset/); // owner token at vout[n-2]

    sendAndMine(result.hex);
    expect(cliJson('listmyassets', '&DEVICE')['&DEVICE']).toBe(5);
  }, 60_000);

  it('rejects a DEPIN transfer without the owner escort (soulbound rule)', () => {
    const asset = assetUtxo(A, '&DEVICE');
    const fees = xnaUtxo(A, 15);
    const built = createStandardAssetTransferTransaction({
      inputs: [
        { txid: asset.txid, vout: asset.outputIndex },
        { txid: fees.txid, vout: fees.vout }
      ],
      transfers: [
        { address: B, assetName: '&DEVICE', amountRaw: xnaToSatoshis(2) },
        { address: A, assetName: '&DEVICE', amountRaw: xnaToSatoshis(3) }
      ],
      payments: [{ address: A, valueSats: xnaToSatoshis(fees.amount) - FEE }]
    });

    const result = signAndTest(built.rawTx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('depin-transfer-not-by-owner');
  }, 60_000);

  it('accepts a library-built escorted DEPIN transfer', () => {
    const asset = assetUtxo(A, '&DEVICE');
    const owner = assetUtxo(A, '&DEVICE!');
    const fees = xnaUtxo(A, 15);
    const built = createDepinTransferTransaction({
      inputs: [
        { txid: asset.txid, vout: asset.outputIndex },
        { txid: owner.txid, vout: owner.outputIndex },
        { txid: fees.txid, vout: fees.vout }
      ],
      transfers: [
        { address: B, assetName: '&DEVICE', amountRaw: xnaToSatoshis(2) },
        { address: A, assetName: '&DEVICE', amountRaw: xnaToSatoshis(3) }
      ],
      ownerChangeAddress: A,
      xnaChangeAddress: A,
      xnaChangeSats: xnaToSatoshis(fees.amount) - FEE
    });

    const result = signAndTest(built.rawTx);
    expect(result.allowed, `reject: ${result.reason}`).toBe(true);
    sendAndMine(result.hex);
    expect(assetUtxo(B, '&DEVICE')).toBeTruthy();
  }, 60_000);

  it('accepts a library-built DEPIN freeze and reports the address as blocked', () => {
    // Give C a holding first: checkdepinvalidity only reports valid/blocked
    // when has_asset is true.
    {
      const asset = assetUtxo(A, '&DEVICE');
      const owner = assetUtxo(A, '&DEVICE!');
      const fees = xnaUtxo(A, 15);
      const seed = createDepinTransferTransaction({
        inputs: [
          { txid: asset.txid, vout: asset.outputIndex },
          { txid: owner.txid, vout: owner.outputIndex },
          { txid: fees.txid, vout: fees.vout }
        ],
        transfers: [
          { address: C, assetName: '&DEVICE', amountRaw: xnaToSatoshis(1) },
          { address: A, assetName: '&DEVICE', amountRaw: xnaToSatoshis(2) }
        ],
        ownerChangeAddress: A,
        xnaChangeAddress: A,
        xnaChangeSats: xnaToSatoshis(fees.amount) - FEE
      });
      const seedResult = signAndTest(seed.rawTx);
      expect(seedResult.allowed, `reject: ${seedResult.reason}`).toBe(true);
      sendAndMine(seedResult.hex);
    }

    const owner = assetUtxo(A, '&DEVICE!');
    const fees = xnaUtxo(A, 15);
    const built = createFreezeAddressesTransaction({
      inputs: [
        { txid: owner.txid, vout: owner.outputIndex },
        { txid: fees.txid, vout: fees.vout }
      ],
      assetName: '&DEVICE',
      operation: 'freeze',
      targetAddresses: [C],
      ownerChangeAddress: A,
      xnaChangeAddress: A,
      xnaChangeSats: xnaToSatoshis(fees.amount) - FEE
    });

    const result = signAndTest(built.rawTx);
    expect(result.allowed, `reject: ${result.reason}`).toBe(true);
    sendAndMine(result.hex);

    const validity = cliJson('checkdepinvalidity', '&DEVICE', C);
    expect(validity.has_asset).toBeTruthy();
    expect(Boolean(validity.blocked)).toBe(true);
    expect(Boolean(validity.valid)).toBe(false);
  }, 60_000);

  it('accepts a library-built self-revocation from the holder', () => {
    const asset = assetUtxo(B, '&DEVICE');
    const fees = xnaUtxo(A, 15); // XNA fee input from another address is allowed
    const built = createDepinSelfRevokeTransaction({
      inputs: [
        { txid: asset.txid, vout: asset.outputIndex },
        { txid: fees.txid, vout: fees.vout }
      ],
      assetName: '&DEVICE',
      holderAddress: B,
      amountRaw: xnaToSatoshis(2),
      xnaChangeAddress: A,
      xnaChangeSats: xnaToSatoshis(fees.amount) - FEE
    });

    const result = signAndTest(built.rawTx);
    expect(result.allowed, `reject: ${result.reason}`).toBe(true);
    sendAndMine(result.hex);

    const validity = cliJson('checkdepinvalidity', '&DEVICE', B);
    expect(validity.blocked).toBe(true);
    expect(validity.valid).toBeFalsy();
  }, 60_000);

  it('accepts a library-built sub-DEPIN issuance escorted by the parent owner', () => {
    const owner = assetUtxo(A, '&DEVICE!');
    const fees = xnaUtxo(A, 15);
    const built = createIssueDepinTransaction({
      inputs: [
        { txid: owner.txid, vout: owner.outputIndex },
        { txid: fees.txid, vout: fees.vout }
      ],
      burnAddress: BURN_REGTEST,
      burnAmountSats: xnaToSatoshis(10),
      xnaChangeAddress: A,
      xnaChangeSats: xnaToSatoshis(fees.amount - 10) - FEE,
      toAddress: A,
      assetName: '&DEVICE/EDGE',
      quantityRaw: xnaToSatoshis(1),
      parentOwnerAddress: A
    });

    const result = signAndTest(built.rawTx);
    expect(result.allowed, `reject: ${result.reason}`).toBe(true);
    sendAndMine(result.hex);
    expect(cliJson('listmyassets', '&DEVICE/EDGE')['&DEVICE/EDGE']).toBe(1);
  }, 60_000);

  it('accepts a library-built DEPIN reissue with units -1 (keep)', () => {
    const owner = assetUtxo(A, '&DEVICE!');
    const fees = xnaUtxo(A, 210);
    const built = createReissueTransaction({
      inputs: [
        { txid: owner.txid, vout: owner.outputIndex },
        { txid: fees.txid, vout: fees.vout }
      ],
      burnAddress: BURN_REGTEST,
      burnAmountSats: xnaToSatoshis(200),
      xnaChangeAddress: A,
      xnaChangeSats: xnaToSatoshis(fees.amount - 200) - FEE,
      toAddress: A,
      assetName: '&DEVICE',
      quantityRaw: xnaToSatoshis(3),
      units: -1
    });

    const result = signAndTest(built.rawTx);
    expect(result.allowed, `reject: ${result.reason}`).toBe(true);
    sendAndMine(result.hex);
    // Same wallet holds A and B, so the balance is all 5 issued plus 3
    // reissued (self-revocation relocates, it does not destroy).
    expect(cliJson('listmyassets', '&DEVICE')['&DEVICE']).toBe(8);
  }, 60_000);

  it('confirms the node rejects issuing "&AB" (library name rule matches consensus)', () => {
    expect(() => cli('issue', '&AB', 1, A, A, 0, 'true')).toThrow();
  }, 60_000);
});
