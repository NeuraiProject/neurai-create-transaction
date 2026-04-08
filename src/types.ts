import type { Network as LegacyNetwork, PQNetwork } from '@neuraiproject/neurai-key';

export type SupportedNetwork = LegacyNetwork | PQNetwork;

export type DestinationType = 'p2pkh' | 'pq';
export type TagOperation = 'tag' | 'untag';
export type FreezeOperation = 'freeze' | 'unfreeze';
export type NullAssetDestinationMode = 'strict' | 'hash20';
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

export interface AddressDestination {
  address: string;
  type: DestinationType;
  network: SupportedNetwork;
  hash: Uint8Array;
}

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
  address: string;
  valueSats: bigint | number;
}

export interface BaseTransactionParams {
  version?: number;
  locktime?: number;
  inputs: TxInput[];
}

export interface PaymentTransactionParams extends BaseTransactionParams {
  payments: TxPaymentOutput[];
  extraOutputs?: SerializedTxOutput[];
}

export interface TransferOutputParams {
  address: string;
  assetName: string;
  amountRaw: bigint | number;
}

export interface TransferWithMessageOutputParams extends TransferOutputParams {
  message: string;
  expireTime?: bigint | number;
}

export interface AssetIssueOutputParams {
  address: string;
  assetName: string;
  quantityRaw: bigint | number;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
}

export interface AssetReissueOutputParams {
  address: string;
  assetName: string;
  quantityRaw: bigint | number;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
}

export interface XnaEnvelope {
  burnAddress?: string;
  burnAmountSats?: bigint | number;
  xnaChangeAddress?: string;
  xnaChangeSats?: bigint | number;
}

export interface AssetTransactionBaseParams extends BaseTransactionParams, XnaEnvelope {}

export interface QualifierTagTransactionParams {
  version?: number;
  locktime?: number;
  qualifierName: string;
  operation: TagOperation;
  targetAddresses: string[];
  inputs: TxInput[];
  burnAddress: string;
  burnAmountSats: bigint | number;
  xnaChangeAddress: string;
  xnaChangeSats: bigint | number;
  qualifierChangeAddress: string;
  qualifierChangeAmountRaw: bigint | number;
  nullAssetDestinationMode?: NullAssetDestinationMode;
}

export interface StandardAssetTransferTransactionParams extends BaseTransactionParams {
  payments?: TxPaymentOutput[];
  transfers?: TransferOutputParams[];
  transferMessages?: TransferWithMessageOutputParams[];
}

export interface IssueAssetTransactionParams extends AssetTransactionBaseParams {
  toAddress: string;
  assetName: string;
  quantityRaw: bigint | number;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
  includeOwnerOutput?: boolean;
  ownerTokenAddress?: string;
  ownerTokenName?: string;
}

export interface IssueSubAssetTransactionParams extends AssetTransactionBaseParams {
  toAddress: string;
  assetName: string;
  quantityRaw: bigint | number;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
  parentOwnerAddress?: string;
}

export interface IssueDepinTransactionParams extends AssetTransactionBaseParams {
  toAddress: string;
  assetName: string;
  quantityRaw: bigint | number;
  ipfsHash?: string;
  ownerTokenAddress?: string;
  reissuable?: boolean;
}

export interface IssueUniqueAssetTransactionParams extends AssetTransactionBaseParams {
  toAddress: string;
  rootName: string;
  assetTags: string[];
  ipfsHashes?: Array<string | undefined>;
  ownerTokenAddress?: string;
}

export interface IssueQualifierTransactionParams extends AssetTransactionBaseParams {
  toAddress: string;
  assetName: string;
  quantityRaw: bigint | number;
  ipfsHash?: string;
  rootChangeAddress?: string;
  changeQuantityRaw?: bigint | number;
}

export interface IssueRestrictedTransactionParams extends AssetTransactionBaseParams {
  toAddress: string;
  assetName: string;
  quantityRaw: bigint | number;
  verifierString: string;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
  ownerChangeAddress?: string;
}

export interface ReissueTransactionParams extends AssetTransactionBaseParams {
  toAddress: string;
  assetName: string;
  quantityRaw: bigint | number;
  units?: number;
  reissuable?: boolean;
  ipfsHash?: string;
  ownerChangeAddress?: string;
}

export interface ReissueRestrictedTransactionParams extends ReissueTransactionParams {
  verifierString?: string;
}

export interface FreezeAddressesTransactionParams extends BaseTransactionParams {
  assetName: string;
  operation: FreezeOperation;
  targetAddresses: string[];
  ownerChangeAddress: string;
  xnaChangeAddress?: string;
  xnaChangeSats?: bigint | number;
  nullAssetDestinationMode?: NullAssetDestinationMode;
}

export interface FreezeAssetTransactionParams extends BaseTransactionParams {
  assetName: string;
  operation: FreezeOperation;
  ownerChangeAddress: string;
  xnaChangeAddress?: string;
  xnaChangeSats?: bigint | number;
}
