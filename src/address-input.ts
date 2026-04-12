import type { AddressLike } from './types.js';

export function resolveAddressInput(address: AddressLike): string {
  if (typeof address === 'string') {
    return String(address).trim();
  }

  if (address && typeof address.address === 'string') {
    return String(address.address).trim();
  }

  throw new Error('Address must be a string or an object with an address field');
}
