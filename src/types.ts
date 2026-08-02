import type {
  IAddressObject,
  ILegacyAuthScriptAddressObject,
  INoAuthAddressObject,
  IPQAddressObject,
  Network as LegacyNetwork,
  PQNetwork
} from '@neuraiproject/neurai-key';

export type SupportedNetwork = LegacyNetwork | PQNetwork;

export type DestinationType = 'p2pkh' | 'authscript';
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

export interface AuthScriptAddressDestination {
  address: string;
  type: 'authscript';
  network: SupportedNetwork;
  program: Uint8Array;
  commitment: Uint8Array;
}

export type AddressDestination = LegacyAddressDestination | AuthScriptAddressDestination;

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
  extraOutputs?: SerializedTxOutput[];
}

export interface PaymentTransactionParams extends BaseTransactionParams {
  payments: TxPaymentOutput[];
}

export interface TransferOutputParams {
  address: AddressLike;
  assetName: string;
  amountRaw: bigint | number;
}

export interface TransferWithMessageOutputParams extends TransferOutputParams {
  message: string;
  expireTime?: bigint | number;
}

/**
 * Parameters for an asset-transfer output that locks under an arbitrary
 * `scriptPubKey` instead of an address. Used to fund covenants, P2SH or any
 * bare non-standard lock for which the caller already has the scriptPubKey
 * bytes. Produces the same `OP_XNA_ASSET + pushdata(payload) + OP_DROP`
 * wrapper as `TransferOutputParams`, but with the recipient scriptPubKey
 * provided verbatim.
 */
export interface TransferToScriptOutputParams {
  /** Raw scriptPubKey bytes (hex) that will prefix the asset-transfer wrapper. */
  scriptPubKeyHex: string;
  assetName: string;
  amountRaw: bigint | number;
  message?: string;
  expireTime?: bigint | number;
}

export interface AssetIssueOutputParams {
  address: AddressLike;
  assetName: string;
  quantityRaw: bigint | number;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
}

export interface AssetReissueOutputParams {
  address: AddressLike;
  assetName: string;
  quantityRaw: bigint | number;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
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
