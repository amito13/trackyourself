import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';

// Browsers provide WebCrypto; native Supabase PKCE needs these two methods.
if (Platform.OS !== 'web') {
  const crypto =
    globalThis.crypto ??
    Object.defineProperty(globalThis, 'crypto', {
      value: {},
      configurable: true,
    }).crypto;

  if (!crypto.getRandomValues) {
    Object.defineProperty(crypto, 'getRandomValues', {
      value: ExpoCrypto.getRandomValues,
      configurable: true,
    });
  }

  if (!crypto.subtle?.digest) {
    const subtle = crypto.subtle ?? {};
    Object.defineProperty(subtle, 'digest', {
      async value(algorithm: string | { name: string }, data: BufferSource) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        if (name.toUpperCase() !== 'SHA-256') {
          throw new Error(`Unsupported digest algorithm: ${name}`);
        }
        return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
      },
      configurable: true,
    });
    Object.defineProperty(crypto, 'subtle', { value: subtle, configurable: true });
  }
}
