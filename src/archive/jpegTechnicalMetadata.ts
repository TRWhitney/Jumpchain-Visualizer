export type JpegTechnicalMetadata = {
  orientation: number;
  densityX?: number;
  densityY?: number;
  densityUnit?: "dpi" | "dpcm";
};

const ascii = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

export function jpegTechnicalMetadata(bytes: Uint8Array) {
  const result: JpegTechnicalMetadata = { orientation: 1 };
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return result;
  const jpegView = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = jpegView.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    const dataOffset = offset + 4;
    if (
      marker === 0xe1 &&
      ascii(bytes.subarray(dataOffset, dataOffset + 6)) === "Exif\0\0"
    ) {
      const tiffOffset = dataOffset + 6;
      if (tiffOffset + 8 > bytes.length) break;
      const endian = ascii(bytes.subarray(tiffOffset, tiffOffset + 2));
      if (endian !== "II" && endian !== "MM") break;
      const littleEndian = endian === "II";
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset + tiffOffset,
        offset + 2 + length - tiffOffset,
      );
      if (view.getUint16(2, littleEndian) !== 42) break;
      const ifdOffset = view.getUint32(4, littleEndian);
      if (ifdOffset + 2 > view.byteLength) break;
      const count = view.getUint16(ifdOffset, littleEndian);
      let densityX: number | undefined;
      let densityY: number | undefined;
      let resolutionUnit = 2;
      for (let index = 0; index < Math.min(count, 256); index += 1) {
        const entry = ifdOffset + 2 + index * 12;
        if (entry + 12 > view.byteLength) break;
        const tag = view.getUint16(entry, littleEndian);
        const type = view.getUint16(entry + 2, littleEndian);
        const values = view.getUint32(entry + 4, littleEndian);
        const inlineShort = view.getUint16(entry + 8, littleEndian);
        if (tag === 0x0112 && type === 3 && values === 1)
          result.orientation =
            inlineShort >= 1 && inlineShort <= 8 ? inlineShort : 1;
        if (tag === 0x0128 && type === 3 && values === 1)
          resolutionUnit = inlineShort;
        if ((tag === 0x011a || tag === 0x011b) && type === 5 && values === 1) {
          const valueOffset = view.getUint32(entry + 8, littleEndian);
          if (valueOffset + 8 > view.byteLength) continue;
          const numerator = view.getUint32(valueOffset, littleEndian);
          const denominator = view.getUint32(valueOffset + 4, littleEndian);
          const value = denominator ? numerator / denominator : 0;
          if (value > 0 && value <= 100_000) {
            if (tag === 0x011a) densityX = value;
            else densityY = value;
          }
        }
      }
      if (
        densityX &&
        densityY &&
        (resolutionUnit === 2 || resolutionUnit === 3)
      ) {
        result.densityX = densityX;
        result.densityY = densityY;
        result.densityUnit = resolutionUnit === 2 ? "dpi" : "dpcm";
      }
      break;
    }
    offset += 2 + length;
  }
  return result;
}
