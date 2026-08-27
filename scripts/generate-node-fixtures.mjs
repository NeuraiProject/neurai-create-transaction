#!/usr/bin/env node
/**
 * Capture asset-payload vectors from a running Neurai node.
 *
 * Starts a throwaway regtest container, drives the node through the operations
 * with its OWN RPCs, and prints the scriptPubKey of every output that carries
 * an asset payload, together with the provenance the fixtures must record:
 * image, block height and the marker the chain requires.
 *
 * The artifact is the payload/script, never the full raw transaction: the
 * node's wallet picks its own inputs, change and output order, so a raw
 * captured here would not be reproducible by the library and comparing it
 * would test the wallet, not the encoding.
 *
 * Run: node scripts/generate-node-fixtures.mjs
 */
import { execFileSync } from 'node:child_process';

const IMAGE = 'neurai-regtest-depin:347362b';
const CONTAINER = `ct-fixtures-${process.pid}`;
const PORT = 25500 + (process.pid % 1000);
const NEURAID = '/root/Neurai/src/neuraid';
const CLI = '/root/Neurai/src/neurai-cli';
const DD = '/root/p';

const sh = (c, a) => execFileSync(c, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const docker = (...a) => sh('docker', a);
const cli = (...a) => sh('docker', ['exec', CONTAINER, CLI, '-regtest', `-datadir=${DD}`,
  '-rpcuser=t', '-rpcpassword=t', `-rpcport=${PORT}`, ...a.map(String)]);
const cliJson = (...a) => JSON.parse(cli(...a));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const one = (out) => String(JSON.parse(out)[0] ?? out).trim();

/** Outputs whose scriptPubKey carries an asset payload or a null-asset marker. */
function assetOutputsOf(txid) {
  const tx = cliJson('getrawtransaction', txid, 1);
  return tx.vout
    .map((v) => v.scriptPubKey.hex)
    .filter((h) => h.includes('786e61') || h.includes('72766e') || h.startsWith('c05050'));
}

async function main() {
  docker('run', '-d', '--name', CONTAINER, IMAGE, 'bash', '-c',
    `mkdir -p ${DD} && exec ${NEURAID} -regtest -datadir=${DD} -server=1 -listen=0 ` +
    `-txindex=1 -assetindex=1 -addressindex=1 -rpcuser=t -rpcpassword=t -rpcport=${PORT} -printtoconsole`);
  for (let i = 0; i < 60; i++) { try { cli('getblockcount'); break; } catch { await sleep(1000); } }

  cli('generate', 500);
  const info = cliJson('getblockchaininfo');
  const provenance = {
    image: IMAGE,
    chain: info.chain,
    height: info.blocks,
    assetMarker: info.asset_marker
  };

  const A = cli('getnewaddress');
  const vectors = {};

  // --- reissue keeping units, on a units=2 asset -----------------------------
  cli('issue', 'FIXA', 1000, '', '', 2, 'true');
  cli('generate', 1);
  const reissueTxid = one(cli('reissue', 'FIXA', 5, A, '', 'true', -1));
  cli('generate', 1);
  vectors.REISSUE_UNITS_UNCHANGED = assetOutputsOf(reissueTxid).filter((h) => h.includes('7206') || /786e6172|72766e72/.test(h));

  // --- global freeze / unfreeze ---------------------------------------------
  cli('issuequalifierasset', '#FIXQ');
  cli('generate', 1);
  cli('addtagtoaddress', '#FIXQ', A);
  cli('generate', 1);
  cli('issuerestrictedasset', '$FIXA', 100, '#FIXQ', A);
  cli('generate', 1);

  const freezeTxid = one(cli('freezerestrictedasset', '$FIXA'));
  cli('generate', 1);
  vectors.GLOBAL_FREEZE = assetOutputsOf(freezeTxid).filter((h) => h.startsWith('c05050'));

  const unfreezeTxid = one(cli('unfreezerestrictedasset', '$FIXA'));
  cli('generate', 1);
  vectors.GLOBAL_UNFREEZE = assetOutputsOf(unfreezeTxid).filter((h) => h.startsWith('c05050'));

  console.log(JSON.stringify({ provenance, vectors }, null, 2));
}

main()
  .catch((e) => { console.error('ERROR:', e.message, String(e.stdout || '').slice(0, 400)); process.exitCode = 1; })
  .finally(() => { try { docker('rm', '-f', CONTAINER); } catch { /* already gone */ } });
