// AES-256-GCM encryption for sensitive account details
// WALLET_ENCRYPTION_KEY must be 32-byte hex in env

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

async function getKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('WALLET_ENCRYPTION_KEY');
  if (!keyHex) throw new Error('WALLET_ENCRYPTION_KEY not set');
  const keyBytes = hexToBytes(keyHex);
  return crypto.subtle.importKey('raw', keyBytes, ALGORITHM, false, ['encrypt', 'decrypt']);
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64(result);
}

export async function decrypt(encryptedBase64: string): Promise<string> {
  const key = await getKey();
  const data = base64ToBytes(encryptedBase64);
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}
