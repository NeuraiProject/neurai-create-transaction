import {
  getAddressByPath,
  getHDKey,
  getNoAuthAddress,
  getPQAddress,
  getPQAuthScriptAddress
} from '@neuraiproject/neurai-key';
import { bech32m } from 'bech32';
import { describe, expect, it } from 'vitest';
import {
  classifyScriptPubKey,
  decodeAddress,
  encodeAuthScriptDestinationScript,
  encodeDestinationScript,
  encodeNullAssetDestinationScript,
  encodeP2PKHScript,
  encodePQWitnessScript,
  encodeWitnessProgramScript,
  inferNetworkFromAddress,
  isWitnessDestination,
  resolveAddressInput
} from '../src/address.js';
import { bytesToHex } from '../src/bytes.js';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const LEGACY_TEST = 'tTagBurnXXXXXXXXXXXXXXXXXXXXYm6pxA';
// Generic AuthScript v1. The same commitment was encoded as
// tnq1p83wfxfypfr3tqpwakdgmk5r0pwpsemq5ngdsx7gef8yc84pndfmqjer8rk before the
// node moved witness v1 to the nc / tnc prefixes.
const AUTHSCRIPT_TEST = 'tnc1p83wfxfypfr3tqpwakdgmk5r0pwpsemq5ngdsx7gef8yc84pndfmqqd6m25';
const OLD_AUTHSCRIPT_TEST = 'tnq1p83wfxfypfr3tqpwakdgmk5r0pwpsemq5ngdsx7gef8yc84pndfmqjer8rk';
const AUTHSCRIPT_COMMITMENT = '3c5c93248148e2b005ddb351bb506f0b830cec149a1b03791949c983d4336a76';

// Addresses produced by a regtest node (getnewaddress "" pq|ecdsa and the
// default of a PQ wallet) with the scriptPubKey its validateaddress reports.
const NODE_VECTORS = [
  {
    address: 'tnc1p8802g0lnexmnvj7up5f55wz4elvj7xf7ytm0n6t95adrhl4vfgcq4r7pld',
    type: 'authscript',
    witnessVersion: 1,
    network: 'xna-authscript-test',
    scriptPubKey: '512039dea43ff3c9b7364bdc0d134a3855cfd92f193e22f6f9e965a75a3bfeac4a30'
  },
  {
    address: 'tpq1z5age5p2v5q9w6qzadkjp4yep8gpr56q6mzd4fu6eus8ntulul6vq3q07pc',
    type: 'pq',
    witnessVersion: 2,
    network: 'xna-pq-test',
    scriptPubKey: '5220a7519a054ca00aed005d6da41a93213a023a681ad89b54f359e40f35f3fcfe98'
  },
  {
    address: 'tnq1rwentz4njukcn400flwk5tu6s8fmzwd3e408nmkqz6dvfysgcdp2suqptef',
    type: 'ecdsa',
    witnessVersion: 3,
    network: 'xna-test',
    scriptPubKey: '53207666b15672e5b13abde9fbad45f3503a76273639abcf3dd802d3589241186855'
  }
] as const;

// Base58 addresses whose lowercase form starts like a Bech32m prefix. The
// 0.8.x prefix check routed them to the Bech32m decoder and threw.
const BASE58_LOOKALIKES = [
  { address: 'NQ1EZZUfHwE4ntRyqW5LAFCcDZjLKxvGyH', network: 'xna-legacy' },
  { address: 'tNc1F3aqhmGhKipLWa9U4tuoLh9yyP1ZXP', network: 'xna-legacy-test' },
  { address: 'tPQ1qEtyZ2dB4MJ5G5WJsKgeGLe6qtmsa2', network: 'xna-legacy-test' }
] as const;

function reencode(address: string, hrp: string, version?: number): string {
  const { words } = bech32m.decode(address);
  return bech32m.encode(hrp, version === undefined ? words : [version, ...words.slice(1)]);
}

const LEGACY_HD_OBJECT = getAddressByPath('xna-legacy-test', getHDKey('xna-legacy-test', MNEMONIC), 'm/0/0');
const NOAUTH_OBJECT = getNoAuthAddress('xna-authscript-test', { witnessScript: '51' });

describe('address', () => {
  it('decodes legacy testnet addresses', () => {
    const decoded = decodeAddress(LEGACY_TEST);
    expect(decoded.type).toBe('p2pkh');
    expect(decoded.network).toBe('xna-legacy-test');
    if (decoded.type !== 'p2pkh') throw new Error('unreachable');
    expect(bytesToHex(decoded.hash)).toBe('e295c733ad2c8e92954d547603f9f63d99eae6c4');
    expect(isWitnessDestination(decoded)).toBe(false);
  });

  it('decodes generic AuthScript v1 testnet addresses', () => {
    const decoded = decodeAddress(AUTHSCRIPT_TEST);
    expect(decoded.type).toBe('authscript');
    expect(decoded.network).toBe('xna-authscript-test');
    if (decoded.type === 'p2pkh') throw new Error('unreachable');
    expect(decoded.witnessVersion).toBe(1);
    expect(bytesToHex(decoded.commitment)).toBe(AUTHSCRIPT_COMMITMENT);
    expect(isWitnessDestination(decoded)).toBe(true);
  });

  it.each(NODE_VECTORS)('matches the node for $type ($address)', (vector) => {
    const decoded = decodeAddress(vector.address);
    expect(decoded.type).toBe(vector.type);
    expect(decoded.network).toBe(vector.network);
    if (decoded.type === 'p2pkh') throw new Error('unreachable');
    expect(decoded.witnessVersion).toBe(vector.witnessVersion);
    expect(bytesToHex(encodeDestinationScript(vector.address))).toBe(vector.scriptPubKey);
    expect(bytesToHex(encodeAuthScriptDestinationScript(vector.address))).toBe(vector.scriptPubKey);
    expect(bytesToHex(encodeNullAssetDestinationScript(vector.address))).toBe(`c0${vector.scriptPubKey}`);
    expect(classifyScriptPubKey(vector.scriptPubKey)).toMatchObject({
      type: vector.type,
      witnessVersion: vector.witnessVersion,
      hasSuffix: false
    });
    expect(bytesToHex(classifyScriptPubKey(vector.scriptPubKey).program!)).toBe(vector.scriptPubKey.slice(4));
  });

  it('decodes the mainnet prefix of every family', () => {
    const [v1, v2, v3] = NODE_VECTORS;
    expect(decodeAddress(reencode(v1.address, 'nc')).network).toBe('xna-authscript');
    expect(decodeAddress(reencode(v2.address, 'pq')).network).toBe('xna-pq');
    expect(decodeAddress(reencode(v3.address, 'nq')).network).toBe('xna');
    expect(inferNetworkFromAddress(reencode(v3.address, 'nq'))).toBe('xna');
    // Upper case is valid Bech32m.
    const upper = reencode(v2.address, 'pq').toUpperCase();
    expect(decodeAddress(upper).type).toBe('pq');
  });

  it('agrees with neurai-key 5 for every address type', () => {
    const ecdsa = getAddressByPath('xna-test', getHDKey('xna-test', MNEMONIC), "m/84'/1'/0'/0/0");
    const pq = getPQAddress('xna-pq-test', MNEMONIC, 0, 0);
    const pqAuthScript = getPQAuthScriptAddress('xna-authscript-test', MNEMONIC, 0, 0);
    const cases = [
      { object: ecdsa, type: 'ecdsa', opcode: '53' },
      { object: pq, type: 'pq', opcode: '52' },
      { object: pqAuthScript, type: 'authscript', opcode: '51' },
      { object: NOAUTH_OBJECT, type: 'authscript', opcode: '51' }
    ];
    for (const { object, type, opcode } of cases) {
      const decoded = decodeAddress(object);
      expect(decoded.type).toBe(type);
      expect(bytesToHex(encodeDestinationScript(object))).toBe(`${opcode}20${object.commitment}`);
    }
    expect(decodeAddress(LEGACY_HD_OBJECT).type).toBe('p2pkh');
  });

  it('rejects HRP / witness version pairs the node rejects', () => {
    const [v1, v2, v3] = NODE_VECTORS;
    // Old encoding of generic AuthScript v1: tnq + v1.
    expect(() => decodeAddress(OLD_AUTHSCRIPT_TEST)).toThrow(/only encodes witness v3.*tnc1p/s);
    expect(() => decodeAddress(reencode(v1.address, 'nq'))).toThrow(/only encodes witness v3/);
    expect(() => decodeAddress(reencode(v2.address, 'tnq'))).toThrow(/only encodes witness v3, not v2/);
    expect(() => decodeAddress(reencode(v3.address, 'tpq'))).toThrow(/only encodes witness v2, not v3/);
    expect(() => decodeAddress(reencode(v3.address, 'tnc'))).toThrow(/only encodes witness v1, not v3/);
    expect(() => decodeAddress(reencode(v2.address, 'tpq', 4))).toThrow(/only encodes witness v2, not v4/);
    // Unknown HRP.
    expect(() => decodeAddress(reencode(v2.address, 'bc'))).toThrow(/Unsupported Bech32m prefix/);
    // Program length other than 32.
    const short = bech32m.encode('tpq', [2, ...bech32m.toWords(new Uint8Array(20))]);
    expect(() => decodeAddress(short)).toThrow(/program length 20/);
    // Bad checksum on a known prefix.
    const broken = v2.address.slice(0, -1) + (v2.address.endsWith('q') ? 'p' : 'q');
    expect(() => decodeAddress(broken)).toThrow(/Invalid Bech32m address/);
  });

  it.each(BASE58_LOOKALIKES)('decodes Base58 look-alike $address', ({ address, network }) => {
    const decoded = decodeAddress(address);
    expect(decoded.type).toBe('p2pkh');
    expect(decoded.network).toBe(network);
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
    expect(() => encodeP2PKHScript(AUTHSCRIPT_TEST)).toThrow(/not legacy P2PKH/);
    expect(() => encodeAuthScriptDestinationScript(LEGACY_TEST)).toThrow(/not an AuthScript/);
  });

  it('encodes witness program scripts for versions 1 to 3 only', () => {
    expect(bytesToHex(encodeWitnessProgramScript(1, AUTHSCRIPT_COMMITMENT))).toBe(`5120${AUTHSCRIPT_COMMITMENT}`);
    expect(bytesToHex(encodeWitnessProgramScript(2, AUTHSCRIPT_COMMITMENT))).toBe(`5220${AUTHSCRIPT_COMMITMENT}`);
    expect(bytesToHex(encodeWitnessProgramScript(3, AUTHSCRIPT_COMMITMENT))).toBe(`5320${AUTHSCRIPT_COMMITMENT}`);
    expect(() => encodeWitnessProgramScript(4 as never, AUTHSCRIPT_COMMITMENT)).toThrow(/witness version/);
    expect(() => encodeWitnessProgramScript(2, 'aa')).toThrow(/32 bytes/);
  });

  it('classifies scriptPubKeys by destination prefix', () => {
    expect(classifyScriptPubKey('76a914e295c733ad2c8e92954d547603f9f63d99eae6c488ac')).toMatchObject({
      type: 'p2pkh',
      hasSuffix: false
    });
    // Asset wrapper after the prefix.
    expect(classifyScriptPubKey(`5320${AUTHSCRIPT_COMMITMENT}c00a72766e74054142434445`)).toMatchObject({
      type: 'ecdsa',
      witnessVersion: 3,
      hasSuffix: true
    });
    expect(classifyScriptPubKey(`5420${AUTHSCRIPT_COMMITMENT}`).type).toBe('unknown');
    expect(classifyScriptPubKey('a914e295c733ad2c8e92954d547603f9f63d99eae6c487').type).toBe('unknown');
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
