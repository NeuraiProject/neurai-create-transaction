import {
  createAssetTransferOutput,
  createAssetTransferToScriptOutput,
  createGlobalRestrictionOutput,
  createIssueAssetOutput,
  createNullAssetRestrictionOutput,
  createNullAssetTagOutput,
  createOwnerAssetIssueOutput,
  createOwnerAssetTransferOutput,
  createReissueAssetOutput,
  createTransferOutput,
  createTransferWithMessageOutput,
  createVerifierStringOutput,
  createXnaOutput
} from './assets.js';
import {
  assertDepinAssetName,
  assertDepinNetwork,
  getOwnerTokenName,
  getParentAssetName,
  getUniqueAssetName,
  isDepinAssetName,
  normalizeVerifierString,
  OWNER_ASSET_AMOUNT,
  UNIQUE_ASSET_AMOUNT,
  UNIQUE_ASSETS_REISSUABLE,
  UNIQUE_ASSET_UNITS
} from './constants.js';
import { encodeDestinationScript } from './address.js';
import { bytesToHex } from './bytes.js';
import { createUnsignedTransaction } from './tx.js';
import type {
  AddressLike,
  BuiltTransaction,
  CreateTransactionFromOperationParams,
  DepinSelfRevokeTransactionParams,
  DepinTransferTransactionParams,
  FreezeAddressesTransactionParams,
  FreezeAssetTransactionParams,
  FreezeOperation,
  IssueAssetTransactionParams,
  IssueDepinTransactionParams,
  IssueQualifierTransactionParams,
  IssueRestrictedTransactionParams,
  IssueSubAssetTransactionParams,
  IssueUniqueAssetTransactionParams,
  PaymentTransactionParams,
  QualifierTagTransactionParams,
  ReissueRestrictedTransactionParams,
  ReissueTransactionParams,
  SerializedTxOutput,
  StandardAssetTransferTransactionParams
} from './types.js';

function buildTransaction(
  version: number | undefined,
  locktime: number | undefined,
  inputs: PaymentTransactionParams['inputs'],
  outputs: SerializedTxOutput[]
): BuiltTransaction {
  return {
    rawTx: createUnsignedTransaction({
      version: version ?? 2,
      locktime: locktime ?? 0,
      inputs,
      outputs
    }),
    outputs
  };
}

function appendXnaEnvelope(
  outputs: SerializedTxOutput[],
  burnAddress?: AddressLike,
  burnAmountSats?: bigint | number,
  changeAddress?: AddressLike,
  changeSats?: bigint | number
): void {
  if (burnAddress && burnAmountSats !== undefined && BigInt(burnAmountSats) > 0n) {
    outputs.push(createXnaOutput(burnAddress, burnAmountSats));
  }
  if (changeAddress && changeSats !== undefined && BigInt(changeSats) > 0n) {
    outputs.push(createXnaOutput(changeAddress, changeSats));
  }
}

function appendExtraOutputs(outputs: SerializedTxOutput[], extraOutputs?: SerializedTxOutput[]): void {
  if (extraOutputs?.length) {
    outputs.push(...extraOutputs);
  }
}

function freezeFlagFromOperation(operation: FreezeOperation): number {
  return operation === 'freeze' ? 1 : 0;
}

// Compare by decoded destination script, not by address text: two encodings of
// the same destination (e.g. different Bech32 case) must count as equal.
function sameDestination(a: AddressLike, b: AddressLike): boolean {
  return bytesToHex(encodeDestinationScript(a)) === bytesToHex(encodeDestinationScript(b));
}

export function createPaymentTransaction(params: PaymentTransactionParams): BuiltTransaction {
  const outputs = [
    ...params.payments.map((payment) => createXnaOutput(payment.address, payment.valueSats)),
    ...(params.extraOutputs ?? [])
  ];
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createStandardAssetTransferTransaction(
  params: StandardAssetTransferTransactionParams
): BuiltTransaction {
  // Output order is fixed:
  //   payments → transfers → transferMessages → transfersToScript → extraOutputs.
  // Keep transfersToScript after transferMessages so indices of existing
  // callers (payments + transfers + transferMessages) remain stable.
  const outputs: SerializedTxOutput[] = [];
  for (const payment of params.payments ?? []) {
    outputs.push(createXnaOutput(payment.address, payment.valueSats));
  }
  for (const transfer of params.transfers ?? []) {
    outputs.push(createTransferOutput(transfer));
  }
  for (const transfer of params.transferMessages ?? []) {
    outputs.push(createTransferWithMessageOutput(transfer));
  }
  for (const transfer of params.transfersToScript ?? []) {
    outputs.push(createAssetTransferToScriptOutput(transfer));
  }
  appendExtraOutputs(outputs, params.extraOutputs);
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createIssueAssetTransaction(params: IssueAssetTransactionParams): BuiltTransaction {
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);
  // Consensus locates issuance outputs positionally (issue at vout[n-1], owner
  // at vout[n-2]), so extraOutputs must come before them, not after.
  appendExtraOutputs(outputs, params.extraOutputs);

  if (params.includeOwnerOutput ?? true) {
    outputs.push(
      createOwnerAssetIssueOutput(
        params.ownerTokenAddress ?? params.toAddress,
        params.ownerTokenName ?? getOwnerTokenName(params.assetName)
      )
    );
  }

  outputs.push(
    createIssueAssetOutput({
      address: params.toAddress,
      assetName: params.assetName,
      quantityRaw: params.quantityRaw,
      units: params.units ?? 0,
      reissuable: params.reissuable ?? true,
      ipfsHash: params.ipfsHash
    })
  );

  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createIssueSubAssetTransaction(
  params: IssueSubAssetTransactionParams
): BuiltTransaction {
  const parentAssetName = getParentAssetName(params.assetName);
  if (!parentAssetName) {
    throw new Error(`Sub-asset name must contain '/': ${params.assetName}`);
  }

  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);
  appendExtraOutputs(outputs, params.extraOutputs);
  outputs.push(
    createOwnerAssetTransferOutput(
      params.parentOwnerAddress ?? params.xnaChangeAddress ?? params.toAddress,
      getOwnerTokenName(parentAssetName)
    )
  );
  outputs.push(
    createOwnerAssetIssueOutput(
      params.ownerTokenAddress ?? params.toAddress,
      getOwnerTokenName(params.assetName)
    )
  );
  outputs.push(
    createIssueAssetOutput({
      address: params.toAddress,
      assetName: params.assetName,
      quantityRaw: params.quantityRaw,
      units: params.units ?? 0,
      reissuable: params.reissuable ?? true,
      ipfsHash: params.ipfsHash
    })
  );

  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createIssueDepinTransaction(params: IssueDepinTransactionParams): BuiltTransaction {
  assertDepinAssetName(params.assetName);
  assertDepinNetwork(params.network);
  if (BigInt(params.quantityRaw) <= 0n) {
    throw new Error('DEPIN issue quantity must be positive');
  }
  if (params.reissuable !== undefined && typeof params.reissuable !== 'boolean') {
    throw new Error('DEPIN reissuable must be boolean when provided');
  }

  // A sub-DEPIN ("&X/Y") must transfer the immediate parent's owner token in
  // the issuing transaction, exactly like sub-assets. It stays AssetType DEPIN
  // (same burn as the root), so only the output layout follows the sub flow.
  if (getParentAssetName(params.assetName)) {
    return createIssueSubAssetTransaction({
      ...params,
      units: 0,
      reissuable: params.reissuable ?? true,
      parentOwnerAddress: params.parentOwnerAddress,
      ownerTokenAddress: params.ownerTokenAddress ?? params.toAddress
    });
  }

  return createIssueAssetTransaction({
    ...params,
    units: 0,
    includeOwnerOutput: true,
    ownerTokenAddress: params.ownerTokenAddress ?? params.toAddress,
    reissuable: params.reissuable ?? true
  });
}

export function createDepinTransferTransaction(params: DepinTransferTransactionParams): BuiltTransaction {
  assertDepinNetwork(params.network);
  if (!params.transfers?.length) {
    throw new Error('DEPIN transfer requires at least one transfer');
  }
  const assetName = params.transfers[0].assetName;
  assertDepinAssetName(assetName);
  for (const transfer of params.transfers) {
    if (transfer.assetName !== assetName) {
      throw new Error(
        `DEPIN transfers must all move the same asset (got ${transfer.assetName} and ${assetName}); build one transaction per DEPIN asset`
      );
    }
    if (BigInt(transfer.amountRaw) <= 0n) {
      throw new Error(`DEPIN transfer amount must be positive: ${assetName}`);
    }
  }

  const outputs: SerializedTxOutput[] = [];
  for (const transfer of params.transfers) {
    outputs.push(createTransferOutput(transfer));
  }
  // Soulbound escort: consensus also requires SPENDING an "&X!" UTXO, which
  // must be present in params.inputs (this package does not select UTXOs).
  outputs.push(
    createOwnerAssetTransferOutput(params.ownerChangeAddress, getOwnerTokenName(assetName))
  );
  appendXnaEnvelope(outputs, undefined, undefined, params.xnaChangeAddress, params.xnaChangeSats);
  appendExtraOutputs(outputs, params.extraOutputs);
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createDepinSelfRevokeTransaction(
  params: DepinSelfRevokeTransactionParams
): BuiltTransaction {
  assertDepinAssetName(params.assetName);
  assertDepinNetwork(params.network);
  if (BigInt(params.amountRaw) <= 0n) {
    throw new Error('DEPIN self-revoke amount must be positive');
  }

  // Exact consensus pattern: one self-transfer of "&X" back to the holder plus
  // one null-data with flag 1 (the only valid flag without the owner token).
  // No owner token, no burn. The input-side rules live on the caller — see
  // DepinSelfRevokeTransactionParams.
  const outputs: SerializedTxOutput[] = [
    createAssetTransferOutput(params.holderAddress, params.assetName, params.amountRaw),
    createNullAssetRestrictionOutput(
      params.holderAddress,
      params.assetName,
      1,
      params.nullAssetDestinationMode ?? 'strict'
    )
  ];
  appendXnaEnvelope(outputs, undefined, undefined, params.xnaChangeAddress, params.xnaChangeSats);
  appendExtraOutputs(outputs, params.extraOutputs);
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createIssueUniqueAssetTransaction(
  params: IssueUniqueAssetTransactionParams
): BuiltTransaction {
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);
  appendExtraOutputs(outputs, params.extraOutputs);
  outputs.push(
    createOwnerAssetTransferOutput(
      params.ownerTokenAddress ?? params.toAddress,
      getOwnerTokenName(params.rootName)
    )
  );

  for (let index = 0; index < params.assetTags.length; index += 1) {
    outputs.push(
      createIssueAssetOutput({
        address: params.toAddress,
        assetName: getUniqueAssetName(params.rootName, params.assetTags[index]),
        quantityRaw: UNIQUE_ASSET_AMOUNT,
        units: UNIQUE_ASSET_UNITS,
        reissuable: UNIQUE_ASSETS_REISSUABLE,
        ipfsHash: params.ipfsHashes?.[index]
      })
    );
  }

  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createIssueQualifierTransaction(
  params: IssueQualifierTransactionParams
): BuiltTransaction {
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);
  appendExtraOutputs(outputs, params.extraOutputs);

  const parentQualifier = getParentAssetName(params.assetName);
  if (parentQualifier) {
    outputs.push(
      createAssetTransferOutput(
        params.rootChangeAddress ?? params.xnaChangeAddress ?? params.toAddress,
        parentQualifier,
        params.changeQuantityRaw ?? OWNER_ASSET_AMOUNT
      )
    );
  }

  outputs.push(
    createIssueAssetOutput({
      address: params.toAddress,
      assetName: params.assetName,
      quantityRaw: params.quantityRaw,
      units: 0,
      reissuable: false,
      ipfsHash: params.ipfsHash
    })
  );

  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createIssueRestrictedTransaction(
  params: IssueRestrictedTransactionParams
): BuiltTransaction {
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);
  appendExtraOutputs(outputs, params.extraOutputs);
  outputs.push(createVerifierStringOutput(normalizeVerifierString(params.verifierString)));
  outputs.push(
    createOwnerAssetTransferOutput(
      params.ownerChangeAddress ?? params.toAddress,
      getOwnerTokenName(params.assetName)
    )
  );
  outputs.push(
    createIssueAssetOutput({
      address: params.toAddress,
      assetName: params.assetName,
      quantityRaw: params.quantityRaw,
      units: params.units ?? 0,
      reissuable: params.reissuable ?? true,
      ipfsHash: params.ipfsHash
    })
  );
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createReissueTransaction(params: ReissueTransactionParams): BuiltTransaction {
  if (isDepinAssetName(params.assetName)) {
    // DEPIN reissue: units must stay 0 (-1 means "keep"), and the owner-token
    // change must return to the destination address itself.
    if (params.units !== undefined && params.units !== 0 && params.units !== -1) {
      throw new Error('DEPIN reissue units must be 0 or -1 (keep)');
    }
    if (
      params.ownerChangeAddress !== undefined &&
      !sameDestination(params.ownerChangeAddress, params.toAddress)
    ) {
      throw new Error('DEPIN reissue owner change address must match the destination address');
    }
  }

  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);
  // Consensus locates the reissue output at vout[n-1]; extraOutputs go first.
  appendExtraOutputs(outputs, params.extraOutputs);
  outputs.push(
    createOwnerAssetTransferOutput(
      params.ownerChangeAddress ?? params.toAddress,
      getOwnerTokenName(params.assetName)
    )
  );
  outputs.push(
    createReissueAssetOutput({
      address: params.toAddress,
      assetName: params.assetName,
      quantityRaw: params.quantityRaw,
      units: params.units ?? 0,
      reissuable: params.reissuable ?? true,
      ipfsHash: params.ipfsHash
    })
  );
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createReissueRestrictedTransaction(
  params: ReissueRestrictedTransactionParams
): BuiltTransaction {
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);
  appendExtraOutputs(outputs, params.extraOutputs);
  if (params.verifierString) {
    outputs.push(createVerifierStringOutput(normalizeVerifierString(params.verifierString)));
  }
  outputs.push(
    createOwnerAssetTransferOutput(
      params.ownerChangeAddress ?? params.toAddress,
      getOwnerTokenName(params.assetName)
    )
  );
  outputs.push(
    createReissueAssetOutput({
      address: params.toAddress,
      assetName: params.assetName,
      quantityRaw: params.quantityRaw,
      units: params.units ?? 0,
      reissuable: params.reissuable ?? true,
      ipfsHash: params.ipfsHash
    })
  );
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createQualifierTagTransaction(params: QualifierTagTransactionParams): BuiltTransaction {
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);
  outputs.push(
    createAssetTransferOutput(
      params.qualifierChangeAddress,
      params.qualifierName,
      params.qualifierChangeAmountRaw
    )
  );
  for (const address of params.targetAddresses) {
    outputs.push(
      createNullAssetTagOutput(
        address,
        params.qualifierName,
        params.operation,
        params.nullAssetDestinationMode ?? 'strict'
      )
    );
  }
  appendExtraOutputs(outputs, params.extraOutputs);
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createFreezeAddressesTransaction(
  params: FreezeAddressesTransactionParams
): BuiltTransaction {
  if (isDepinAssetName(params.assetName)) {
    // The address holding (or receiving) the owner token cannot be frozen or
    // revoked. The node also rejects spending an "&X!" UTXO that sits on a
    // target address — that input-side rule cannot be checked here (inputs
    // carry no address) and stays the caller's responsibility.
    for (const target of params.targetAddresses) {
      if (sameDestination(target, params.ownerChangeAddress)) {
        throw new Error(
          'DEPIN owner change address cannot be one of the target addresses (owner-holder address cannot be frozen or revoked)'
        );
      }
    }
  }

  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, undefined, undefined, params.xnaChangeAddress, params.xnaChangeSats);
  outputs.push(createOwnerAssetTransferOutput(params.ownerChangeAddress, getOwnerTokenName(params.assetName)));

  for (const address of params.targetAddresses) {
    outputs.push(
      createNullAssetRestrictionOutput(
        address,
        params.assetName,
        freezeFlagFromOperation(params.operation),
        params.nullAssetDestinationMode ?? 'strict'
      )
    );
  }
  appendExtraOutputs(outputs, params.extraOutputs);

  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createFreezeAssetTransaction(
  params: FreezeAssetTransactionParams
): BuiltTransaction {
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, undefined, undefined, params.xnaChangeAddress, params.xnaChangeSats);
  outputs.push(createOwnerAssetTransferOutput(params.ownerChangeAddress, getOwnerTokenName(params.assetName)));
  outputs.push(createGlobalRestrictionOutput(params.assetName, freezeFlagFromOperation(params.operation) + 2));
  appendExtraOutputs(outputs, params.extraOutputs);
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createFromOperation(
  build: CreateTransactionFromOperationParams
): BuiltTransaction {
  switch (build.operationType) {
    case 'STANDARD_PAYMENT':
      return createPaymentTransaction(build.params);
    case 'STANDARD_TRANSFER':
      return createStandardAssetTransferTransaction(build.params);
    case 'ISSUE_ROOT':
    case 'ISSUE_MSGCHANNEL':
      return createIssueAssetTransaction(build.params);
    case 'ISSUE_SUB':
      return createIssueSubAssetTransaction(build.params);
    case 'ISSUE_UNIQUE':
      return createIssueUniqueAssetTransaction(build.params);
    case 'ISSUE_DEPIN':
      return createIssueDepinTransaction(build.params);
    case 'ISSUE_QUALIFIER':
    case 'ISSUE_SUB_QUALIFIER':
      return createIssueQualifierTransaction(build.params);
    case 'ISSUE_RESTRICTED':
      return createIssueRestrictedTransaction(build.params);
    case 'REISSUE':
      return createReissueTransaction(build.params);
    case 'REISSUE_RESTRICTED':
      return createReissueRestrictedTransaction(build.params);
    case 'TRANSFER_DEPIN':
      return createDepinTransferTransaction(build.params);
    case 'SELF_REVOKE_DEPIN':
      return createDepinSelfRevokeTransaction(build.params);
    case 'TAG_ADDRESSES':
      return createQualifierTagTransaction({
        ...build.params,
        operation: 'tag'
      });
    case 'UNTAG_ADDRESSES':
      return createQualifierTagTransaction({
        ...build.params,
        operation: 'untag'
      });
    case 'FREEZE_ADDRESSES':
      return createFreezeAddressesTransaction({
        ...build.params,
        operation: 'freeze'
      });
    case 'UNFREEZE_ADDRESSES':
      return createFreezeAddressesTransaction({
        ...build.params,
        operation: 'unfreeze'
      });
    case 'FREEZE_ASSET':
      return createFreezeAssetTransaction({
        ...build.params,
        operation: 'freeze'
      });
    case 'UNFREEZE_ASSET':
      return createFreezeAssetTransaction({
        ...build.params,
        operation: 'unfreeze'
      });
    default: {
      const unsupported: never = build;
      throw new Error(`Unsupported operation type: ${JSON.stringify(unsupported)}`);
    }
  }
}
