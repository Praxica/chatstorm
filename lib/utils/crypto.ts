import crypto from 'crypto';

// Check if we're running on the server side
const isServer = typeof window === 'undefined';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Helper function to get the encryption key and validate it
function getEncryptionKey(): Buffer {
  const ENCRYPTION_KEY = process.env.CUSTOM_MODEL_ENCRYPTION_KEY;
  
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('CUSTOM_MODEL_ENCRYPTION_KEY environment variable must be set and be 32 characters long.');
  }
  
  return Buffer.from(ENCRYPTION_KEY);
}

export function encrypt(text: string): string {
  if (!isServer) {
    throw new Error('Encryption can only be performed on the server side');
  }
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  if (!isServer) {
    throw new Error('Decryption can only be performed on the server side');
  }
  
  const key = getEncryptionKey();
  
  try {
    const textParts = text.split(':');
    const ivHex = textParts.shift();
    if (!ivHex) {
      throw new Error('Invalid encrypted text format: IV is missing.');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("Decryption failed:", error);
    // Depending on the use case, you might want to throw the error,
    // return a specific error message, or return an empty string.
    // For API keys, failing loudly is often better.
    throw new Error('Failed to decrypt data.');
  }
} 