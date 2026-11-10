/** Upload validation is independent of declared Content-Type and file extensions. */
export const EVENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export function eventImageType(bytes: Uint8Array): "image/jpeg" | "image/png" {
  if (!bytes.length || bytes.length > EVENT_IMAGE_MAX_BYTES) throw new Error("Choose an image smaller than 10 MB.");
  const validDimensions = (width: number, height: number) => width > 0 && height > 0 && width * height <= 40_000_000;
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const png = [137,80,78,71,13,10,26,10];
  if (bytes.length >= 45 && png.every((byte, index) => bytes[index] === byte) && data.getUint32(8) === 13 && data.getUint32(12) === 0x49484452 && data.getUint32(bytes.length - 8) === 0x49454e44 && validDimensions(data.getUint32(16), data.getUint32(20))) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) {
    let offset = 2;
    while (offset + 8 < bytes.length && bytes[offset] === 0xff) {
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = data.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8 && validDimensions(data.getUint16(offset + 5), data.getUint16(offset + 3))) return "image/jpeg";
      offset += length;
    }
  }
  throw new Error("This file is not a supported JPEG or PNG image. Please export it again and retry.");
}
