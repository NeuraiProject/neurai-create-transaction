# neurai-create-transaction

Base local package to build unsigned Neurai raw transactions without delegating
serialization to the node RPC.

Current scope:

- serialize unsigned raw transactions
- create standard XNA payment transactions
- encode XNA outputs for legacy and AuthScript witness-v1 destinations
- encode asset transfers and `transferwithmessage`
- encode asset issue, owner, reissue, verifier and null-asset scripts
- build expanded transactions for:
  - root/sub/depin issuance
  - unique issuance
  - qualifier issuance
  - restricted issuance
  - reissue and reissue restricted
  - tag / untag
  - freeze / unfreeze address
  - freeze / unfreeze asset

This package is intentionally low-level. It does not select UTXOs, estimate fees
or sign transactions.

It now also exposes `createFromOperation(...)`, a typed dispatcher for consumers
that already know the high-level operation type and want a stable bridge into
raw transaction serialization without inferring which builder to call.

Address-taking APIs accept either a plain address string or a direct object from
`@neuraiproject/neurai-key` such as:

- `IAddressObject`
- `IPQAddressObject`
- `INoAuthAddressObject`
- `ILegacyAuthScriptAddressObject`

Internally only the `.address` field is needed, so consumers can pass the
original object returned by `neurai-key` without flattening it first.

Build outputs:

- `dist/index.js`: ESM
- `dist/index.cjs`: CommonJS
- `dist/browser.js`: browser ESM bundle
- `dist/NeuraiCreateTransaction.global.js`: global browser bundle

For PQ null-asset outputs there are two modes:

- `strict`: canonical AuthScript form, emits `OP_XNA_ASSET OP_1 <32-byte-commitment> ...`
- `hash20`: legacy compatibility form, emits `OP_XNA_ASSET <20-byte-hash> ...`

For AuthScript destinations (`nq1...` / `tnq1...`), the node now only accepts
the canonical `strict` form. Requesting `hash20` for an AuthScript address
throws. Legacy base58 addresses still encode null-asset destinations as 20-byte
hash pushes.

## Supported operations

| Operation | Builder / API | Notes |
| --- | --- | --- |
| Standard XNA payment | `createPaymentTransaction(...)` | Normal unsigned payments |
| Standard asset transfer | `createStandardAssetTransferTransaction(...)` | Supports `transfer` and `transferwithmessage` |
| Root asset issue | `createIssueAssetTransaction(...)` | Standard `issue` flow |
| Sub-asset issue | `createIssueSubAssetTransaction(...)` | Returns parent owner token and issues child owner token |
| DePIN issue | `createIssueDepinTransaction(...)` | Separate `ISSUE_DEPIN`, forces `&...` and `units=0` |
| Unique / NFT issue | `createIssueUniqueAssetTransaction(...)` | Expands one output per unique tag |
| Qualifier issue | `createIssueQualifierTransaction(...)` | Supports sub-qualifier root change |
| Restricted issue | `createIssueRestrictedTransaction(...)` | Adds verifier output and owner return |
| Reissue | `createReissueTransaction(...)` | Standard non-restricted reissue |
| Reissue restricted | `createReissueRestrictedTransaction(...)` | Optional verifier change |
| Tag / untag addresses | `createQualifierTagTransaction(...)` | Use `operation: 'tag' | 'untag'` |
| Freeze / unfreeze addresses | `createFreezeAddressesTransaction(...)` | Use `operation: 'freeze' | 'unfreeze'` |
| Freeze / unfreeze asset globally | `createFreezeAssetTransaction(...)` | Use `operation: 'freeze' | 'unfreeze'` |
| Typed dispatcher | `createFromOperation(...)` | Accepts `{ operationType, params }` and routes to the right builder |

These builders create the expanded physical transaction outputs that the node
would normally derive internally from asset RPC JSON.

## Operation matrix

| Operation | Burn type | Owner return | Verifier output |
| --- | --- | --- | --- |
| Standard XNA payment | None | No | No |
| Standard asset transfer | None | No | No |
| Root asset issue | `ISSUE_ROOT` | Yes | No |
| Sub-asset issue | `ISSUE_SUB` | Yes | No |
| DePIN issue | `ISSUE_DEPIN` | Yes | No |
| Unique / NFT issue | `ISSUE_UNIQUE` | Yes | No |
| Qualifier issue | `ISSUE_QUALIFIER` / `ISSUE_SUB_QUALIFIER` | Sub-qualifier only | No |
| Restricted issue | `ISSUE_RESTRICTED` | Yes | Yes |
| Reissue | `REISSUE` | Yes | No |
| Reissue restricted | `REISSUE_RESTRICTED` | Yes | Optional |
| Tag addresses | `TAG_ADDRESS` | Qualifier change output | No |
| Untag addresses | `UNTAG_ADDRESS` | Qualifier change output | No |
| Freeze addresses | None | Yes | No |
| Unfreeze addresses | None | Yes | No |
| Freeze asset globally | None | Yes | No |
| Unfreeze asset globally | None | Yes | No |

## Example

```ts
import { getNoAuthAddress } from '@neuraiproject/neurai-key';
import {
  createIssueRestrictedTransaction,
  createQualifierTagTransaction,
  getBurnAddressForOperation,
  getBurnAmountSats,
  xnaToSatoshis
} from './dist/index.js';

const vault = getNoAuthAddress('xna-pq-test', {
  witnessScript: '51'
});

const restricted = createIssueRestrictedTransaction({
  inputs: [
    { txid: '...', vout: 0 },
    { txid: '...', vout: 1 }
  ],
  burnAddress: getBurnAddressForOperation('xna-pq-test', 'ISSUE_RESTRICTED'),
  burnAmountSats: getBurnAmountSats('ISSUE_RESTRICTED'),
  xnaChangeAddress: vault,
  xnaChangeSats: xnaToSatoshis(12.5),
  toAddress: vault,
  assetName: '$SECURITY',
  quantityRaw: xnaToSatoshis(1000),
  verifierString: '#KYC & #ACCREDITED',
  units: 0,
  reissuable: true
});

const tag = createQualifierTagTransaction({
  inputs: [
    { txid: '...', vout: 0 },
    { txid: '...', vout: 1 }
  ],
  qualifierName: '#KYC',
  operation: 'tag',
  targetAddresses: [vault],
  burnAddress: getBurnAddressForOperation('xna-pq-test', 'TAG_ADDRESS'),
  burnAmountSats: getBurnAmountSats('TAG_ADDRESS'),
  xnaChangeAddress: vault,
  xnaChangeSats: xnaToSatoshis(4),
  qualifierChangeAddress: vault,
  qualifierChangeAmountRaw: xnaToSatoshis(9)
});

const withCustomTail = createIssueRestrictedTransaction({
  inputs: [{ txid: '...', vout: 0 }],
  burnAddress: getBurnAddressForOperation('xna-pq-test', 'ISSUE_RESTRICTED'),
  burnAmountSats: getBurnAmountSats('ISSUE_RESTRICTED'),
  xnaChangeAddress: vault,
  xnaChangeSats: xnaToSatoshis(1),
  toAddress: vault,
  assetName: '$SECURITY',
  quantityRaw: xnaToSatoshis(10),
  verifierString: '#KYC',
  extraOutputs: [
    { valueSats: 0n, scriptPubKeyHex: '6a00' }
  ]
});

console.log(restricted.rawTx);
console.log(tag.rawTx);
console.log(withCustomTail.rawTx);
```

## Bridging from upstream metadata

When another package already resolved burn, change, owner return and operation
metadata, route that payload through `createFromOperation(...)` instead of
making the consumer choose the builder manually:

```ts
import { createFromOperation } from './dist/index.js';

const built = createFromOperation({
  operationType: 'TAG_ADDRESSES',
  params: {
    inputs: [
      { txid: '...', vout: 0 },
      { txid: '...', vout: 1 }
    ],
    qualifierName: '#KYC',
    targetAddresses: ['tnq1...'],
    burnAddress: 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA',
    burnAmountSats: 20000000n,
    xnaChangeAddress: 'tnq1...',
    xnaChangeSats: 400000000n,
    qualifierChangeAddress: 'tnq1...',
    qualifierChangeAmountRaw: 900000000n
  }
});
```

## Notes

- This package mirrors the node's expanded physical outputs, not the RPC JSON.
- Any `nq1...` / `tnq1...` destination is treated as AuthScript `witness v1`
  with a 32-byte commitment. The removed 20-byte PQ keyhash format is not
  supported anymore.
- `resolveAddressInput(...)` is exported for consumers that want to normalize a
  string-or-object address input before storing or logging it.
- `ISSUE_DEPIN` is modeled as its own operation even though today it shares the
  same burn address and cost as `ISSUE_UNIQUE`. That keeps future burn changes
  isolated to DEPIN.
- The global bundle exposes `globalThis.NeuraiCreateTransaction`.
- `createUnsignedTransaction(...)` still lets you build arbitrary transactions
  from pre-serialized outputs.
- High-level builders now accept `extraOutputs` so callers can append custom
  outputs without dropping to fully manual transaction assembly.
- UTXO selection, fee estimation and signing remain outside this package.
