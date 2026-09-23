import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getAddressByPath,
  getHDKey,
  getNoAuthAddress,
  getPQAddress,
  getPQAuthScriptAddress
} from '@neuraiproject/neurai-key';
import {
  createIssueAssetTransaction,
  createPaymentTransaction,
  createStandardAssetTransferTransaction,
  decodeAddress,
  encodeDestinationScript,
  REGTEST_GLOBAL_BURN_ADDRESS,
  xnaToSatoshis
} from '../src/index.js';
import type { AssetMarker } from '../src/index.js';
import { bytesToHex } from '../src/bytes.js';

// Live vectors for the neurai-key 5 address types against a throwaway
// regtest node (strict AuthScript families are active on regtest). Every
// transaction is BUILT BY THIS LIBRARY, its legacy inputs are signed by the
// node wallet and it is validated with testmempoolaccept before mining.
//
// Node resolution follows node-regtest.test.ts: Docker container
// (NEURAI_REGTEST_CONTAINER, binaries NEURAI_REGTEST_CONTAINER_NEURAID /
// _CLI), then local binaries (NEURAID_BIN / NEURAI_CLI_BIN), else skip.
// The node must know the nc / pq / nq prefixes (Neurai-DePIN 00f9a3b+).
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

const FEE = xnaToSatoshis(0.01);
const RPC_PORT = 21000 + (process.pid % 9000);
const P2P_PORT = RPC_PORT + 1;
const DATADIR = `/tmp/neurai-regtest-addrtypes-${process.pid}`;
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const NODE_TYPE = {
  p2pkh: 'pubkeyhash',
  authscript: 'witness_v1_authscript',
  pq: 'witness_v2_strict_pq',
  ecdsa: 'witness_v3_strict_ecdsa'
} as const;

function sh(args: string[], allowFail = false): string {
  const [bin, ...rest] = MODE === 'docker' ? ['docker', 'exec', CONTAINER, ...args] : args;
  try {
    return execFileSync(bin, rest, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFail) return '';
    throw error;
  }
}

const NODE_ARGS = ['-regtest', `-datadir=${DATADIR}`, '-rpcuser=t', '-rpcpassword=t', `-rpcport=${RPC_PORT}`];

function cli(...args: Array<string | number>): string {
  const bin = MODE === 'docker' ? CONTAINER_CLI : LOCAL_CLI;
  return sh([bin, ...NODE_ARGS, ...args.map(String)]);
}

function cliJson(...args: Array<string | number>): any {
  return JSON.parse(cli(...args));
}

function xnaUtxo(address: string, minXna: number): { txid: string; vout: number; amount: number } {
  const utxo = cliJson('listunspent', 1, 9999999, JSON.stringify([address]))
    .filter((u: any) => u.amount >= minXna)
    .sort((a: any, b: any) => a.amount - b.amount)[0];
  if (!utxo) throw new Error(`no XNA utxo >= ${minXna} at ${address}`);
  return utxo;
}

function signAndTest(rawTx: string): { allowed: boolean; reason?: string; hex: string } {
  const signed = cliJson('signrawtransaction', rawTx);
  expect(signed.complete).toBe(true);
  const [result] = cliJson('testmempoolaccept', JSON.stringify([signed.hex]), 'true');
  return { allowed: Boolean(result.allowed), reason: result['reject-reason'], hex: signed.hex };
}

function sendAndMine(hex: string): string {
  const txid = cli('sendrawtransaction', hex, 'true');
  cli('generate', 1);
  return txid;
}

let ASSET_MARKER: AssetMarker = 'xna';
let LEGACY = '';
let NODE_ECDSA = '';

// One destination of each family: node-made and neurai-key-made.
const KEY_ECDSA = getAddressByPath('xna-test', getHDKey('xna-test', MNEMONIC), "m/84'/1'/0'/0/0");
const KEY_PQ = getPQAddress('xna-pq-test', MNEMONIC, 0, 0);
const KEY_PQ_AUTHSCRIPT = getPQAuthScriptAddress('xna-authscript-test', MNEMONIC, 0, 0);
const KEY_NOAUTH = getNoAuthAddress('xna-authscript-test', { witnessScript: '51' });

describe.skipIf(MODE === 'skip')('neurai-key 5 address types (library-built, node-validated)', () => {
  beforeAll(async () => {
    const neuraid = MODE === 'docker' ? CONTAINER_NEURAID : LOCAL_NEURAID;
    sh(['rm', '-rf', DATADIR]);
    sh(['mkdir', '-p', DATADIR]);
    sh([neuraid, ...NODE_ARGS, '-daemon', '-server=1', '-listen=0', '-assetindex=1', '-addressindex=1', `-port=${P2P_PORT}`]);
    let ready = false;
    for (let attempt = 0; attempt < 120 && !ready; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        cli('getblockcount');
        ready = true;
      } catch {
        // RPC not up yet
      }
    }
    if (!ready) throw new Error('neuraid did not come up');
    cli('generate', 110);
    ASSET_MARKER = cliJson('getblockchaininfo').asset_marker;
    LEGACY = cli('getnewaddress');
    NODE_ECDSA = cli('getnewaddress', '', 'ecdsa');
    for (const amount of [50, 50, 50, 1500]) cli('sendtoaddress', LEGACY, amount);
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

  it('decodes node-made ECDSA addresses to the scriptPubKey the node reports', () => {
    const info = cliJson('validateaddress', NODE_ECDSA);
    expect(info.witness_version).toBe(3);
    const decoded = decodeAddress(NODE_ECDSA);
    expect(decoded.type).toBe('ecdsa');
    expect(bytesToHex(encodeDestinationScript(NODE_ECDSA))).toBe(info.scriptPubKey);
  });

  it('agrees with validateaddress for every neurai-key 5 address type', () => {
    for (const object of [KEY_ECDSA, KEY_PQ, KEY_PQ_AUTHSCRIPT, KEY_NOAUTH]) {
      const info = cliJson('validateaddress', object.address);
      expect(info.isvalid, object.address).toBe(true);
      expect(info.scriptPubKey).toBe(bytesToHex(encodeDestinationScript(object)));
      const decoded = decodeAddress(object);
      if (decoded.type === 'p2pkh') throw new Error('unreachable');
      expect(info.witness_version).toBe(decoded.witnessVersion);
    }
  });

  it('pays every address type in one library-built transaction', () => {
    const utxo = xnaUtxo(LEGACY, 50);
    const destinations = [LEGACY, NODE_ECDSA, KEY_ECDSA.address, KEY_PQ.address, KEY_PQ_AUTHSCRIPT.address, KEY_NOAUTH.address];
    const each = xnaToSatoshis(1);
    const built = createPaymentTransaction({
      inputs: [{ txid: utxo.txid, vout: utxo.vout }],
      payments: [
        ...destinations.map((address) => ({ address, valueSats: each })),
        { address: LEGACY, valueSats: xnaToSatoshis(utxo.amount) - each * BigInt(destinations.length) - FEE }
      ]
    });
    const result = signAndTest(built.rawTx);
    expect(result.allowed, `reject: ${result.reason}`).toBe(true);

    const decoded = cliJson('decoderawtransaction', result.hex);
    destinations.forEach((address, index) => {
      const spk = decoded.vout[index].scriptPubKey;
      expect(spk.type).toBe(NODE_TYPE[decodeAddress(address).type]);
      expect(spk.addresses[0]).toBe(address);
    });
    sendAndMine(result.hex);
    expect(cliJson('getaddressbalance', JSON.stringify({ addresses: [KEY_PQ.address] })).balance).toBe(100000000);
  }, 60_000);

  it('issues an asset and transfers it to v1, v2 and v3 destinations', () => {
    const issueFunds = xnaUtxo(LEGACY, 1500);
    const issue = createIssueAssetTransaction({
      assetMarker: ASSET_MARKER,
      inputs: [{ txid: issueFunds.txid, vout: issueFunds.vout }],
      burnAddress: REGTEST_GLOBAL_BURN_ADDRESS,
      burnAmountSats: xnaToSatoshis(1000),
      xnaChangeAddress: LEGACY,
      xnaChangeSats: xnaToSatoshis(issueFunds.amount - 1000) - FEE,
      toAddress: NODE_ECDSA,
      assetName: 'ADDRTYPES',
      quantityRaw: xnaToSatoshis(100),
      units: 0,
      reissuable: true
    });
    const issued = signAndTest(issue.rawTx);
    expect(issued.allowed, `reject: ${issued.reason}`).toBe(true);
    sendAndMine(issued.hex);
    expect(cliJson('listassetbalancesbyaddress', NODE_ECDSA).ADDRTYPES).toBe(100);

    // The node wallet spends the strict ECDSA asset output it owns.
    const [asset] = cliJson('getaddressutxos', JSON.stringify({ addresses: [NODE_ECDSA], assetName: 'ADDRTYPES' }));
    const fees = xnaUtxo(LEGACY, 50);
    const transfer = createStandardAssetTransferTransaction({
      assetMarker: ASSET_MARKER,
      inputs: [
        { txid: asset.txid, vout: asset.outputIndex },
        { txid: fees.txid, vout: fees.vout }
      ],
      transfers: [
        { address: KEY_PQ.address, assetName: 'ADDRTYPES', amountRaw: xnaToSatoshis(10) },
        { address: KEY_ECDSA.address, assetName: 'ADDRTYPES', amountRaw: xnaToSatoshis(20) },
        { address: KEY_NOAUTH.address, assetName: 'ADDRTYPES', amountRaw: xnaToSatoshis(30) },
        { address: NODE_ECDSA, assetName: 'ADDRTYPES', amountRaw: xnaToSatoshis(40) }
      ],
      payments: [{ address: LEGACY, valueSats: xnaToSatoshis(fees.amount) - FEE }]
    });
    const result = signAndTest(transfer.rawTx);
    expect(result.allowed, `reject: ${result.reason}`).toBe(true);
    sendAndMine(result.hex);

    expect(cliJson('listassetbalancesbyaddress', KEY_PQ.address).ADDRTYPES).toBe(10);
    expect(cliJson('listassetbalancesbyaddress', KEY_ECDSA.address).ADDRTYPES).toBe(20);
    expect(cliJson('listassetbalancesbyaddress', KEY_NOAUTH.address).ADDRTYPES).toBe(30);
    expect(cliJson('listassetbalancesbyaddress', NODE_ECDSA).ADDRTYPES).toBe(40);
  }, 60_000);
});
