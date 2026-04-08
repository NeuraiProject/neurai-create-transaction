import {
  asciiBytes,
  bytesToHex,
  compactSize,
  concatBytes,
  i64LE,
  pushData,
  serializeString,
  u64LE
} from './bytes.js';
import { encodeAssetDataReference } from './asset-data.js';
import { encodeDestinationScript, encodeNullAssetDestinationScript } from './address.js';
import {
  OP_DROP,
  OP_RESERVED,
  OP_XNA_ASSET,
  XNA_ISSUE_PREFIX,
  XNA_OWNER_PREFIX,
  XNA_REISSUE_PREFIX,
  XNA_TRANSFER_PREFIX
} from './networks.js';
import type {
  AssetIssueOutputParams,
  AssetReissueOutputParams,
  NullAssetDestinationMode,
  SerializedTxOutput,
  TagOperation,
  TransferOutputParams,
  TransferWithMessageOutputParams
} from './types.js';

export function xnaToSatoshis(amount: number): bigint {
  return BigInt(Math.round(Number(amount || 0) * 1e8));
}

export function assetUnitsToRaw(amount: number): bigint {
  return xnaToSatoshis(amount);
}

export function encodeAssetTransferPayload(
  assetName: string,
  amountRaw: bigint | number,
  message?: string,
  expireTime?: bigint | number
): Uint8Array {
  const payload = [
    XNA_TRANSFER_PREFIX,
    serializeString(assetName),
    u64LE(amountRaw)
  ];

  const encodedMessage = encodeAssetDataReference(message);
  if (encodedMessage.length > 0) {
    payload.push(encodedMessage);
    if (expireTime !== undefined && BigInt(expireTime) !== 0n) {
      payload.push(i64LE(expireTime));
    }
  }

  return concatBytes(...payload);
}

export function encodeAssetTransferScript(
  address: string,
  assetName: string,
  amountRaw: bigint | number,
  message?: string,
  expireTime?: bigint | number
): Uint8Array {
  return concatBytes(
    encodeDestinationScript(address),
    Uint8Array.of(OP_XNA_ASSET),
    pushData(encodeAssetTransferPayload(assetName, amountRaw, message, expireTime)),
    Uint8Array.of(OP_DROP)
  );
}

export function encodeNewAssetPayload(
  assetName: string,
  quantityRaw: bigint | number,
  units = 0,
  reissuable = true,
  ipfsHash?: string
): Uint8Array {
  const encodedIpfs = encodeAssetDataReference(ipfsHash);
  return concatBytes(
    XNA_ISSUE_PREFIX,
    serializeString(assetName),
    u64LE(quantityRaw),
    Uint8Array.of(units & 0xff, reissuable ? 1 : 0, encodedIpfs.length > 0 ? 1 : 0),
    encodedIpfs
  );
}

export function encodeNewAssetScript(
  address: string,
  assetName: string,
  quantityRaw: bigint | number,
  units = 0,
  reissuable = true,
  ipfsHash?: string
): Uint8Array {
  return concatBytes(
    encodeDestinationScript(address),
    Uint8Array.of(OP_XNA_ASSET),
    pushData(encodeNewAssetPayload(assetName, quantityRaw, units, reissuable, ipfsHash)),
    Uint8Array.of(OP_DROP)
  );
}

export function encodeOwnerAssetPayload(ownerTokenName: string): Uint8Array {
  return concatBytes(
    XNA_OWNER_PREFIX,
    serializeString(ownerTokenName)
  );
}

export function encodeOwnerAssetScript(address: string, ownerTokenName: string): Uint8Array {
  return concatBytes(
    encodeDestinationScript(address),
    Uint8Array.of(OP_XNA_ASSET),
    pushData(encodeOwnerAssetPayload(ownerTokenName)),
    Uint8Array.of(OP_DROP)
  );
}

export function encodeReissueAssetPayload(
  assetName: string,
  quantityRaw: bigint | number,
  units = 0,
  reissuable = true,
  ipfsHash?: string
): Uint8Array {
  return concatBytes(
    XNA_REISSUE_PREFIX,
    serializeString(assetName),
    u64LE(quantityRaw),
    Uint8Array.of(units & 0xff, reissuable ? 1 : 0),
    encodeAssetDataReference(ipfsHash)
  );
}

export function encodeReissueAssetScript(
  address: string,
  assetName: string,
  quantityRaw: bigint | number,
  units = 0,
  reissuable = true,
  ipfsHash?: string
): Uint8Array {
  return concatBytes(
    encodeDestinationScript(address),
    Uint8Array.of(OP_XNA_ASSET),
    pushData(encodeReissueAssetPayload(assetName, quantityRaw, units, reissuable, ipfsHash)),
    Uint8Array.of(OP_DROP)
  );
}

export function encodeNullAssetDataPayload(
  assetName: string,
  flag: number
): Uint8Array {
  const nameBytes = asciiBytes(assetName);
  return concatBytes(
    compactSize(nameBytes.length),
    nameBytes,
    Uint8Array.of(flag & 0xff)
  );
}

export function encodeNullAssetTagPayload(
  qualifierName: string,
  operation: TagOperation
): Uint8Array {
  return encodeNullAssetDataPayload(qualifierName, operation === 'tag' ? 1 : 0);
}

export function encodeNullAssetTagScript(
  address: string,
  qualifierName: string,
  operation: TagOperation,
  mode: NullAssetDestinationMode = 'strict'
): Uint8Array {
  return concatBytes(
    encodeNullAssetDestinationScript(address, mode),
    pushData(encodeNullAssetTagPayload(qualifierName, operation))
  );
}

export function encodeNullAssetRestrictionScript(
  address: string,
  assetName: string,
  freezeFlag: number,
  mode: NullAssetDestinationMode = 'strict'
): Uint8Array {
  return concatBytes(
    encodeNullAssetDestinationScript(address, mode),
    pushData(encodeNullAssetDataPayload(assetName, freezeFlag))
  );
}

export function encodeVerifierStringPayload(verifierString: string): Uint8Array {
  return serializeString(verifierString);
}

export function encodeVerifierStringScript(verifierString: string): Uint8Array {
  return concatBytes(
    Uint8Array.of(OP_XNA_ASSET, OP_RESERVED),
    pushData(encodeVerifierStringPayload(verifierString))
  );
}

export function encodeGlobalRestrictionScript(
  assetName: string,
  freezeFlag: number
): Uint8Array {
  return concatBytes(
    Uint8Array.of(OP_XNA_ASSET, OP_RESERVED, OP_RESERVED),
    pushData(encodeNullAssetDataPayload(assetName, freezeFlag))
  );
}

export function createXnaOutput(address: string, valueSats: bigint | number): SerializedTxOutput {
  return {
    valueSats: typeof valueSats === 'bigint' ? valueSats : BigInt(valueSats),
    scriptPubKeyHex: bytesToHex(encodeDestinationScript(address))
  };
}

export function createAssetTransferOutput(
  address: string,
  assetName: string,
  amountRaw: bigint | number
): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(encodeAssetTransferScript(address, assetName, amountRaw))
  };
}

export function createTransferWithMessageOutput(
  params: TransferWithMessageOutputParams
): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(
      encodeAssetTransferScript(
        params.address,
        params.assetName,
        params.amountRaw,
        params.message,
        params.expireTime
      )
    )
  };
}

export function createOwnerAssetTransferOutput(
  address: string,
  ownerTokenName: string
): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(encodeOwnerAssetScript(address, ownerTokenName))
  };
}

export function createIssueAssetOutput(params: AssetIssueOutputParams): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(
      encodeNewAssetScript(
        params.address,
        params.assetName,
        params.quantityRaw,
        params.units ?? 0,
        params.reissuable ?? true,
        params.ipfsHash
      )
    )
  };
}

export function createReissueAssetOutput(params: AssetReissueOutputParams): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(
      encodeReissueAssetScript(
        params.address,
        params.assetName,
        params.quantityRaw,
        params.units ?? 0,
        params.reissuable ?? true,
        params.ipfsHash
      )
    )
  };
}

export function createNullAssetTagOutput(
  address: string,
  qualifierName: string,
  operation: TagOperation,
  mode: NullAssetDestinationMode = 'strict'
): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(encodeNullAssetTagScript(address, qualifierName, operation, mode))
  };
}

export function createNullAssetRestrictionOutput(
  address: string,
  assetName: string,
  freezeFlag: number,
  mode: NullAssetDestinationMode = 'strict'
): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(encodeNullAssetRestrictionScript(address, assetName, freezeFlag, mode))
  };
}

export function createVerifierStringOutput(verifierString: string): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(encodeVerifierStringScript(verifierString))
  };
}

export function createGlobalRestrictionOutput(
  assetName: string,
  freezeFlag: number
): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(encodeGlobalRestrictionScript(assetName, freezeFlag))
  };
}

export function createTransferOutput(params: TransferOutputParams): SerializedTxOutput {
  return createAssetTransferOutput(params.address, params.assetName, params.amountRaw);
}
