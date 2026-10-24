// CRC-32 table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Compresses data using native CompressionStream('deflate-raw')
 */
async function deflateData(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });
      const compressedStream = stream.pipeThrough(new CompressionStream('deflate-raw'));
      const response = new Response(compressedStream);
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      // Fallback to uncompressed if deflate-raw is not supported
      return data;
    }
  }
  return data;
}

export interface ZipOptions {
  compression?: 'deflate' | 'store';
}

/**
 * Creates a valid ZIP archive from an array of files.
 * 100% In-house, zero external dependencies.
 */
export async function createZip(
  entries: ZipEntry[],
  options: ZipOptions = {}
): Promise<Uint8Array> {
  const localHeadersAndData: Uint8Array[] = [];
  const centralDirEntries: Uint8Array[] = [];
  let currentOffset = 0;

  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const uncompressedSize = entry.data.length;
    const checksum = crc32(entry.data);

    let compressedData = entry.data;
    let isCompressed = false;

    if (options.compression !== 'store') {
      const deflated = await deflateData(entry.data);
      if (deflated.length < uncompressedSize && deflated !== entry.data) {
        compressedData = deflated;
        isCompressed = true;
      }
    }

    const dataToWrite = isCompressed ? compressedData : entry.data;
    const compressionMethod = isCompressed ? 8 : 0;
    const compressedSize = dataToWrite.length;

    // Local Header (30 bytes + name length)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);

    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true);         // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true);     // General purpose bit flag (UTF-8 filename)
    lv.setUint16(8, compressionMethod, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, compressedSize, true);
    lv.setUint32(22, uncompressedSize, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);         // Extra field length
    localHeader.set(nameBytes, 30);

    localHeadersAndData.push(localHeader);
    localHeadersAndData.push(dataToWrite);

    // Central Directory Header (46 bytes + name length)
    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdHeader.buffer);

    cv.setUint32(0, 0x02014b50, true); // Central directory header signature
    cv.setUint16(4, 20, true);         // Version made by
    cv.setUint16(6, 20, true);         // Version needed to extract
    cv.setUint16(8, 0x0800, true);     // General purpose bit flag (UTF-8)
    cv.setUint16(10, compressionMethod, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, compressedSize, true);
    cv.setUint32(24, uncompressedSize, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);         // Extra field length
    cv.setUint16(32, 0, true);         // File comment length
    cv.setUint16(34, 0, true);         // Disk number start
    cv.setUint16(36, 0, true);         // Internal file attributes
    cv.setUint32(38, 0, true);         // External file attributes
    cv.setUint32(42, currentOffset, true); // Relative offset of local header
    cdHeader.set(nameBytes, 46);

    centralDirEntries.push(cdHeader);

    currentOffset += localHeader.length + dataToWrite.length;
  }

  // Central directory size & offset
  const cdOffset = currentOffset;
  let cdSize = 0;
  for (const cd of centralDirEntries) {
    cdSize += cd.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);   // EOCD signature
  ev.setUint16(4, 0, true);            // Disk number
  ev.setUint16(6, 0, true);            // Disk with central directory
  ev.setUint16(8, entries.length, true); // Number of entries on this disk
  ev.setUint16(10, entries.length, true); // Total number of entries
  ev.setUint32(12, cdSize, true);      // Size of central directory
  ev.setUint32(16, cdOffset, true);    // Offset of central directory
  ev.setUint16(20, 0, true);           // Comment length

  // Combine all parts
  const totalLength = currentOffset + cdSize + 22;
  const zip = new Uint8Array(totalLength);
  let pos = 0;

  for (const part of localHeadersAndData) {
    zip.set(part, pos);
    pos += part.length;
  }
  for (const part of centralDirEntries) {
    zip.set(part, pos);
    pos += part.length;
  }
  zip.set(eocd, pos);

  return zip;
}
