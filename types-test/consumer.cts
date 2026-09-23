// CommonJS consumer: resolves the `require` conditions (dist/index.d.cts,
// dist/amounts.d.cts). Every value export is used, so a missing declaration
// fails to compile.
import ct = require("@neuraiproject/neurai-create-transaction");
import amounts = require("@neuraiproject/neurai-create-transaction/amounts");

export const values = [
  ct.AUTHSCRIPT_MAINNET_HRP, ct.AUTHSCRIPT_TESTNET_HRP, ct.DEFAULT_ASSET_MARKER, ct.DEPIN_MAX_NAME_LENGTH,
  ct.ECDSA_MAINNET_HRP, ct.ECDSA_TESTNET_HRP, ct.MAX_MONEY, ct.OWNER_ASSET_AMOUNT,
  ct.PQ_MAINNET_HRP, ct.PQ_TESTNET_HRP, ct.REGTEST_GLOBAL_BURN_ADDRESS, ct.SATS_PER_XNA,
  ct.UNIQUE_ASSETS_REISSUABLE, ct.UNIQUE_ASSET_AMOUNT, ct.UNIQUE_ASSET_UNITS, ct.WITNESS_FAMILIES,
  ct.assertDepinAssetName, ct.assertDepinNetwork, ct.assertMoneyRange, ct.assetPayloadPrefix,
  ct.assetUnitsToRaw, ct.classifyScriptPubKey, ct.computeTxid, ct.computeWtxid,
  ct.createAssetTransferOutput, ct.createAssetTransferToScriptOutput, ct.createDepinSelfRevokeTransaction, ct.createDepinTransferTransaction,
  ct.createFreezeAddressesTransaction, ct.createFreezeAssetTransaction, ct.createFromOperation, ct.createGlobalRestrictionOutput,
  ct.createIssueAssetOutput, ct.createIssueAssetTransaction, ct.createIssueDepinTransaction, ct.createIssueQualifierTransaction,
  ct.createIssueRestrictedTransaction, ct.createIssueSubAssetTransaction, ct.createIssueUniqueAssetTransaction, ct.createNullAssetRestrictionOutput,
  ct.createNullAssetTagOutput, ct.createOwnerAssetIssueOutput, ct.createOwnerAssetTransferOutput, ct.createPaymentTransaction,
  ct.createQualifierTagTransaction, ct.createReissueAssetOutput, ct.createReissueRestrictedTransaction, ct.createReissueTransaction,
  ct.createStandardAssetTransferTransaction, ct.createTransferOutput, ct.createTransferWithMessageOutput, ct.createUnsignedTransaction,
  ct.createVerifierStringOutput, ct.createXnaOutput, ct.decimalToSatoshis, ct.decodeAddress,
  ct.decodeAssetDataReferenceHex, ct.encodeAssetDataReference, ct.encodeAssetTransferPayload, ct.encodeAssetTransferScript,
  ct.encodeAssetTransferScriptToScript, ct.encodeAuthScriptDestinationScript, ct.encodeDestinationScript, ct.encodeGlobalRestrictionScript,
  ct.encodeNewAssetPayload, ct.encodeNewAssetScript, ct.encodeNullAssetDataPayload, ct.encodeNullAssetDestinationScript,
  ct.encodeNullAssetRestrictionScript, ct.encodeNullAssetTagPayload, ct.encodeNullAssetTagScript, ct.encodeOwnerAssetPayload,
  ct.encodeOwnerAssetScript, ct.encodeP2PKHScript, ct.encodePQWitnessScript, ct.encodeReissueAssetPayload,
  ct.encodeReissueAssetScript, ct.encodeVerifierStringPayload, ct.encodeVerifierStringScript, ct.encodeWitnessProgramScript,
  ct.estimateTransactionSize, ct.formatAssetDataReferenceHex, ct.getBurnAddressForOperation, ct.getBurnAmountSats,
  ct.getBurnAmountXna, ct.getOwnerTokenName, ct.getParentAssetName, ct.getUniqueAssetName,
  ct.inferNetworkFromAnyAddress, ct.isCidV0AssetReference, ct.isDepinAssetName, ct.isEncodedAssetDataReferenceHex,
  ct.isRawAssetDataReferenceHex, ct.isTxidAssetReference, ct.isWitnessDestination, ct.normalizeVerifierString,
  ct.parseTransaction, ct.resolveAddressInput, ct.resolveAssetMarker, ct.satoshisToDecimal,
  ct.serializeInput, ct.serializeOutput, ct.serializeTransaction, ct.toRawInteger,
  ct.xnaToSatoshis,
];
export const amountValues = [
  amounts.MAX_MONEY, amounts.SATS_PER_XNA, amounts.assertMoneyRange, amounts.decimalToSatoshis,
  amounts.satoshisToDecimal, amounts.toRawInteger,
];
export const destination: ct.AddressDestination = ct.decodeAddress("tpq1z5age5p2v5q9w6qzadkjp4yep8gpr56q6mzd4fu6eus8ntulul6vq3q07pc");
export const sats: bigint = amounts.decimalToSatoshis("1.5");
export type Networks = ct.SupportedNetwork | ct.WitnessDestinationType;
