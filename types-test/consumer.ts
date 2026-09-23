// Compiled by `npm run test:types` against the built package (dist/*.d.ts),
// the way an ESM application imports it, with skipLibCheck: false.
import {
  classifyScriptPubKey,
  createPaymentTransaction,
  decodeAddress,
  isWitnessDestination,
  type AddressDestination,
  type BuiltTransaction,
  type SupportedNetwork,
  type WitnessVersion,
} from "@neuraiproject/neurai-create-transaction";
import { decimalToSatoshis, type RawAmount } from "@neuraiproject/neurai-create-transaction/amounts";
import type { IPQAddressObject } from "@neuraiproject/neurai-key";

const destination: AddressDestination = decodeAddress("tnq1rwentz4njukcn400flwk5tu6s8fmzwd3e408nmkqz6dvfysgcdp2suqptef");
export const version: WitnessVersion | undefined = isWitnessDestination(destination) ? destination.witnessVersion : undefined;
export const network: SupportedNetwork = destination.network;
export const built: BuiltTransaction = createPaymentTransaction({
  inputs: [{ txid: "11".repeat(32), vout: 0 }],
  payments: [{ address: destination.address, valueSats: decimalToSatoshis("1") }],
});
export const kind = classifyScriptPubKey("5220" + "00".repeat(32)).type;
export const raw: RawAmount = 1n;
// neurai-key address objects are accepted wherever an address is.
export function pay(pq: IPQAddressObject): BuiltTransaction {
  return createPaymentTransaction({ inputs: [{ txid: "22".repeat(32), vout: 1 }], payments: [{ address: pq, valueSats: 1000n }] });
}
