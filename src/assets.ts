import {
  asciiBytes,
  bytesToHex,
  compactSize,
  concatBytes,
  ensureHex,
  hexToBytes,
  i64LE,
  pushData,
  serializeString,
  u64LE
} from './bytes.js';
import { encodeAssetDataReference } from './asset-data.js';
import { encodeDestinationScript, encodeNullAssetDestinationScript } from './address.js';
import { assetPayloadPrefix, OP_DROP, OP_RESERVED, OP_XNA_ASSET } from './networks.js';
import { OWNER_ASSET_AMOUNT } from './constants.js';
import type {
  AddressLike,
  AssetIssueOutputParams,
  AssetMarkerOptions,
  AssetReissueOutputParams,
  NullAssetDestinationMode,
  SerializedTxOutput,
  TagOperation,
  TransferOutputParams,
  TransferToScriptOutputParams,
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
  expireTime?: bigint | number,
  options?: AssetMarkerOptions
): Uint8Array {
  const payload = [
    assetPayloadPrefix(options?.assetMarker, 'transfer'),
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
  address: AddressLike,
  assetName: string,
  amountRaw: bigint | number,
  message?: string,
  expireTime?: bigint | number,
  options?: AssetMarkerOptions
): Uint8Array {
  return concatBytes(
    encodeDestinationScript(address),
    Uint8Array.of(OP_XNA_ASSET),
    pushData(encodeAssetTransferPayload(assetName, amountRaw, message, expireTime, options)),
    Uint8Array.of(OP_DROP)
  );
}

/**
 * True when `script` is exactly the 25-byte P2PKH form
 * `OP_DUP OP_HASH160 0x14 <20B> OP_EQUALVERIFY OP_CHECKSIG`. Consensus only
 * recognises the asset wrapper when OP_XNA_ASSET sits at byte 25 after this
 * exact prefix (node `HasAssetOpcodeInExpectedPosition`).
 */
export function isP2pkhScript(script: Uint8Array): boolean {
  return (
    script.length === 25 &&
    script[0] === 0x76 &&
    script[1] === 0xa9 &&
    script[2] === 0x14 &&
    script[23] === 0x88 &&
    script[24] === 0xac
  );
}

/**
 * True when `script` is exactly the 34-byte AuthScript form
 * `OP_1 0x20 <32-byte commitment>`. Consensus only recognises the asset
 * wrapper when OP_XNA_ASSET sits at byte 34 after this exact prefix.
 */
export function isAuthScriptScript(script: Uint8Array): boolean {
  return script.length === 34 && script[0] === 0x51 && script[1] === 0x20;
}

/**
 * Like `encodeAssetTransferScript` but takes a raw scriptPubKey instead of
 * deriving one from an address, for callers that already hold the
 * scriptPubKey bytes.
 *
 * The recipient script must be exactly P2PKH (25 bytes) or AuthScript
 * `OP_1 <32B>` (34 bytes): the node's OP_XNA_ASSET placement rules only
 * accept the asset wrapper right after one of those two prefixes, on every
 * network, so appending it to any other script (a bare covenant, P2SH, …)
 * produces a consensus-invalid output. To pay assets into an arbitrary
 * script, commit it into an AuthScript destination instead (derive the
 * address with neurai-key's `getNoAuthAddress`) and use the regular
 * address-based transfer helpers.
 *
 * The asset-transfer wrapper is appended exactly as in the address-based
 * variant: `<recipientScriptPubKey> OP_XNA_ASSET <pushdata(payload)> OP_DROP`.
 *
 * Note: this helper only builds the output. Spending an AuthScript output
 * takes a witness stack; `createUnsignedTransaction` serializes the legacy
 * pre-segwit format only, so serialize such spends with the transaction
 * codec's `serializeTransaction` (tx-codec.ts, 0.5.1+) instead.
 */
export function encodeAssetTransferScriptToScript(
  recipientScriptPubKey: Uint8Array | string,
  assetName: string,
  amountRaw: bigint | number,
  message?: string,
  expireTime?: bigint | number,
  options?: AssetMarkerOptions
): Uint8Array {
  const spkBytes =
    typeof recipientScriptPubKey === 'string'
      ? hexToBytes(ensureHex(recipientScriptPubKey, 'recipientScriptPubKey'))
      : recipientScriptPubKey;

  if (!isP2pkhScript(spkBytes) && !isAuthScriptScript(spkBytes)) {
    throw new Error(
      'asset transfers to arbitrary scripts are rejected by consensus ' +
        '(OP_XNA_ASSET placement rules): the recipient scriptPubKey must be ' +
        'exactly P2PKH (25 bytes) or AuthScript OP_1 <32B> (34 bytes); ' +
        'commit the script into an AuthScript destination instead'
    );
  }

  return concatBytes(
    spkBytes,
    Uint8Array.of(OP_XNA_ASSET),
    pushData(encodeAssetTransferPayload(assetName, amountRaw, message, expireTime, options)),
    Uint8Array.of(OP_DROP)
  );
}

export function encodeNewAssetPayload(
  assetName: string,
  quantityRaw: bigint | number,
  units = 0,
  reissuable = true,
  ipfsHash?: string,
  options?: AssetMarkerOptions
): Uint8Array {
  const encodedIpfs = encodeAssetDataReference(ipfsHash);
  return concatBytes(
    assetPayloadPrefix(options?.assetMarker, 'new'),
    serializeString(assetName),
    u64LE(quantityRaw),
    Uint8Array.of(units & 0xff, reissuable ? 1 : 0, encodedIpfs.length > 0 ? 1 : 0),
    encodedIpfs
  );
}

export function encodeNewAssetScript(
  address: AddressLike,
  assetName: string,
  quantityRaw: bigint | number,
  units = 0,
  reissuable = true,
  ipfsHash?: string,
  options?: AssetMarkerOptions
): Uint8Array {
  return concatBytes(
    encodeDestinationScript(address),
    Uint8Array.of(OP_XNA_ASSET),
    pushData(encodeNewAssetPayload(assetName, quantityRaw, units, reissuable, ipfsHash, options)),
    Uint8Array.of(OP_DROP)
  );
}

export function encodeOwnerAssetPayload(ownerTokenName: string, options?: AssetMarkerOptions): Uint8Array {
  return concatBytes(
    assetPayloadPrefix(options?.assetMarker, 'owner'),
    serializeString(ownerTokenName)
  );
}

export function encodeOwnerAssetScript(
  address: AddressLike,
  ownerTokenName: string,
  options?: AssetMarkerOptions
): Uint8Array {
  return concatBytes(
    encodeDestinationScript(address),
    Uint8Array.of(OP_XNA_ASSET),
    pushData(encodeOwnerAssetPayload(ownerTokenName, options)),
    Uint8Array.of(OP_DROP)
  );
}

export function encodeReissueAssetPayload(
  assetName: string,
  quantityRaw: bigint | number,
  units = 0,
  reissuable = true,
  ipfsHash?: string,
  options?: AssetMarkerOptions
): Uint8Array {
  return concatBytes(
    assetPayloadPrefix(options?.assetMarker, 'reissue'),
    serializeString(assetName),
    u64LE(quantityRaw),
    Uint8Array.of(units & 0xff, reissuable ? 1 : 0),
    encodeAssetDataReference(ipfsHash)
  );
}

export function encodeReissueAssetScript(
  address: AddressLike,
  assetName: string,
  quantityRaw: bigint | number,
  units = 0,
  reissuable = true,
  ipfsHash?: string,
  options?: AssetMarkerOptions
): Uint8Array {
  return concatBytes(
    encodeDestinationScript(address),
    Uint8Array.of(OP_XNA_ASSET),
    pushData(encodeReissueAssetPayload(assetName, quantityRaw, units, reissuable, ipfsHash, options)),
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
  address: AddressLike,
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
  address: AddressLike,
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

export function createXnaOutput(address: AddressLike, valueSats: bigint | number): SerializedTxOutput {
  return {
    valueSats: typeof valueSats === 'bigint' ? valueSats : BigInt(valueSats),
    scriptPubKeyHex: bytesToHex(encodeDestinationScript(address))
  };
}

export function createAssetTransferOutput(
  address: AddressLike,
  assetName: string,
  amountRaw: bigint | number,
  options?: AssetMarkerOptions
): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(
      encodeAssetTransferScript(address, assetName, amountRaw, undefined, undefined, options)
    )
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
        params.expireTime,
        { assetMarker: params.assetMarker }
      )
    )
  };
}

export function createOwnerAssetIssueOutput(
  address: AddressLike,
  ownerTokenName: string,
  options?: AssetMarkerOptions
): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(encodeOwnerAssetScript(address, ownerTokenName, options))
  };
}

export function createOwnerAssetTransferOutput(
  address: AddressLike,
  ownerTokenName: string,
  options?: AssetMarkerOptions
): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(
      encodeAssetTransferScript(address, ownerTokenName, OWNER_ASSET_AMOUNT, undefined, undefined, options)
    )
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
        params.ipfsHash,
        { assetMarker: params.assetMarker }
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
        params.ipfsHash,
        { assetMarker: params.assetMarker }
      )
    )
  };
}

export function createNullAssetTagOutput(
  address: AddressLike,
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
  address: AddressLike,
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
  return createAssetTransferOutput(params.address, params.assetName, params.amountRaw, {
    assetMarker: params.assetMarker
  });
}

/**
 * Build a SerializedTxOutput that locks `amountRaw` of `assetName` under a
 * raw P2PKH or AuthScript scriptPubKey (the only shapes consensus accepts —
 * see `encodeAssetTransferScriptToScript`; covenants go through neurai-key's
 * `getNoAuthAddress` and the address-based helpers). `valueSats` is
 * hardcoded to 0n (asset-only outputs carry no XNA; matches
 * `createAssetTransferOutput` semantics).
 */
export function createAssetTransferToScriptOutput(
  params: TransferToScriptOutputParams
): SerializedTxOutput {
  return {
    valueSats: 0n,
    scriptPubKeyHex: bytesToHex(
      encodeAssetTransferScriptToScript(
        params.scriptPubKeyHex,
        params.assetName,
        params.amountRaw,
        params.message,
        params.expireTime,
        { assetMarker: params.assetMarker }
      )
    )
  };
}
