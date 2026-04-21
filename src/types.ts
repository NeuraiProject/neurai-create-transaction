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
