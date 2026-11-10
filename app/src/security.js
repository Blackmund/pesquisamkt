// End-to-end security & cryptographic authentication module
// Utilizes native Web Crypto API (PBKDF2 SHA-256 for password hashing & AES-GCM 256-bit for data encryption)

const enc = new TextEncoder();
const dec = new TextDecoder();

// Helper to convert ArrayBuffer/Uint8Array to hex
export function bufToHex(buf) {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// Helper to convert hex string to Uint8Array
export function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Generate cryptographically secure random token (256-bit)
export function generateSecureToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bufToHex(bytes);
}

// Derive PBKDF2 Hash with SHA-256 and 100,000 iterations
export async function hashPassword(password, salt) {
  const subtle = globalThis.crypto.subtle;
  const saltBuf = typeof salt === 'string' ? enc.encode(salt) : salt;
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bufToHex(derivedBits);
}

// Timing-safe comparison to prevent timing attacks
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// AES-GCM 256-bit Encryption
export async function encryptData(plainText, secretKey) {
  const subtle = globalThis.crypto.subtle;
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  // Derive AES key from secretKey via SHA-256
  const keyHash = await subtle.digest('SHA-256', enc.encode(secretKey));
  const cryptoKey = await subtle.importKey(
    'raw',
    keyHash,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    enc.encode(plainText)
  );

  return {
    alg: 'AES-GCM-256',
    iv: bufToHex(iv),
    data: bufToHex(cipherBuffer),
    timestamp: Date.now(),
  };
}

// AES-GCM 256-bit Decryption
export async function decryptData(cipherPackage, secretKey) {
  const subtle = globalThis.crypto.subtle;
  const iv = hexToBuf(cipherPackage.iv);
  const cipherBuffer = hexToBuf(cipherPackage.data);

  const keyHash = await subtle.digest('SHA-256', enc.encode(secretKey));
  const cryptoKey = await subtle.importKey(
    'raw',
    keyHash,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    cipherBuffer
  );

  return dec.decode(decrypted);
}

// Pre-configured system users with cryptographically pre-hashed credentials
export const PRESET_USERS = {
  'comunicacao.pasa@vale.com': {
    email: 'comunicacao.pasa@vale.com',
    name: 'Comunicação PASA',
    company: 'Vale',
    role: 'Administrador',
    salt: 'pasa_vale_salt_2026',
    hash: '5ff8d468b1e1d1cd34d1ea676913c7c27e631997b30b4caa0aa058a8fb4dd942',
    avatar: '',
  },
};

// Parse JWT Token (Google OAuth / Google Identity Services)
export function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse JWT token', e);
    return null;
  }
}
