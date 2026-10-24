/**
 * Pure In-House Native AES-256 PDF Encryption Engine (ISO 32000-2:2020 / V=5, R=6)
 *
 * Implements:
 *   - AES-256 (V=5, R=6) per ISO 32000-2:2020 — Algorithms 2.B, 8, 9, 10
 *   - Password normalization via SASLprep (RFC 4013 & RFC 3454)
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
  PDFNumber,
} from 'pdf-lib';

// ========== Types & Interfaces ==========

export interface EncryptOptions {
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowModifying?: boolean;
  allowCopying?: boolean;
  allowAnnotating?: boolean;
  allowFillingForms?: boolean;
  allowExtraction?: boolean;
  allowAssembly?: boolean;
  allowHighQualityPrint?: boolean;
}

export class AlreadyEncryptedError extends Error {
  code = 'ALREADY_ENCRYPTED';
  constructor() {
    super(
      'This PDF is already password-protected. Remove existing protection before applying new encryption.'
    );
    this.name = 'AlreadyEncryptedError';
  }
}

export class PasswordEncodingError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'PasswordEncodingError';
    this.code = code;
  }
}

// ========== Permission Flags (ISO 32000-2 Table 22) ==========

const PERM_FLAGS = {
  PRINT: 0x00000004, // Bit 3
  MODIFY: 0x00000008, // Bit 4
  COPY: 0x00000010, // Bit 5
  ANNOTATE: 0x00000020, // Bit 6
  FILL_FORMS: 0x00000100, // Bit 9
  EXTRACT: 0x00000200, // Bit 10
  ASSEMBLE: 0x00000400, // Bit 11
  PRINT_HIGH_QUALITY: 0x00000800, // Bit 12
};

function buildPermissions(options: EncryptOptions): number {
  let P = 0xfffff000 | 0x000000c0; // bits 13-32 + bits 7-8 required

  if (options.allowPrinting !== false) P |= PERM_FLAGS.PRINT;
  if (options.allowModifying !== false) P |= PERM_FLAGS.MODIFY;
  if (options.allowCopying !== false) P |= PERM_FLAGS.COPY;
  if (options.allowAnnotating !== false) P |= PERM_FLAGS.ANNOTATE;
  if (options.allowFillingForms !== false) P |= PERM_FLAGS.FILL_FORMS;
  if (options.allowExtraction !== false) P |= PERM_FLAGS.EXTRACT;
  if (options.allowAssembly !== false) P |= PERM_FLAGS.ASSEMBLE;
  if (options.allowHighQualityPrint !== false) P |= PERM_FLAGS.PRINT_HIGH_QUALITY;

  return P | 0;
}

// ========== Web Crypto Utilities ==========

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return new Uint8Array(hash);
}

async function sha384(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-384', data as BufferSource);
  return new Uint8Array(hash);
}

async function sha512(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-512', data as BufferSource);
  return new Uint8Array(hash);
}

async function aes128CbcEncrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-CBC', false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, cryptoKey, data as BufferSource);
  return new Uint8Array(encrypted).slice(0, data.byteLength);
}

async function aes256CbcEncryptNoPad(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-CBC', false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, cryptoKey, data as BufferSource);
  return new Uint8Array(encrypted).slice(0, data.byteLength);
}

async function aes256EcbEncryptBlock(block: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const iv = new Uint8Array(16);
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-CBC', false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, cryptoKey, block as BufferSource);
  return new Uint8Array(encrypted).slice(0, 16);
}

async function importAES256Key(key: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey('raw', key as BufferSource, 'AES-CBC', false, ['encrypt']);
}

async function aes256CbcEncryptWithKey(data: Uint8Array, cryptoKey: CryptoKey, iv: Uint8Array): Promise<Uint8Array> {
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, cryptoKey, data as BufferSource);
  return new Uint8Array(encrypted);
}

// ========== SASLprep & Password Normalization (RFC 4013 & RFC 3454) ==========

function inRanges(cp: number, ranges: number[]): boolean {
  let lo = 0;
  let hi = ranges.length / 2 - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = ranges[mid * 2];
    const end = ranges[mid * 2 + 1];
    if (cp < start) hi = mid - 1;
    else if (cp > end) lo = mid + 1;
    else return true;
  }
  return false;
}

const NON_ASCII_SPACE = [
  0x00a0, 0x00a0, 0x1680, 0x1680, 0x2000, 0x200b,
  0x202f, 0x202f, 0x205f, 0x205f, 0x3000, 0x3000,
];

const MAP_TO_NOTHING = [
  0x00ad, 0x00ad, 0x034f, 0x034f, 0x1806, 0x1806, 0x180b, 0x180d,
  0x200b, 0x200d, 0x2060, 0x2060, 0xfe00, 0xfe0f, 0xfeff, 0xfeff,
];

const PROHIBITED = [
  0x0000, 0x001f, 0x007f, 0x009f, 0x0340, 0x0341, 0x06dd, 0x06dd,
  0x070f, 0x070f, 0x180e, 0x180e, 0x200c, 0x200f, 0x2028, 0x202e,
  0x2060, 0x2063, 0x206a, 0x206f, 0x2ff0, 0x2ffb, 0xd800, 0xdfff,
  0xe000, 0xf8ff, 0xfdd0, 0xfdef, 0xfeff, 0xfeff, 0xfff9, 0xffff,
  0x1d173, 0x1d17a, 0x1fffe, 0x1ffff, 0x2fffe, 0x2ffff, 0x3fffe, 0x3ffff,
  0x4fffe, 0x4ffff, 0x5fffe, 0x5ffff, 0x6fffe, 0x6ffff, 0x7fffe, 0x7ffff,
  0x8fffe, 0x8ffff, 0x9fffe, 0x9ffff, 0xafffe, 0xaffff, 0xbfffe, 0xbffff,
  0xcfffe, 0xcffff, 0xdfffe, 0xdffff, 0xe0001, 0xe0001, 0xe0020, 0xe007f,
  0xefffe, 0xeffff, 0xf0000, 0xffffd, 0xffffe, 0xfffff, 0x100000, 0x10fffd,
  0x10fffe, 0x10ffff,
];

const RANDALCAT = [
  0x5be, 0x5be, 0x5c0, 0x5c0, 0x5c3, 0x5c3, 0x5d0, 0x5ea, 0x5f0, 0x5f4, 0x61b, 0x61b, 0x61f,
  0x61f, 0x621, 0x63a, 0x640, 0x64a, 0x66d, 0x66f, 0x671, 0x6d5, 0x6dd, 0x6dd, 0x6e5, 0x6e6,
  0x6fa, 0x6fe, 0x700, 0x70d, 0x710, 0x710, 0x712, 0x72c, 0x780, 0x7a5, 0x7b1, 0x7b1, 0x200f,
  0x200f, 0xfb1d, 0xfb1d, 0xfb1f, 0xfb28, 0xfb2a, 0xfb36, 0xfb38, 0xfb3c, 0xfb3e, 0xfb3e,
  0xfb40, 0xfb41, 0xfb43, 0xfb44, 0xfb46, 0xfbb1, 0xfbd3, 0xfd3d, 0xfd50, 0xfd8f, 0xfd92,
  0xfdc7, 0xfdf0, 0xfdfc, 0xfe70, 0xfe74, 0xfe76, 0xfefc,
];

const LCAT = [
  0x41, 0x5a, 0x61, 0x7a, 0xaa, 0xaa, 0xb5, 0xb5, 0xba, 0xba, 0xc0, 0xd6, 0xd8, 0xf6, 0xf8,
  0x220, 0x222, 0x233, 0x250, 0x2ad, 0x2b0, 0x2b8, 0x2bb, 0x2c1, 0x2d0, 0x2d1, 0x2e0, 0x2e4,
  0x2ee, 0x2ee, 0x37a, 0x37a, 0x386, 0x386, 0x388, 0x38a, 0x38c, 0x38c, 0x38e, 0x3a1, 0x3a3,
  0x3ce, 0x3d0, 0x3f5, 0x400, 0x482, 0x48a, 0x4ce, 0x4d0, 0x4f5, 0x4f8, 0x4f9, 0x500, 0x50f,
  0x531, 0x556, 0x559, 0x55f, 0x561, 0x587, 0x589, 0x589, 0x903, 0x903, 0x905, 0x939, 0x93d,
  0x940, 0x949, 0x94c, 0x950, 0x950, 0x958, 0x961, 0x964, 0x970, 0x982, 0x983, 0x985, 0x98c,
  0x98f, 0x990, 0x993, 0x9a8, 0x9aa, 0x9b0, 0x9b2, 0x9b2, 0x9b6, 0x9b9, 0x9be, 0x9c0, 0x9c7,
  0x9c8, 0x9cb, 0x9cc, 0x9d7, 0x9d7, 0x9dc, 0x9dd, 0x9df, 0x9e1, 0x9e6, 0x9f1, 0x9f4, 0x9fa,
  0xa05, 0xa0a, 0xa0f, 0xa10, 0xa13, 0xa28, 0xa2a, 0xa30, 0xa32, 0xa33, 0xa35, 0xa36, 0xa38,
  0xa39, 0xa3e, 0xa40, 0xa59, 0xa5c, 0xa5e, 0xa5e, 0xa66, 0xa6f, 0xa72, 0xa74, 0xa83, 0xa83,
  0xa85, 0xa8b, 0xa8d, 0xa8d, 0xa8f, 0xa91, 0xa93, 0xaa8, 0xaaa, 0xab0, 0xab2, 0xab3, 0xab5,
  0xab9, 0xabd, 0xac0, 0xac9, 0xac9, 0xacb, 0xacc, 0xad0, 0xad0, 0xae0, 0xae0, 0xae6, 0xaef,
  0xb02, 0xb03, 0xb05, 0xb0c, 0xb0f, 0xb10, 0xb13, 0xb28, 0xb2a, 0xb30, 0xb32, 0xb33, 0xb36,
  0xb39, 0xb3d, 0xb3e, 0xb40, 0xb40, 0xb47, 0xb48, 0xb4b, 0xb4c, 0xb57, 0xb57, 0xb5c, 0xb5d,
  0xb5f, 0xb61, 0xb66, 0xb70, 0xb83, 0xb83, 0xb85, 0xb8a, 0xb8e, 0xb90, 0xb92, 0xb95, 0xb99,
  0xb9a, 0xb9c, 0xb9c, 0xb9e, 0xb9f, 0xba3, 0xba4, 0xba8, 0xbaa, 0xbae, 0xbb5, 0xbb7, 0xbb9,
  0xbbe, 0xbbf, 0xbc1, 0xbc2, 0xbc6, 0xbc8, 0xbca, 0xbcc, 0xbd7, 0xbd7, 0xbe7, 0xbf2, 0xc01,
  0xc03, 0xc05, 0xc0c, 0xc0e, 0xc10, 0xc12, 0xc28, 0xc2a, 0xc33, 0xc35, 0xc39, 0xc41, 0xc44,
  0xc60, 0xc61, 0xc66, 0xc6f, 0xc82, 0xc83, 0xc85, 0xc8c, 0xc8e, 0xc90, 0xc92, 0xca8, 0xcaa,
  0xcb3, 0xcb5, 0xcb9, 0xcbe, 0xcbe, 0xcc0, 0xcc4, 0xcc7, 0xcc8, 0xcca, 0xccb, 0xcd5, 0xcd6,
  0xcde, 0xcde, 0xce0, 0xce1, 0xce6, 0xcef, 0xd02, 0xd03, 0xd05, 0xd0c, 0xd0e, 0xd10, 0xd12,
  0xd28, 0xd2a, 0xd39, 0xd3e, 0xd40, 0xd46, 0xd48, 0xd4a, 0xd4c, 0xd57, 0xd57, 0xd60, 0xd61,
  0xd66, 0xd6f, 0xd82, 0xd83, 0xd85, 0xd96, 0xd9a, 0xdb1, 0xdb3, 0xdbb, 0xdbd, 0xdbd, 0xdc0,
  0xdc6, 0xdcf, 0xdd1, 0xdd8, 0xddf, 0xdf2, 0xdf4, 0xe01, 0xe30, 0xe32, 0xe33, 0xe40, 0xe46,
  0xe4f, 0xe5b, 0xe81, 0xe82, 0xe84, 0xe84, 0xe87, 0xe88, 0xe8a, 0xe8a, 0xe8d, 0xe8d, 0xe94,
  0xe97, 0xe99, 0xe9f, 0xea1, 0xea3, 0xea5, 0xea5, 0xea7, 0xea7, 0xeaa, 0xeab, 0xead, 0xeb0,
  0xeb2, 0xeb3, 0xebd, 0xebd, 0xec0, 0xec4, 0xec6, 0xec6, 0xed0, 0xed9, 0xedc, 0xedd, 0xf00,
  0xf17, 0xf1a, 0xf34, 0xf36, 0xf36, 0xf38, 0xf38, 0xf3e, 0xf47, 0xf49, 0xf6a, 0xf7f, 0xf7f,
  0xf85, 0xf85, 0xf88, 0xf8b, 0xfbe, 0xfc5, 0xfc7, 0xfcc, 0xfcf, 0xfcf, 0x1000, 0x1021, 0x1023,
  0x1027, 0x1029, 0x102a, 0x102c, 0x102c, 0x1031, 0x1031, 0x1038, 0x1038, 0x1040, 0x1057,
  0x10a0, 0x10c5, 0x10d0, 0x10f8, 0x10fb, 0x10fb, 0x1100, 0x1159, 0x115f, 0x11a2, 0x11a8,
  0x11f9, 0x1200, 0x1206, 0x1208, 0x1246, 0x1248, 0x1248, 0x124a, 0x124d, 0x1250, 0x1256,
  0x1258, 0x1258, 0x125a, 0x125d, 0x1260, 0x1286, 0x1288, 0x1288, 0x128a, 0x128d, 0x1290,
  0x12ae, 0x12b0, 0x12b0, 0x12b2, 0x12b5, 0x12b8, 0x12be, 0x12c0, 0x12c0, 0x12c2, 0x12c5,
  0x12c8, 0x12ce, 0x12d0, 0x12d6, 0x12d8, 0x12ee, 0x12f0, 0x130e, 0x1310, 0x1310, 0x1312,
  0x1315, 0x1318, 0x131e, 0x1320, 0x1346, 0x1348, 0x135a, 0x1361, 0x137c, 0x13a0, 0x13f4,
  0x1401, 0x1676, 0x1681, 0x169a, 0x16a0, 0x16f0, 0x1700, 0x170c, 0x170e, 0x1711, 0x1720,
  0x1731, 0x1735, 0x1736, 0x1740, 0x1751, 0x1760, 0x176c, 0x176e, 0x1770, 0x1780, 0x17b6,
  0x17be, 0x17c5, 0x17c7, 0x17c8, 0x17d4, 0x17da, 0x17dc, 0x17dc, 0x17e0, 0x17e9, 0x1810,
  0x1819, 0x1820, 0x1877, 0x1880, 0x18a8, 0x1e00, 0x1e9b, 0x1ea0, 0x1ef9, 0x1f00, 0x1f15,
  0x1f18, 0x1f1d, 0x1f20, 0x1f45, 0x1f48, 0x1f4d, 0x1f50, 0x1f57, 0x1f59, 0x1f59, 0x1f5b,
  0x1f5b, 0x1f5d, 0x1f5d, 0x1f5f, 0x1f7d, 0x1f80, 0x1fb4, 0x1fb6, 0x1fbc, 0x1fbe, 0x1fbe,
  0x1fc2, 0x1fc4, 0x1fc6, 0x1fcc, 0x1fd0, 0x1fd3, 0x1fd6, 0x1fdb, 0x1fe0, 0x1fec, 0x1ff2,
  0x1ff4, 0x1ff6, 0x1ffc, 0x200e, 0x200e, 0x2071, 0x2071, 0x207f, 0x207f, 0x2102, 0x2102,
  0x2107, 0x2107, 0x210a, 0x2113, 0x2115, 0x2115, 0x2119, 0x211d, 0x2124, 0x2124, 0x2126,
  0x2126, 0x2128, 0x2128, 0x212a, 0x212d, 0x212f, 0x2131, 0x2133, 0x2139, 0x213d, 0x213f,
  0x2145, 0x2149, 0x2160, 0x2183, 0x2336, 0x237a, 0x2395, 0x2395, 0x249c, 0x24e9, 0x3005,
  0x3007, 0x3021, 0x3029, 0x3031, 0x3035, 0x3038, 0x303c, 0x3041, 0x3096, 0x309d, 0x309f,
  0x30a1, 0x30fa, 0x30fc, 0x30ff, 0x3105, 0x312c, 0x3131, 0x318e, 0x3190, 0x31b7, 0x31f0,
  0x321c, 0x3220, 0x3243, 0x3260, 0x327b, 0x327f, 0x32b0, 0x32c0, 0x32cb, 0x32d0, 0x32fe,
];

function checkBidi(str: string): void {
  const chars = Array.from(str);
  if (chars.length === 0) return;

  let hasRandAL = false;
  let hasL = false;
  for (const char of chars) {
    const cp = char.codePointAt(0) || 0;
    if (inRanges(cp, RANDALCAT)) hasRandAL = true;
    else if (inRanges(cp, LCAT)) hasL = true;
  }
  if (!hasRandAL) return;

  const fail = (detail: string) => {
    throw new PasswordEncodingError(
      `This password mixes right-to-left and left-to-right text in a way the PDF standard does not allow (${detail}).`,
      'BIDIRECTIONAL_PASSWORD'
    );
  };

  if (hasL) fail('contains both right-to-left and left-to-right letters');
  const first = chars[0].codePointAt(0) || 0;
  const last = chars[chars.length - 1].codePointAt(0) || 0;
  if (!inRanges(first, RANDALCAT) || !inRanges(last, RANDALCAT)) {
    fail('must begin and end with a right-to-left character');
  }
}

function saslPrep(password: string): string {
  let mapped = '';
  for (const char of password) {
    const cp = char.codePointAt(0) || 0;
    if (inRanges(cp, NON_ASCII_SPACE)) mapped += ' ';
    else if (inRanges(cp, MAP_TO_NOTHING)) continue;
    else mapped += char;
  }

  const normalized = mapped.normalize('NFKC');

  for (const char of normalized) {
    const cp = char.codePointAt(0) || 0;
    if (inRanges(cp, PROHIBITED)) {
      throw new PasswordEncodingError(
        `Password contains an invalid character (${cp.toString(16)}).`,
        'PROHIBITED_PASSWORD_CHARACTER'
      );
    }
  }

  checkBidi(normalized);
  return normalized;
}

export function encodePasswordAES256(password: string): Uint8Array {
  const bytes = new TextEncoder().encode(saslPrep(password));
  return bytes.length > 127 ? bytes.slice(0, 127) : bytes;
}

// ========== Algorithm 2.B (ISO 32000-2:2020) ==========

export async function computeHash2B(
  password: Uint8Array,
  salt: Uint8Array,
  userKey: Uint8Array
): Promise<Uint8Array> {
  const input = concat(password, salt, userKey);
  let K = await sha256(input);

  let i = 0;
  let E: Uint8Array;

  while (true) {
    const block = concat(password, K, userKey);
    const K1 = new Uint8Array(block.length * 64);
    for (let j = 0; j < 64; j++) {
      K1.set(block, j * block.length);
    }

    const aesKey = K.slice(0, 16);
    const aesIV = K.slice(16, 32);
    E = await aes128CbcEncrypt(K1, aesKey, aesIV);

    let byteSum = 0;
    for (let j = 0; j < 16; j++) {
      byteSum += E[j];
    }
    const hashSelect = byteSum % 3;

    if (hashSelect === 0) {
      K = await sha256(E);
    } else if (hashSelect === 1) {
      K = await sha384(E);
    } else {
      K = await sha512(E);
    }

    i++;
    if (i >= 64 && E[E.length - 1] <= i - 32) {
      break;
    }
  }

  return K.slice(0, 32);
}

// ========== Algorithms 8, 9, 10 ==========

async function computeUandUE(
  password: Uint8Array,
  fileKey: Uint8Array
): Promise<{ U: Uint8Array; UE: Uint8Array }> {
  const validationSalt = randomBytes(8);
  const keySalt = randomBytes(8);

  const hash = await computeHash2B(password, validationSalt, new Uint8Array(0));
  const U = new Uint8Array(48);
  U.set(hash, 0);
  U.set(validationSalt, 32);
  U.set(keySalt, 40);

  const ueKey = await computeHash2B(password, keySalt, new Uint8Array(0));
  const zeroIV = new Uint8Array(16);
  const UE = await aes256CbcEncryptNoPad(fileKey, ueKey, zeroIV);

  return { U, UE };
}

async function computeOandOE(
  password: Uint8Array,
  fileKey: Uint8Array,
  U: Uint8Array
): Promise<{ O: Uint8Array; OE: Uint8Array }> {
  const validationSalt = randomBytes(8);
  const keySalt = randomBytes(8);

  const hash = await computeHash2B(password, validationSalt, U);
  const O = new Uint8Array(48);
  O.set(hash, 0);
  O.set(validationSalt, 32);
  O.set(keySalt, 40);

  const oeKey = await computeHash2B(password, keySalt, U);
  const zeroIV = new Uint8Array(16);
  const OE = await aes256CbcEncryptNoPad(fileKey, oeKey, zeroIV);

  return { O, OE };
}

async function computePerms(
  permissions: number,
  fileKey: Uint8Array,
  encryptMetadata: boolean
): Promise<Uint8Array> {
  const block = new Uint8Array(16);

  block[0] = permissions & 0xff;
  block[1] = (permissions >> 8) & 0xff;
  block[2] = (permissions >> 16) & 0xff;
  block[3] = (permissions >> 24) & 0xff;

  block[4] = 0xff;
  block[5] = 0xff;
  block[6] = 0xff;
  block[7] = 0xff;

  block[8] = encryptMetadata ? 0x54 : 0x46; // 'T' or 'F'

  block[9] = 0x61; // 'a'
  block[10] = 0x64; // 'd'
  block[11] = 0x62; // 'b'

  const rand = randomBytes(4);
  block[12] = rand[0];
  block[13] = rand[1];
  block[14] = rand[2];
  block[15] = rand[3];

  return await aes256EcbEncryptBlock(block, fileKey);
}

// ========== Stream & Object Encryption ==========

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

async function encryptObjectAES256(data: Uint8Array, cryptoKey: CryptoKey): Promise<Uint8Array> {
  const iv = randomBytes(16);
  const encrypted = await aes256CbcEncryptWithKey(data, cryptoKey, iv);
  const result = new Uint8Array(16 + encrypted.length);
  result.set(iv, 0);
  result.set(encrypted, 16);
  return result;
}

async function encryptStringsAES256(
  obj: any,
  objectNum: number,
  generationNum: number,
  cryptoKey: CryptoKey,
  seen: WeakSet<object>
): Promise<void> {
  if (!obj || (typeof obj === 'object' && seen.has(obj))) return;

  if (obj instanceof PDFString) {
    seen.add(obj);
    const originalBytes = obj.asBytes();
    const encrypted = await encryptObjectAES256(originalBytes, cryptoKey);
    (obj as any).value = bytesToPDFStringValue(encrypted);
  } else if (obj instanceof PDFHexString) {
    seen.add(obj);
    const originalBytes = obj.asBytes();
    const encrypted = await encryptObjectAES256(originalBytes, cryptoKey);
    (obj as any).value = bytesToHex(encrypted);
  } else if (obj instanceof PDFDict) {
    seen.add(obj);
    const isSig = isSignatureDict(obj);
    for (const [key, value] of obj.entries()) {
      if (!skipKey(key.asString(), isSig)) {
        await encryptStringsAES256(value, objectNum, generationNum, cryptoKey, seen);
      }
    }
  } else if (obj instanceof PDFArray) {
    seen.add(obj);
    for (const element of obj.asArray()) {
      await encryptStringsAES256(element, objectNum, generationNum, cryptoKey, seen);
    }
  }
}

function getOrCreateFileId(context: any): Uint8Array {
  const trailer = context.trailerInfo;
  const idArray = trailer.ID;

  const first = idArray instanceof PDFArray ? idArray.get(0)
    : (Array.isArray(idArray) && idArray.length > 0) ? idArray[0]
    : undefined;

  if (first && typeof first.asBytes === 'function') {
    const bytes = first.asBytes();
    if (bytes.length > 0) return bytes;
  }

  const fileId = randomBytes(16);
  const idHex1 = PDFHexString.of(bytesToHex(fileId));
  const idHex2 = PDFHexString.of(bytesToHex(fileId));
  trailer.ID = context.obj([idHex1, idHex2]);
  return fileId;
}

// ========== Main Public API ==========

/**
 * Encrypt a PDF document with standard AES-256 (ISO 32000-2:2020 / V=5, R=6)
 *
 * @param pdfBytes - Raw PDF bytes
 * @param userPassword - Password needed to unlock and view the PDF
 * @param options - Permissions and owner password configuration
 * @returns Encrypted PDF as Uint8Array
 */
export async function encryptPDF(
  pdfBytes: Uint8Array,
  userPassword: string,
  options: EncryptOptions = {}
): Promise<Uint8Array> {
  const ownerPassword = options.ownerPassword || userPassword;

  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  if (pdfDoc.isEncrypted) throw new AlreadyEncryptedError();

  const context = pdfDoc.context;
  const permissions = buildPermissions(options);

  const fileId = getOrCreateFileId(context);
  const fileKey = randomBytes(32);

  const userPwdBytes = encodePasswordAES256(userPassword);
  const ownerPwdBytes = encodePasswordAES256(ownerPassword);

  const { U, UE } = await computeUandUE(userPwdBytes, fileKey);
  const { O, OE } = await computeOandOE(ownerPwdBytes, fileKey, U);
  const Perms = await computePerms(permissions, fileKey, true);

  const cryptoKey = await importAES256Key(fileKey);

  const indirectObjects = context.enumerateIndirectObjects();
  const seen = new WeakSet<object>();

  for (const [ref, obj] of indirectObjects) {
    const objectNum = ref.objectNumber;
    const generationNum = ref.generationNumber || 0;

    if (obj instanceof PDFDict) {
      const filter = obj.get(PDFName.of('Filter'));
      if (filter && (filter as any).asString?.() === '/Standard') continue;
    }

    if (obj instanceof PDFRawStream && obj.dict) {
      const type = obj.dict.get(PDFName.of('Type'));
      if (type) {
        const typeName = type.toString();
        if (typeName === '/XRef' || typeName === '/Sig') continue;
      }
    }

    if (obj instanceof PDFRawStream) {
      const streamData = obj.contents;
      const encrypted = await encryptObjectAES256(streamData, cryptoKey);
      (obj as any).contents = encrypted;

      if (obj.dict) {
        await encryptStringsAES256(obj.dict, objectNum, generationNum, cryptoKey, seen);
      }
    } else {
      await encryptStringsAES256(obj, objectNum, generationNum, cryptoKey, seen);
    }
  }

  const stdCF = context.obj({
    Type: PDFName.of('CryptFilter'),
    CFM: PDFName.of('AESV3'),
    Length: PDFNumber.of(32),
    AuthEvent: PDFName.of('DocOpen'),
  });

  const cfDict = context.obj({});
  cfDict.set(PDFName.of('StdCF'), stdCF);

  const encryptDict = context.obj({
    Filter: PDFName.of('Standard'),
    V: PDFNumber.of(5),
    R: PDFNumber.of(6),
    Length: PDFNumber.of(256),
    P: PDFNumber.of(permissions),
    O: PDFHexString.of(bytesToHex(O)),
    U: PDFHexString.of(bytesToHex(U)),
    OE: PDFHexString.of(bytesToHex(OE)),
    UE: PDFHexString.of(bytesToHex(UE)),
    Perms: PDFHexString.of(bytesToHex(Perms)),
    StmF: PDFName.of('StdCF'),
    StrF: PDFName.of('StdCF'),
    CF: cfDict,
  });

  encryptDict.set(PDFName.of('EncryptMetadata'), context.obj(true));

  const encryptRef = context.register(encryptDict);
  const trailer = context.trailerInfo;
  trailer.Encrypt = encryptRef;

  if (!trailer.ID) {
    const idHex1 = PDFHexString.of(bytesToHex(fileId));
    const idHex2 = PDFHexString.of(bytesToHex(fileId));
    trailer.ID = context.obj([idHex1, idHex2]);
  }

  const encryptedBytes = await pdfDoc.save({
    useObjectStreams: false,
    updateFieldAppearances: false,
  });

  return encryptedBytes;
}
