import type {
  AuthScriptNetwork,
  IAddressObject,
  ILegacyAuthScriptAddressObject,
  INoAuthAddressObject,
  IPQAddressObject,
  IPQAuthScriptAddressObject,
  Network as KeyNetwork,
  PQNetwork
} from '@neuraiproject/neurai-key';

/**
 * Network labels of neurai-key 5. Each one names an address type:
 * `xna` / `xna-test` ECDSA witness v3, `xna-legacy[-test]` and
 * `xna-old-legacy` Base58 P2PKH, `xna-pq[-test]` PQ witness v2 and
 * `xna-authscript[-test]` generic AuthScript witness v1. This library only
 * uses the chain family (mainnet or testnet) of a label.
 */
export type SupportedNetwork = KeyNetwork | PQNetwork | AuthScriptNetwork;

/** AuthScript witness version of a Bech32m destination. */
export type WitnessVersion = 1 | 2 | 3;

/**
 * - `authscript`: generic AuthScript witness v1 (`nc1p…` / `tnc1p…`), contracts
 * - `pq`: strict PQ witness v2 (`pq1z…` / `tpq1z…`)
 * - `ecdsa`: strict ECDSA witness v3 (`nq1r…` / `tnq1r…`)
 */
export type WitnessDestinationType = 'authscript' | 'pq' | 'ecdsa';

export type DestinationType = 'p2pkh' | WitnessDestinationType;

/**
 * NIP-040 asset payload marker: `'rvn'` (legacy, Ravencoin-inherited) or
 * `'xna'`. Consensus per network and height; take it from the node
 * (`getblockchaininfo.asset_marker`, the marker required for the next block)
 * or pass the one you know to be right when building offline. Defaults to
 * `'rvn'` everywhere — this library never infers chain state.
 */
export type AssetMarker = 'rvn' | 'xna';
export type AssetPayloadType = 'transfer' | 'new' | 'owner' | 'reissue';

export interface AssetMarkerOptions {
  assetMarker?: AssetMarker;
}
export type TagOperation = 'tag' | 'untag';
export type FreezeOperation = 'freeze' | 'unfreeze';
export type NullAssetDestinationMode = 'strict' | 'hash20';
export type CreateTransactionOperationType =
  | 'STANDARD_PAYMENT'
  | 'STANDARD_TRANSFER'
  | 'ISSUE_ROOT'
  | 'ISSUE_SUB'
  | 'ISSUE_UNIQUE'
  | 'ISSUE_DEPIN'
  | 'ISSUE_MSGCHANNEL'
  | 'ISSUE_QUALIFIER'
  | 'ISSUE_SUB_QUALIFIER'
  | 'ISSUE_RESTRICTED'
  | 'REISSUE'
  | 'REISSUE_RESTRICTED'
  | 'TRANSFER_DEPIN'
  | 'SELF_REVOKE_DEPIN'
  | 'TAG_ADDRESSES'
  | 'UNTAG_ADDRESSES'
  | 'FREEZE_ADDRESSES'
  | 'UNFREEZE_ADDRESSES'
  | 'FREEZE_ASSET'
  | 'UNFREEZE_ASSET';
export type BurnOperationType =
  | 'ISSUE_ROOT'
  | 'ISSUE_SUB'
  | 'ISSUE_UNIQUE'
  | 'ISSUE_DEPIN'
  | 'ISSUE_MSGCHANNEL'
  | 'ISSUE_QUALIFIER'
  | 'ISSUE_SUB_QUALIFIER'
  | 'ISSUE_RESTRICTED'
  | 'REISSUE'
  | 'REISSUE_RESTRICTED'
  | 'TAG_ADDRESS'
  | 'UNTAG_ADDRESS';

export interface TxInput {
  txid: string;
  vout: number;
  sequence?: number;
  scriptSigHex?: string;
}

export interface SerializedTxOutput {
  valueSats: bigint;
  scriptPubKeyHex: string;
}

export interface AddressObjectLike {
  address: string;
}

export type NeuraiKeyAddressLike =
  | IAddressObject
  | IPQAddressObject
  | IPQAuthScriptAddressObject
  | INoAuthAddressObject
  | ILegacyAuthScriptAddressObject
  | AddressObjectLike;

export type AddressLike = string | NeuraiKeyAddressLike;

export interface LegacyAddressDestination {
  address: string;
  type: 'p2pkh';
  network: SupportedNetwork;
  program: Uint8Array;
  hash: Uint8Array;
}

/**
 * A Bech32m destination: `OP_n 0x20 <32-byte commitment>` with
 * `n = witnessVersion`. The program is the commitment.
 */
export interface WitnessAddressDestination {
  address: string;
  type: WitnessDestinationType;
  witnessVersion: WitnessVersion;
  network: SupportedNetwork;
  program: Uint8Array;
  commitment: Uint8Array;
}

/** Generic AuthScript witness v1 (`nc1p…` / `tnc1p…`). */
export interface AuthScriptAddressDestination extends WitnessAddressDestination {
  type: 'authscript';
  witnessVersion: 1;
}

/** Strict PQ witness v2 (`pq1z…` / `tpq1z…`). */
export interface PQAddressDestination extends WitnessAddressDestination {
  type: 'pq';
  witnessVersion: 2;
}

/** Strict ECDSA witness v3 (`nq1r…` / `tnq1r…`). */
export interface ECDSAAddressDestination extends WitnessAddressDestination {
  type: 'ecdsa';
  witnessVersion: 3;
}

export type AddressDestination =
  | LegacyAddressDestination
  | AuthScriptAddressDestination
  | PQAddressDestination
  | ECDSAAddressDestination;

export interface UnsignedTransaction {
  version?: number;
  inputs: TxInput[];
  outputs: SerializedTxOutput[];
  locktime?: number;
}

export interface BuiltTransaction {
  rawTx: string;
  outputs: SerializedTxOutput[];
}

export interface TxPaymentOutput {
  address: AddressLike;
  valueSats: bigint | number;
}

export interface BaseTransactionParams {
  version?: number;
  locktime?: number;
  inputs: TxInput[];
  /**
   * Pre-serialized outputs appended verbatim. Opaque to the builders: if one
   * of them is an asset output, the caller must have built it with the right
   * `assetMarker` (e.g. `createAssetTransferOutput(..., { assetMarker })`).
   */
  extraOutputs?: SerializedTxOutput[];
  /**
   * NIP-040 marker for every asset output this builder creates
   * (`getblockchaininfo.asset_marker`). An output-level `assetMarker` takes
   * precedence. Default `'rvn'`.
   */
  assetMarker?: AssetMarker;
}

export interface PaymentTransactionParams extends BaseTransactionParams {
  payments: TxPaymentOutput[];
}

export interface TransferOutputParams {
  address: AddressLike;
  assetName: string;
  amountRaw: bigint | number;
  /** NIP-040 marker for this output; overrides the transaction-level value. */
  assetMarker?: AssetMarker;
}

export interface TransferWithMessageOutputParams extends TransferOutputParams {
  message: string;
  expireTime?: bigint | number;
}

/**
 * Parameters for an asset-transfer output that locks under a raw
 * `scriptPubKey` the caller already holds instead of an address. The script
 * MUST be exactly P2PKH (25 bytes) or AuthScript `OP_n <32B>` (34 bytes,
 * `n` = 1, 2 or 3): consensus only accepts the
 * `OP_XNA_ASSET + pushdata(payload) + OP_DROP` wrapper right after one of
 * those prefixes, so any other script (a bare covenant, P2SH, …) is rejected
 * by the builder. To fund a covenant, commit it into an AuthScript
 * destination (neurai-key `getNoAuthAddress`) and use the address-based
 * `TransferOutputParams` instead.
 */
export interface TransferToScriptOutputParams {
  /**
   * Raw scriptPubKey bytes (hex) that will prefix the asset-transfer
   * wrapper. Must be P2PKH-shaped (25 bytes) or AuthScript-shaped
   * (34 bytes, `OP_1`/`OP_2`/`OP_3`).
   */
  scriptPubKeyHex: string;
  assetName: string;
  amountRaw: bigint | number;
  message?: string;
  expireTime?: bigint | number;
  /** NIP-040 marker for this output; overrides the transaction-level value. */
  assetMarker?: AssetMarker;
}

export interface AssetIssueOutputParams {
  address: AddressLike;
  assetName: string;
  quantityRaw: bigint | number;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
  /** NIP-040 marker for this output; overrides the transaction-level value. */
  assetMarker?: AssetMarker;
}

export interface AssetReissueOutputParams {
  address: AddressLike;
  assetName: string;
  quantityRaw: bigint | number;
  /**
   * Decimal places. **Omitting it keeps the asset's current units** (encoded
   * as -1 / 0xff, the same default the node's `reissue` RPC uses). An
   * explicit `0` sets them to zero, which the node only accepts on an asset
   * that already has `units=0`. Must be an integer in -1..8.
   */
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
  /** NIP-040 marker for this output; overrides the transaction-level value. */
  assetMarker?: AssetMarker;
}

export interface XnaEnvelope {
  burnAddress?: AddressLike;
  burnAmountSats?: bigint | number;
  xnaChangeAddress?: AddressLike;
  xnaChangeSats?: bigint | number;
}

export interface AssetTransactionBaseParams extends BaseTransactionParams, XnaEnvelope {}

export interface QualifierTagTransactionParams extends BaseTransactionParams {
  qualifierName: string;
  operation: TagOperation;
  targetAddresses: AddressLike[];
  burnAddress: AddressLike;
  burnAmountSats: bigint | number;
  xnaChangeAddress: AddressLike;
  xnaChangeSats: bigint | number;
  qualifierChangeAddress: AddressLike;
  qualifierChangeAmountRaw: bigint | number;
  nullAssetDestinationMode?: NullAssetDestinationMode;
}

export interface StandardAssetTransferTransactionParams extends BaseTransactionParams {
  payments?: TxPaymentOutput[];
  transfers?: TransferOutputParams[];
  transferMessages?: TransferWithMessageOutputParams[];
  /**
   * Asset transfers to a raw scriptPubKey (covenant, P2SH, bare script...).
   * Output order is fixed:
   *   payments → transfers → transferMessages → transfersToScript → extraOutputs.
   */
  transfersToScript?: TransferToScriptOutputParams[];
}

export interface IssueAssetTransactionParams extends AssetTransactionBaseParams {
  toAddress: AddressLike;
  assetName: string;
  quantityRaw: bigint | number;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
  includeOwnerOutput?: boolean;
  ownerTokenAddress?: AddressLike;
  ownerTokenName?: string;
}

export interface IssueSubAssetTransactionParams extends AssetTransactionBaseParams {
  toAddress: AddressLike;
  assetName: string;
  quantityRaw: bigint | number;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
  parentOwnerAddress?: AddressLike;
  ownerTokenAddress?: AddressLike;
}

export interface IssueDepinTransactionParams extends AssetTransactionBaseParams {
  toAddress: AddressLike;
  assetName: string;
  quantityRaw: bigint | number;
  ipfsHash?: string;
  ownerTokenAddress?: AddressLike;
  reissuable?: boolean;
  /**
   * Where the parent's owner-token change goes when issuing a sub-DEPIN
   * ("&X/Y" requires transferring the immediate parent's owner token "&X!").
   * Ignored for root DEPIN names. Defaults like sub-asset issuance:
   * xnaChangeAddress, then toAddress.
   */
  parentOwnerAddress?: AddressLike;
  /**
   * Optional target network. DEPIN assets only exist on testnet/regtest, so
   * passing a mainnet network throws. The chain is decided by the receiving
   * node, never inferred from addresses; omit to skip the check.
   */
  network?: SupportedNetwork;
}

/**
 * Soulbound rule: a DEPIN transfer is only valid when the transaction also
 * SPENDS a UTXO of the owner token "&X!" and carries an "&X!" transfer output.
 * This builder emits the output; the caller must include the owner-token UTXO
 * in `inputs` (this package does not select UTXOs).
 */
export interface DepinTransferTransactionParams extends BaseTransactionParams {
  /** Transfers of a single DEPIN asset — all entries must share `assetName`. */
  transfers: TransferOutputParams[];
  /**
   * Destination of the escorting "&X!" owner-token transfer. Must NOT be an
   * address being frozen/revoked elsewhere in the transaction.
   */
  ownerChangeAddress: AddressLike;
  xnaChangeAddress?: AddressLike;
  xnaChangeSats?: bigint | number;
  network?: SupportedNetwork;
}

/**
 * Self-revocation: the holder renounces a DEPIN asset without the owner.
 * Consensus (IsDepinSelfRevocationTransaction) additionally requires, on the
 * caller's side of the transaction:
 * - every spent "&X" UTXO comes from `holderAddress` (XNA fee inputs may come
 *   from anywhere), and at least one is spent;
 * - no input or output touches the owner token "&X!";
 * - every "&X" output pays `holderAddress` (beware extraOutputs);
 * - "&X" is not issued or reissued in the same transaction.
 */
export interface DepinSelfRevokeTransactionParams extends BaseTransactionParams {
  assetName: string;
  /** Address renouncing the asset: receives the self-transfer and the null-data mark. */
  holderAddress: AddressLike;
  /** Full "&X" amount being self-transferred back to `holderAddress`. */
  amountRaw: bigint | number;
  xnaChangeAddress?: AddressLike;
  xnaChangeSats?: bigint | number;
  nullAssetDestinationMode?: NullAssetDestinationMode;
  network?: SupportedNetwork;
}

export interface IssueUniqueAssetTransactionParams extends AssetTransactionBaseParams {
  toAddress: AddressLike;
  rootName: string;
  assetTags: string[];
  ipfsHashes?: Array<string | undefined>;
  ownerTokenAddress?: AddressLike;
}

export interface IssueQualifierTransactionParams extends AssetTransactionBaseParams {
  toAddress: AddressLike;
  assetName: string;
  quantityRaw: bigint | number;
  ipfsHash?: string;
  rootChangeAddress?: AddressLike;
  changeQuantityRaw?: bigint | number;
}

export interface IssueRestrictedTransactionParams extends AssetTransactionBaseParams {
  toAddress: AddressLike;
  assetName: string;
  quantityRaw: bigint | number;
  verifierString: string;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
  ownerChangeAddress?: AddressLike;
}

export interface ReissueTransactionParams extends AssetTransactionBaseParams {
  toAddress: AddressLike;
  assetName: string;
  quantityRaw: bigint | number;
  /**
   * Decimal places. **Omitting it keeps the asset's current units** (encoded
   * as -1 / 0xff, the same default the node's `reissue` RPC uses). An
   * explicit `0` sets them to zero, which the node only accepts on an asset
   * that already has `units=0`. Must be an integer in -1..8.
   */
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
  ownerChangeAddress?: AddressLike;
}

export interface ReissueRestrictedTransactionParams extends ReissueTransactionParams {
  verifierString?: string;
}

export interface FreezeAddressesTransactionParams extends BaseTransactionParams {
  assetName: string;
  operation: FreezeOperation;
  targetAddresses: AddressLike[];
  ownerChangeAddress: AddressLike;
  xnaChangeAddress?: AddressLike;
  xnaChangeSats?: bigint | number;
  nullAssetDestinationMode?: NullAssetDestinationMode;
}

export interface FreezeAssetTransactionParams extends BaseTransactionParams {
  assetName: string;
  operation: FreezeOperation;
  ownerChangeAddress: AddressLike;
  xnaChangeAddress?: AddressLike;
  xnaChangeSats?: bigint | number;
}

export type CreateTransactionFromOperationParams =
  | {
      operationType: 'STANDARD_PAYMENT';
      params: PaymentTransactionParams;
    }
  | {
      operationType: 'STANDARD_TRANSFER';
      params: StandardAssetTransferTransactionParams;
    }
  | {
      operationType: 'ISSUE_ROOT';
      params: IssueAssetTransactionParams;
    }
  | {
      operationType: 'ISSUE_SUB';
      params: IssueSubAssetTransactionParams;
    }
  | {
      operationType: 'ISSUE_UNIQUE';
      params: IssueUniqueAssetTransactionParams;
    }
  | {
      operationType: 'ISSUE_DEPIN';
      params: IssueDepinTransactionParams;
    }
  | {
      operationType: 'ISSUE_MSGCHANNEL';
      params: IssueAssetTransactionParams;
    }
  | {
      operationType: 'ISSUE_QUALIFIER' | 'ISSUE_SUB_QUALIFIER';
      params: IssueQualifierTransactionParams;
    }
  | {
      operationType: 'ISSUE_RESTRICTED';
      params: IssueRestrictedTransactionParams;
    }
  | {
      operationType: 'REISSUE';
      params: ReissueTransactionParams;
    }
  | {
      operationType: 'REISSUE_RESTRICTED';
      params: ReissueRestrictedTransactionParams;
    }
  | {
      operationType: 'TRANSFER_DEPIN';
      params: DepinTransferTransactionParams;
    }
  | {
      operationType: 'SELF_REVOKE_DEPIN';
      params: DepinSelfRevokeTransactionParams;
    }
  | {
      operationType: 'TAG_ADDRESSES';
      params: Omit<QualifierTagTransactionParams, 'operation'>;
    }
  | {
      operationType: 'UNTAG_ADDRESSES';
      params: Omit<QualifierTagTransactionParams, 'operation'>;
    }
  | {
      operationType: 'FREEZE_ADDRESSES';
      params: Omit<FreezeAddressesTransactionParams, 'operation'>;
    }
  | {
      operationType: 'UNFREEZE_ADDRESSES';
      params: Omit<FreezeAddressesTransactionParams, 'operation'>;
    }
  | {
      operationType: 'FREEZE_ASSET';
      params: Omit<FreezeAssetTransactionParams, 'operation'>;
    }
  | {
      operationType: 'UNFREEZE_ASSET';
      params: Omit<FreezeAssetTransactionParams, 'operation'>;
    };
