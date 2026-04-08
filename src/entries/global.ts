import * as NeuraiCreateTransaction from '../index.js';

const globalTarget = globalThis as typeof globalThis & {
  NeuraiCreateTransaction?: typeof NeuraiCreateTransaction;
};

globalTarget.NeuraiCreateTransaction = NeuraiCreateTransaction;

export { NeuraiCreateTransaction };
