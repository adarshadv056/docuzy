/**
 * Pure In-House Native AES-256 PDF Decryption / Unlock Engine (ISO 32000-2:2020)
 *
 * Implements:
 *   - Auto-detection of encryption (Open password vs Permissions restriction only)
 *   - Password verification & key recovery via Algorithm 2.B
 *   - AES-256-CBC stream & object decryption
 *   - Stripping of /Encrypt dictionary from PDF trailer
 *   - 100% In-house using native Web Crypto API (`crypto.subtle`) + existing `pdf-lib` primitives
 *   - Zero external npm packages
 */

import {
  PDFDocument,
  PDFName,
  PDFHexString,
  PDFString,
  PDFDict,
  PDFArray,
  PDFRawStream,
} from 'pdf-lib';
import { computeHash2B, encodePasswordAES256 } from './encrypt-native';

// ========== Custom Error Classes ==========

export class IncorrectPasswordError extends Error {
  code = 'INCORRECT_PASSWORD';
  constructor(message = 'Incorrect password. Please verify and try again.') {
    super(message);
    this.name = 'IncorrectPasswordError';
  }
}

export class NotEncryptedError extends Error {
  code = 'NOT_ENCRYPTED';
  constructor(message = 'This PDF is not password-protected or restricted.') {
    super(message);
    this.name = 'NotEncryptedError';
  }
}

export class UnsupportedEncryptionError extends Error {
  code = 'UNSUPPORTED_ENCRYPTION';
  constructor(message = 'Unsupported PDF encryption method.') {
    super(message);
    this.name = 'UnsupportedEncryptionError';
  }
}

// ========== Web Crypto Decryption Helpers ==========

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function getObjectBytes(obj: any): Uint8Array {
  if (!obj) return new Uint8Array(0);
  if (obj instanceof PDFHexString) {
    return hexToBytes(obj.asString());
  }
  if (typeof obj.asBytes === 'function') {
    return obj.asBytes();
  }
  if (typeof obj.asString === 'function') {
    return hexToBytes(obj.asString());
  }
  return new Uint8Array(0);
}

/**
 * Decrypt 32-byte block-aligned unpadded AES-256-CBC ciphertext (UE / OE)
 * using Web Crypto with synthetic PKCS#7 padding block extension.
 */
async function aes256CbcDecryptNoPad(
  ciphertext32: Uint8Array,
  key32: Uint8Array
): Promise<Uint8Array> {
  const zeroIV = new Uint8Array(16);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key32 as BufferSource,
    'AES-CBC',
    false,
    ['encrypt', 'decrypt']
  );

  // C1 is the second 16-byte block of ciphertext32
  const C1 = ciphertext32.slice(16, 32);
  const P2 = new Uint8Array(16).fill(16); // 16 bytes of 0x10
  const X = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    X[i] = P2[i] ^ C1[i];
  }

  // Encrypt X with IV=0 to generate C2
  const encX = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: zeroIV as BufferSource },
    cryptoKey,
    X as BufferSource
  );
  const C2 = new Uint8Array(encX).slice(0, 16);

  // Synthesize 48-byte ciphertext = [ciphertext32 (32 bytes), C2 (16 bytes)]
  const ciphertext48 = new Uint8Array(48);
  ciphertext48.set(ciphertext32, 0);
  ciphertext48.set(C2, 32);

  // Decrypt with Web Crypto (automatically verifies and strips the synthetic 16-byte padding)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: zeroIV as BufferSource },
    cryptoKey,
    ciphertext48 as BufferSource
  );

  return new Uint8Array(decrypted);
}

async function decryptObjectAES256(
  data: Uint8Array,
  cryptoKey: CryptoKey
): Promise<Uint8Array> {
  if (data.length < 16) return data;
  const iv = data.slice(0, 16);
  const ciphertext = data.slice(16);
  if (ciphertext.length === 0) return new Uint8Array(0);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv as BufferSource },
      cryptoKey,
      ciphertext as BufferSource
    );
    return new Uint8Array(decrypted);
  } catch {
    // If decryption fails (e.g. malformed or already unencrypted stream), return original
    return data;
  }
}

function bytesToPDFStringValue(bytes: Uint8Array): string {
  const out = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x5c) out[i] = '\\\\';
    else if (b === 0x28) out[i] = '\\(';
    else if (b === 0x29) out[i] = '\\)';
    else if (b === 0x0d) out[i] = '\\r';
    else if (b === 0x0a) out[i] = '\\n';
    else out[i] = String.fromCharCode(b);
  }
  return out.join('');
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function isSignatureDict(dict: PDFDict): boolean {
  const type = dict.get(PDFName.of('Type'));
  const typeName = type && typeof (type as any).asString === 'function' ? (type as any).asString() : null;
  if (typeName === '/Sig' || typeName === '/DocTimeStamp') return true;

  if (typeName !== null) return false;
  const byteRange = dict.get(PDFName.of('ByteRange'));
  return byteRange instanceof PDFArray && byteRange.size() === 4 && dict.has(PDFName.of('Contents'));
}

function skipKey(keyName: string, isSigDict: boolean): boolean {
  if (keyName === '/Length' || keyName === '/Filter' || keyName === '/DecodeParms') return true;
  return isSigDict && keyName === '/Contents';
}

async function decryptStringsAES256(
  obj: any,
  cryptoKey: CryptoKey,
  seen: WeakSet<object>
): Promise<void> {
  if (!obj || (typeof obj === 'object' && seen.has(obj))) return;

  if (obj instanceof PDFString) {
    seen.add(obj);
    const originalBytes = obj.asBytes();
    if (originalBytes.length >= 16) {
      const decrypted = await decryptObjectAES256(originalBytes, cryptoKey);
      (obj as any).value = bytesToPDFStringValue(decrypted);
    }
  } else if (obj instanceof PDFHexString) {
    seen.add(obj);
    const originalBytes = hexToBytes(obj.asString());
    if (originalBytes.length >= 16) {
      const decrypted = await decryptObjectAES256(originalBytes, cryptoKey);
      (obj as any).value = bytesToHex(decrypted);
    }
  } else if (obj instanceof PDFDict) {
    seen.add(obj);
    const isSig = isSignatureDict(obj);
    for (const [key, value] of obj.entries()) {
      if (!skipKey(key.asString(), isSig)) {
        await decryptStringsAES256(value, cryptoKey, seen);
      }
    }
  } else if (obj instanceof PDFArray) {
    seen.add(obj);
    for (const element of obj.asArray()) {
      await decryptStringsAES256(element, cryptoKey, seen);
    }
  }
}

// ========== PDF Encryption Inspector ==========

export interface EncryptionInspection {
  isEncrypted: boolean;
  requiresPassword: boolean;
  algorithm?: string;
  permissionsRestricted?: boolean;
}

/**
 * Inspect a PDF to detect whether it is encrypted, and whether it requires an open password
 * or only has owner permissions restrictions.
 */
export async function inspectPDFEncryption(pdfBytes: Uint8Array): Promise<EncryptionInspection> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    const context = pdfDoc.context;
    const trailer = context.trailerInfo;
    const encryptRef = trailer.Encrypt;

    if (!encryptRef) {
      return { isEncrypted: false, requiresPassword: false };
    }

    const encryptDict = context.lookup(encryptRef) as PDFDict;
    if (!encryptDict) {
      return { isEncrypted: false, requiresPassword: false };
    }

    const V = encryptDict.get(PDFName.of('V'))?.toString() || '';
    const R = encryptDict.get(PDFName.of('R'))?.toString() || '';

    // Check if empty password "" unlocks the file
    let emptyPassMatches = false;
    const UObj = encryptDict.get(PDFName.of('U'));
    if (UObj) {
      const U = getObjectBytes(UObj);
      if (U.length >= 48) {
        const valSalt = U.slice(32, 40);
        const hash = await computeHash2B(encodePasswordAES256(''), valSalt, new Uint8Array(0));
        emptyPassMatches = hash.every((b, i) => b === U[i]);
      }
    }

    return {
      isEncrypted: true,
      requiresPassword: !emptyPassMatches,
      algorithm: V.includes('5') && R.includes('6') ? 'AES-256' : 'Standard',
      permissionsRestricted: emptyPassMatches,
    };
  } catch {
    return { isEncrypted: false, requiresPassword: false };
  }
}

// ========== Main Public API ==========

/**
 * Decrypt and remove password protection from an encrypted PDF.
 *
 * @param pdfBytes - Raw encrypted PDF bytes
 * @param password - Document password (optional if only permissions-restricted)
 * @returns Clean, unencrypted PDF as Uint8Array
 */
export async function unlockPDF(
  pdfBytes: Uint8Array,
  password = ''
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const context = pdfDoc.context;
  const trailer = context.trailerInfo;
  const encryptRef = trailer.Encrypt;

  if (!encryptRef) {
    throw new NotEncryptedError();
  }

  const encryptDict = context.lookup(encryptRef) as PDFDict;
  if (!encryptDict) {
    throw new NotEncryptedError();
  }

  // Extract encryption parameters
  const UObj = encryptDict.get(PDFName.of('U'));
  const UEObj = encryptDict.get(PDFName.of('UE'));
  const OObj = encryptDict.get(PDFName.of('O'));
  const OEObj = encryptDict.get(PDFName.of('OE'));

  if (!UObj || !UEObj) {
    throw new UnsupportedEncryptionError('Missing required encryption vectors (U/UE).');
  }

  const U = getObjectBytes(UObj);
  const UE = getObjectBytes(UEObj);
  const O = OObj ? getObjectBytes(OObj) : new Uint8Array(0);
  const OE = OEObj ? getObjectBytes(OEObj) : new Uint8Array(0);

  if (U.length < 48 || UE.length < 32) {
    throw new UnsupportedEncryptionError('Invalid encryption dictionary vector lengths.');
  }

  // Authenticate password
  const testPassword = password.trim();
  let fileKey: Uint8Array | null = null;

  // 1. Check User Password
  const userPwdBytes = encodePasswordAES256(testPassword);
  const userValSalt = U.slice(32, 40);
  const userKeySalt = U.slice(40, 48);
  const userHash = await computeHash2B(userPwdBytes, userValSalt, new Uint8Array(0));

  const isUserValid = userHash.every((b, i) => b === U[i]);

  if (isUserValid) {
    const ueKey = await computeHash2B(userPwdBytes, userKeySalt, new Uint8Array(0));
    fileKey = await aes256CbcDecryptNoPad(UE.slice(0, 32), ueKey);
  } else if (O.length >= 48 && OE.length >= 32) {
    // 2. Check Owner Password
    const ownerPwdBytes = encodePasswordAES256(testPassword);
    const ownerValSalt = O.slice(32, 40);
    const ownerKeySalt = O.slice(40, 48);
    const ownerHash = await computeHash2B(ownerPwdBytes, ownerValSalt, U.slice(0, 48));

    const isOwnerValid = ownerHash.every((b, i) => b === O[i]);
    if (isOwnerValid) {
      const oeKey = await computeHash2B(ownerPwdBytes, ownerKeySalt, U.slice(0, 48));
      fileKey = await aes256CbcDecryptNoPad(OE.slice(0, 32), oeKey);
    }
  }

  if (!fileKey) {
    throw new IncorrectPasswordError();
  }

  // Import file encryption key for AES-CBC decryption
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    fileKey as BufferSource,
    'AES-CBC',
    false,
    ['decrypt']
  );

  // Traverse indirect objects and decrypt all streams and strings
  const indirectObjects = context.enumerateIndirectObjects();
  const seen = new WeakSet<object>();

  for (const [ref, obj] of indirectObjects) {
    // Skip encryption dictionary itself
    if (obj instanceof PDFDict) {
      const filter = obj.get(PDFName.of('Filter'));
      if (filter && (filter as any).asString?.() === '/Standard') continue;
    }

    // Skip XRef and Sig streams
    if (obj instanceof PDFRawStream && obj.dict) {
      const type = obj.dict.get(PDFName.of('Type'));
      if (type) {
        const typeName = type.toString();
        if (typeName === '/XRef' || typeName === '/Sig') continue;
      }
    }

    if (obj instanceof PDFRawStream) {
      const streamData = obj.contents;
      const decrypted = await decryptObjectAES256(streamData, cryptoKey);
      (obj as any).contents = decrypted;

      if (obj.dict) {
        await decryptStringsAES256(obj.dict, cryptoKey, seen);
      }
    } else {
      await decryptStringsAES256(obj, cryptoKey, seen);
    }
  }

  // Strip /Encrypt from trailer
  delete (trailer as any).Encrypt;
  (context.trailerInfo as any).Encrypt = undefined;

  // Save the permanently unlocked PDF
  const unlockedBytes = await pdfDoc.save({
    useObjectStreams: false,
    updateFieldAppearances: false,
  });

  return unlockedBytes;
}
