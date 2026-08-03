import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  computeTxid,
  computeWtxid,
  estimateTransactionSize,
  parseTransaction,
  serializeTransaction
} from '../src/index.js';

// Live validation of the transaction codec against a throwaway neuraid
// regtest (DePIN branch): txid/wtxid parity with the node, v3 + vrefin
// decoding, and a signed v3 transaction accepted by testmempoolaccept.
// Node resolution mirrors tests/node-regtest.test.ts: the neurai-wt2 Docker
// container first, local binaries via env vars second, skip otherwise.
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

// Disjoint from the 20000-29999 range node-regtest.test.ts uses, so both
// suites can run in the same vitest invocation against the same container.
const RPC_PORT = 30000 + (process.pid % 8000);
const P2P_PORT = RPC_PORT + 1;
const DATADIR = `/tmp/neurai-regtest-codec-${process.pid}`;

function sh(args: string[], allowFail = false): string {
  const [bin, ...rest] = MODE === 'docker' ? ['docker', 'exec', CONTAINER, ...args] : args;
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

let walletTxid = '';

describe.skipIf(MODE === 'skip')('transaction codec vs regtest node', () => {
  beforeAll(async () => {
    const neuraid = MODE === 'docker' ? CONTAINER_NEURAID : LOCAL_NEURAID;
    sh(['rm', '-rf', DATADIR]);
    sh(['mkdir', '-p', DATADIR]);
    sh([neuraid, ...NODE_ARGS, '-daemon', '-server=1', '-listen=0', `-port=${P2P_PORT}`]);

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

    cli('generate', 110);
    const address = cli('getnewaddress');
    walletTxid = cli('sendtoaddress', address, 10);
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

  it('matches the node txid/hash/sizes for a wallet-signed transaction', () => {
    const hex = cli('getrawtransaction', walletTxid);
    const decoded = cliJson('decoderawtransaction', hex);

    expect(computeTxid(hex)).toBe(decoded.txid);
    expect(computeWtxid(hex)).toBe(decoded.hash);
    expect(serializeTransaction(parseTransaction(hex))).toBe(hex);

    const sizes = estimateTransactionSize(hex);
    expect(sizes.size).toBe(decoded.size);
    expect(sizes.vsize).toBe(decoded.vsize);
  });

  it('produces v3 + vrefin transactions the node decodes with matching txid', () => {
    const hex = cli('getrawtransaction', walletTxid);
    const refs = [
      { txid: 'ab'.repeat(32), vout: 7 },
      { txid: 'cd'.repeat(32), vout: 0 }
    ];
    const v3Hex = serializeTransaction({ ...parseTransaction(hex), version: 3, vrefin: refs });

    const decoded = cliJson('decoderawtransaction', v3Hex);
    expect(decoded.version).toBe(3);
    expect(decoded.txid).toBe(computeTxid(v3Hex));
    expect(decoded.hash).toBe(computeWtxid(v3Hex));
    // The node echoes the refinputs in order — validates the vrefin layout
    // (and its position between vout and locktime) non-circularly.
    expect(
      decoded.vrefin?.map((ref: any) => ({ txid: ref.txid, vout: ref.vout }))
    ).toEqual(refs);
  });

  it('signs and accepts a v3 transaction (vrefin = []) via testmempoolaccept', () => {
    const address = cli('getnewaddress');
    const fundTxid = cli('sendtoaddress', address, 5);
    cli('generate', 1);
    const utxo = cliJson('listunspent', 1, 9999999, JSON.stringify([address]))[0];

    const change = cli('getnewaddress');
    const rawV2 = cli(
      'createrawtransaction',
      JSON.stringify([{ txid: utxo.txid, vout: utxo.vout }]),
      JSON.stringify({ [change]: 4.98 })
    );

    const v3Hex = serializeTransaction({ ...parseTransaction(rawV2), version: 3, vrefin: [] });
    const signed = cliJson('signrawtransaction', v3Hex);
    expect(signed.complete).toBe(true);
    expect(signed.hex.startsWith('03000000')).toBe(true); // node kept version 3

    const [result] = cliJson('testmempoolaccept', JSON.stringify([signed.hex]), 'true');
    expect(Boolean(result.allowed), `reject: ${result['reject-reason']}`).toBe(true);

    const txid = cli('sendrawtransaction', signed.hex, 'true');
    cli('generate', 1);
    expect(computeTxid(signed.hex)).toBe(txid);
    expect(cliJson('getrawtransaction', txid, 1).version).toBe(3);

    expect(fundTxid).toBeTruthy();
  }, 60_000);
});
