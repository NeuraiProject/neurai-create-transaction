declare module 'bs58check' {
  const bs58check: {
    encode(data: Uint8Array): string;
    decode(text: string): Uint8Array;
  };

  export default bs58check;
}

declare module 'bs58' {
  const bs58: {
    encode(data: Uint8Array): string;
    decode(text: string): Uint8Array;
  };

  export default bs58;
}
