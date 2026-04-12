import { getAddressByPath, getHDKey, getNoAuthAddress } from '@neuraiproject/neurai-key';
import { describe, expect, it } from 'vitest';
import {
  decodeAddress,
  encodeAuthScriptDestinationScript,
  encodeDestinationScript,
  encodeNullAssetDestinationScript,
  encodeP2PKHScript,
  encodePQWitnessScript,
  resolveAddressInput
} from '../src/address.js';
import { bytesToHex } from '../src/bytes.js';

const LEGACY_TEST = 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA';
const AUTHSCRIPT_TEST = 'tnq1p83wfxfypfr3tqpwakdgmk5r0pwpsemq5ngdsx7gef8yc84pndfmqjer8rk';
const AUTHSCRIPT_COMMITMENT = '3c5c93248148e2b005ddb351bb506f0b830cec149a1b03791949c983d4336a76';
const LEGACY_HD_OBJECT = getAddressByPath(
  'xna-test',
  getHDKey('xna-test', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'),
  'm/0/0'
);
const NOAUTH_OBJECT = getNoAuthAddress('xna-pq-test');

describe('address', () => {
  it('decodes legacy testnet addresses', () => {
    const decoded = decodeAddress(LEGACY_TEST);
    expect(decoded.type).toBe('p2pkh');
    expect(decoded.network).toBe('xna-test');
    expect(bytesToHex(decoded.hash)).toBe('e295c733ad2c8e92954d547603f9f63d99eae6c4');
  });

  it('decodes AuthScript testnet addresses', () => {
    const decoded = decodeAddress(AUTHSCRIPT_TEST);
    expect(decoded.type).toBe('authscript');
    expect(decoded.network).toBe('xna-pq-test');
    expect(bytesToHex(decoded.commitment)).toBe(AUTHSCRIPT_COMMITMENT);
  });

  it('encodes legacy and AuthScript destination scripts', () => {
    expect(bytesToHex(encodeP2PKHScript(LEGACY_TEST))).toBe(
      '76a914e295c733ad2c8e92954d547603f9f63d99eae6c488ac'
    );
    expect(bytesToHex(encodeAuthScriptDestinationScript(AUTHSCRIPT_TEST))).toBe(
      `5120${AUTHSCRIPT_COMMITMENT}`
    );
    expect(bytesToHex(encodePQWitnessScript(AUTHSCRIPT_TEST))).toBe(
      `5120${AUTHSCRIPT_COMMITMENT}`
    );
    expect(bytesToHex(encodeDestinationScript(AUTHSCRIPT_TEST))).toBe(
      `5120${AUTHSCRIPT_COMMITMENT}`
    );
  });

  it('encodes canonical null-asset destination scripts', () => {
    expect(bytesToHex(encodeNullAssetDestinationScript(AUTHSCRIPT_TEST, 'strict'))).toBe(
      `c05120${AUTHSCRIPT_COMMITMENT}`
    );
    expect(bytesToHex(encodeNullAssetDestinationScript(LEGACY_TEST))).toBe(
      'c014e295c733ad2c8e92954d547603f9f63d99eae6c4'
    );
    expect(() => encodeNullAssetDestinationScript(AUTHSCRIPT_TEST, 'hash20')).toThrow(
      /hash20 null-asset mode is not supported/
    );
  });

  it('accepts direct neurai-key address objects', () => {
    expect(resolveAddressInput(LEGACY_HD_OBJECT)).toBe(LEGACY_HD_OBJECT.address);
    expect(resolveAddressInput(NOAUTH_OBJECT)).toBe(NOAUTH_OBJECT.address);

    expect(bytesToHex(encodeP2PKHScript(LEGACY_HD_OBJECT))).toBe(
      bytesToHex(encodeP2PKHScript(LEGACY_HD_OBJECT.address))
    );
    expect(bytesToHex(encodeDestinationScript(NOAUTH_OBJECT))).toBe(
      bytesToHex(encodeDestinationScript(NOAUTH_OBJECT.address))
    );

    const decoded = decodeAddress(NOAUTH_OBJECT);
    expect(decoded.type).toBe('authscript');
    expect(decoded.address).toBe(NOAUTH_OBJECT.address);
  });

  it('rejects unsupported or empty addresses', () => {
    expect(() => decodeAddress('')).toThrow(/Address is required/);
    expect(() => decodeAddress('1badaddress')).toThrow();
  });
});
