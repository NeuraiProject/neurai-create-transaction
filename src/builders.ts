import {
  createAssetTransferOutput,
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
  getOwnerTokenName,
  getParentAssetName,
  getUniqueAssetName,
  normalizeVerifierString,
  OWNER_ASSET_AMOUNT,
  UNIQUE_ASSET_AMOUNT,
  UNIQUE_ASSETS_REISSUABLE,
  UNIQUE_ASSET_UNITS
} from './constants.js';
import { createUnsignedTransaction } from './tx.js';
import type {
  BuiltTransaction,
  CreateTransactionFromOperationParams,
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
  burnAddress?: string,
  burnAmountSats?: bigint | number,
  changeAddress?: string,
  changeSats?: bigint | number
): void {
  if (burnAddress && burnAmountSats !== undefined && BigInt(burnAmountSats) > 0n) {
    outputs.push(createXnaOutput(burnAddress, burnAmountSats));
  }
  if (changeAddress && changeSats !== undefined && BigInt(changeSats) > 0n) {
    outputs.push(createXnaOutput(changeAddress, changeSats));
  }
}

function freezeFlagFromOperation(operation: FreezeOperation): number {
  return operation === 'freeze' ? 1 : 0;
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
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createIssueAssetTransaction(params: IssueAssetTransactionParams): BuiltTransaction {
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);

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
  if (params.reissuable !== undefined && typeof params.reissuable !== 'boolean') {
    throw new Error('DEPIN reissuable must be boolean when provided');
  }
  return createIssueAssetTransaction({
    ...params,
    units: 0,
    includeOwnerOutput: true,
    ownerTokenAddress: params.ownerTokenAddress ?? params.toAddress,
    reissuable: params.reissuable ?? true
  });
}

export function createIssueUniqueAssetTransaction(
  params: IssueUniqueAssetTransactionParams
): BuiltTransaction {
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);
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
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, params.burnAddress, params.burnAmountSats, params.xnaChangeAddress, params.xnaChangeSats);
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
  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createFreezeAddressesTransaction(
  params: FreezeAddressesTransactionParams
): BuiltTransaction {
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

  return buildTransaction(params.version, params.locktime, params.inputs, outputs);
}

export function createFreezeAssetTransaction(
  params: FreezeAssetTransactionParams
): BuiltTransaction {
  const outputs: SerializedTxOutput[] = [];
  appendXnaEnvelope(outputs, undefined, undefined, params.xnaChangeAddress, params.xnaChangeSats);
  outputs.push(createOwnerAssetTransferOutput(params.ownerChangeAddress, getOwnerTokenName(params.assetName)));
  outputs.push(createGlobalRestrictionOutput(params.assetName, freezeFlagFromOperation(params.operation) + 2));
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
