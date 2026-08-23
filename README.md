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
  - DePIN transfer (soulbound owner escort) and DePIN self-revocation

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
| DePIN issue | `createIssueDepinTransaction(...)` | Separate `ISSUE_DEPIN`, forces `&...` and `units=0`; sub-DePIN (`&X/Y`) transfers the immediate parent's owner token |
| DePIN transfer | `createDepinTransferTransaction(...)` | Adds the mandatory `&X!` owner escort output (soulbound rule) |
| DePIN self-revoke | `createDepinSelfRevokeTransaction(...)` | Holder renounces the asset: self-transfer plus flag-1 null data, no owner token |
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
| DePIN transfer | None | Yes (owner escort) | No |
| DePIN self-revoke | None | No (must not appear) | No |
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

## DePIN assets (testnet/regtest only)

DePIN assets (`&NAME`) are soulbound: consensus rejects any `&X` transfer that
is not escorted by the owner token `&X!`, with self-revocation as the only
exception. They do not exist on mainnet — pass the optional `network` parameter
to the DePIN builders to fail fast if a mainnet network slips in (the chain is
never inferred from addresses).

```ts
import {
  createDepinSelfRevokeTransaction,
  createDepinTransferTransaction,
  createIssueDepinTransaction,
  getBurnAddressForOperation,
  getBurnAmountSats
} from './dist/index.js';

// Owner moves the asset: the builder appends the "&X!" escort output, but the
// transaction must also SPEND an "&X!" UTXO — include it in `inputs` yourself.
const transfer = createDepinTransferTransaction({
  inputs: [
    { txid: '...', vout: 0 }, // &DEVICE UTXO
    { txid: '...', vout: 1 }, // &DEVICE! UTXO (mandatory)
    { txid: '...', vout: 2 }  // XNA for fees
  ],
  transfers: [{ address: 'tnq1...', assetName: '&DEVICE', amountRaw: 100000000n }],
  ownerChangeAddress: 'tnq1...',
  network: 'xna-pq-test'
});

// Holder renounces the asset. Every spent "&DEVICE" UTXO must come from the
// holder address (XNA fee inputs may come from anywhere), no input or output
// may touch "&DEVICE!", and every "&DEVICE" output must pay the holder.
const selfRevoke = createDepinSelfRevokeTransaction({
  inputs: [
    { txid: '...', vout: 0 }, // &DEVICE UTXO held by holderAddress
    { txid: '...', vout: 1 }  // XNA for fees
  ],
  assetName: '&DEVICE',
  holderAddress: 'tnq1...',
  amountRaw: 100000000n
});
```

DePIN rules enforced by the builders:

- Names: `&` plus at least 3 chars (`A-Z 0-9 _ .`); hierarchical names
  (`&X/Y/...`) need 3 real chars in every `/`-separated segment, including the
  root. The node parser itself lets the root count its leading `&` (`&AB/CDE`
  parses), but such an asset can never be issued — its parent `&AB` is not a
  valid root, so the parent owner token required at issuance cannot exist —
  and the library rejects it upfront.
- Name length is capped at 120 chars (`DEPIN_MAX_NAME_LENGTH`). The node
  accepts 121 where DePIN is enabled, but a 121-char asset yields a 122-char
  owner token that fails the global name check, leaving the asset frozen in
  place — a known upstream quirk this library sidesteps.
- Sub-DePIN issuance follows the sub-asset flow: the issuing transaction
  transfers the immediate parent's owner token (`&X/Y/Z` needs `&X/Y!`).
- DePIN reissue accepts `units` 0 or -1 (keep) only, and the owner-token change
  must return to the destination address.
- `createFreezeAddressesTransaction(...)` works for DePIN owner freeze/unfreeze
  (`operation: 'freeze' | 'unfreeze'`); the owner-change address cannot be one
  of the frozen targets, and the spent `&X!` UTXO must not sit on a target
  address either (the latter is on the caller — inputs carry no address). An
  owner unfreeze cannot undo a holder's self-revocation.

## Transfers to raw scripts and covenants (AuthScript)

`transfersToScript` / `createAssetTransferToScriptOutput` append the asset
wrapper (`OP_XNA_ASSET <payload> OP_DROP`) to a scriptPubKey the caller
already holds. Since 0.5.0 the recipient script must be **exactly** P2PKH
(25 bytes) or AuthScript `OP_1 <32B>` (34 bytes); anything else throws.
This mirrors consensus: the node only accepts `OP_XNA_ASSET` at byte 25
(after a P2PKH prefix), at byte 34 (after an AuthScript prefix) or at
position 0 (null-asset metadata) — appending the wrapper to a bare covenant,
P2SH or any other script produces an output every network rejects with
`bad-txns-op-xna-asset-not-in-right-script-location`.

To pay assets into an arbitrary script (a covenant), commit the script into
an AuthScript destination and use the regular address-based `transfers` leg:

```ts
import { getNoAuthAddress } from '@neuraiproject/neurai-key';

// auth_type 0x00 (NoAuth): the covenant script alone gates the spend.
const noauth = getNoAuthAddress('xna-pq-test', { witnessScript: covenantBytes });
// noauth.address is a tnq1... destination usable in `transfers`.
```

Do NOT hash the covenant yourself: the commitment is
`TaggedHash("NeuraiAuthScript", 0x01 || authDescriptor || SHA256(witnessScript))`,
not a plain `SHA256(script)` — a mis-derived commitment yields deposits the
chain accepts but that can never be spent (`WITNESS_PROGRAM_MISMATCH`).
Always derive it through neurai-key's public API.

Spending such an output takes a witness stack
(`[0x00, ...args, witnessScript]`) instead of a scriptSig. Assemble the
unlock stack with the witness-stack builders in
`@neuraiproject/neurai-scripts` (`buildFillWitnessStack`,
`buildCancelWitnessStack`, `buildAuthScriptWitnessNoAuth`) and serialize the
spend with `serializeTransaction` from this package's transaction codec
(0.5.1+) — witness elements go in as hex strings, one per stack slot
(`witness.map(bytesToHex)`); `computeTxid`/`computeWtxid` cover the ids.

> **Status**: deposit + witness spend of a NoAuth commitment is proven
> end-to-end in regtest (see the live vectors below). The full partial-fill
> covenant under AuthScript (introspection opcodes and the cancel-branch
> sighash under `SIGVERSION_AUTHSCRIPT`) is **not yet validated end-to-end**;
> until that vector exists, treat the complete DEX covenant flow as
> experimental.

## Asset payload marker (NIP-040)

Every transfer / issue / owner / reissue payload opens with a 3-byte marker.
NIP-040 migrates it from the Ravencoin-inherited `rvn` (`72 76 6e`) to `xna`
(`78 6e 61`) **from an activation height per network**: blocks below it only
accept `rvn` on new asset outputs, blocks at or above it only accept `xna`
(testnet: 303000, already crossed; regtest: 1; mainnet: not scheduled yet).

This library does **not** know chain state and never infers the marker from
an address or a network. The node tells you which marker the next block
requires, and you pass it through:

```ts
const info = await rpc('getblockchaininfo', []);     // node ≥ commit 347362b
const built = createStandardAssetTransferTransaction({
  inputs,
  transfers: [{ address, assetName: 'CAT', amountRaw: 100n }],
  assetMarker: info.asset_marker                     // 'rvn' | 'xna'
});
```

- `assetMarker` on any transaction builder (and on `createFromOperation`
  params) applies to every asset output that builder creates, including the
  owner-token and issuance outputs it adds internally.
- `assetMarker` on an individual output (`transfers[]`, `transferMessages[]`,
  `transfersToScript[]`, `AssetIssueOutputParams`, `AssetReissueOutputParams`)
  takes precedence over the transaction-level value.
- The low-level `encode*Payload` / `encode*Script` helpers and the positional
  output helpers (`createAssetTransferOutput`, `createOwnerAssetIssueOutput`,
  `createOwnerAssetTransferOutput`) take a trailing
  `options?: { assetMarker }`.
- **Default is `'rvn'`** everywhere, byte-for-byte what 0.6.0 produced. Any
  other value than `'rvn'` / `'xna'` throws at build time.
- `extraOutputs` are opaque: they are appended verbatim. If you add an asset
  output there, build it with the right marker yourself.
- Building offline without a node: pass the marker you know to be right for
  the height the transaction will be mined at; the library will not guess.
- A transaction built with the wrong marker is rejected by the node
  (`bad-txns-legacy-asset-marker-after-nip040` / its pre-activation twin) and
  evicted from the mempool at the activation boundary; rebuild and re-sign.

`assetPayloadPrefix(marker, type)`, `resolveAssetMarker(value)` and
`DEFAULT_ASSET_MARKER` are exported for consumers that assemble payloads
themselves.

## Transaction codec (v1/v2/v3, witness, vrefin)

Since 0.5.1 the package ships a full transaction codec alongside the legacy
`createUnsignedTransaction(...)` helper (which is unchanged and still emits
the pre-witness form the builders use):

- `parseTransaction(hex)` — decodes v1/v2/v3 transactions, with or without
  the extended witness format (dummy-vin marker + flags), including the
  NIP-014 `vrefin` vector that v3 serializes between `vout` and the witness.
  The parser mirrors the node's strictness: canonical CompactSize only,
  `MAX_SIZE` (32 MiB) bound, declared lengths validated against the remaining
  bytes before any allocation, unknown flags and trailing bytes rejected,
  `version` read as signed int32.
- `serializeTransaction(tx, { includeWitness? })` — node parity: the
  marker/flags form is only emitted when at least one input carries a
  non-empty witness stack; `includeWitness: false` forces the stripped form
  that feeds the txid. In v3 the `vrefin` vector is always serialized (even
  empty); a non-empty `vrefin` outside v3 throws.
- `computeTxid(...)` / `computeWtxid(...)` — double-SHA256 of the stripped /
  full serialization (both include `vrefin` on v3), reversed hex as RPC
  displays it.
- `estimateTransactionSize(...)` — `{ size, strippedSize, weight, vsize }`
  with the node's formula: `weight = strippedSize * 3 + size`,
  `vsize = ceil(weight / 4)`; `vrefin` counts in both serializations.

Fixtures in `tests/fixtures/tx-codec.ts` carry hex/txid/wtxid values produced
by the regtest node itself, and `tests/node-regtest-codec.test.ts` replays the
checks live (txid/wtxid parity, v3 + `vrefin` decode, and a signed v3
transaction accepted by `testmempoolaccept`) against the same Docker/binary
setup as the DePIN vectors.

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

- **0.7.0**: NIP-040 support through the explicit `assetMarker` option (see
  above). No behaviour change without it: the default stays `rvn`. The
  internal `XNA_*_PREFIX` constants were replaced by `assetPayloadPrefix`.

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
- High-level builders accept `extraOutputs` so callers can add custom outputs
  without dropping to fully manual transaction assembly. In issue and reissue
  builders they are placed BEFORE the owner/issue/reissue outputs: consensus
  reads the issue output at `vout[n-1]` (and the owner at `vout[n-2]`), so the
  issuance tail must stay last. Transfer-style builders keep them last. If you
  fund a built issuance externally (e.g. `fundrawtransaction`), pin
  `changePosition` so the change output does not land after the issuance tail.
- UTXO selection, fee estimation and signing remain outside this package.
- Regtest uses ONE global burn address for every operation
  (`REGTEST_GLOBAL_BURN_ADDRESS`, exported); `getBurnAddressForOperation`
  models mainnet/testnet only, so pass the constant through the
  `burnAddress`/`burnAmountSats` overrides when targeting regtest. Note
  regtest shares the `tnq` HRP and base58 prefixes with testnet — networks
  are indistinguishable by address.
- Nodes serving DePIN messaging additionally need `-pubkeyindex=1` (the
  index, like `-assetindex`, does not change transaction validity).
- The relay limit for null-asset data scripts is 512 bytes on testnet AND
  regtest (mainnet keeps 83); a policy limit, not consensus.
- `tests/node-regtest.test.ts` replays the whole DePIN cycle (issue, escorted
  transfer, rejected unescorted transfer, freeze, self-revoke, sub-DePIN,
  reissue with units -1) as live vectors: each cycle transaction is built by
  this library, signed by the node wallet and validated with
  `testmempoolaccept` against a throwaway regtest with `-assetindex
  -addressindex`. Two placement vectors pin the OP_XNA_ASSET rules: a bare
  covenant with the wrapper appended is rejected with the literal
  `op-xna-asset-not-in-right-script-location` reason, and an asset deposit
  into a neurai-key NoAuth commitment is accepted (the witness SPEND of that
  commitment is proven in `neurai-scripts`' `node-regtest-authscript`
  suite). One extra vector calls the node's `issue` RPC directly with
  `&AB` to confirm the node rejects the name the library rejects. The suite
  looks for the DePIN-branch node in the `neurai-wt2` Docker container
  (override with `NEURAI_REGTEST_CONTAINER`) or local binaries via
  `NEURAID_BIN` / `NEURAI_CLI_BIN`, and skips itself when neither is
  available — so a release pipeline must provide one of the two (or run this
  file as a mandatory separate job) for the live vectors to actually gate
  publishing.
