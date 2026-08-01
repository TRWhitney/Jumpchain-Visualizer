const encodedBytesMarker = "base64";

type EncodedBytes = {
  $jumpchainBytes: typeof encodedBytesMarker;
  data: string;
};

const isEncodedBytes = (value: unknown): value is EncodedBytes =>
  Boolean(
    value &&
    typeof value === "object" &&
    (value as Partial<EncodedBytes>).$jumpchainBytes === encodedBytesMarker &&
    typeof (value as Partial<EncodedBytes>).data === "string",
  );

export function encodeBytesForJson(bytes: Uint8Array): EncodedBytes {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize)
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)),
    );
  return {
    $jumpchainBytes: encodedBytesMarker,
    data: btoa(chunks.join("")),
  };
}

export function decodeBytesFromJson(value: unknown, maximumBytes: number) {
  if (!isEncodedBytes(value)) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const legacy = value as Record<string, unknown>;
    let count = 0;
    let maximumIndex = -1;
    for (const key in legacy) {
      if (!Object.hasOwn(legacy, key) || !/^(0|[1-9]\d*)$/.test(key))
        return null;
      const index = Number(key);
      const byte = legacy[key];
      if (
        !Number.isSafeInteger(index) ||
        index >= maximumBytes ||
        typeof byte !== "number" ||
        !Number.isInteger(byte) ||
        byte < 0 ||
        byte > 255
      )
        return null;
      count += 1;
      if (count > maximumBytes) return null;
      maximumIndex = Math.max(maximumIndex, index);
    }
    if (count === 0 || count !== maximumIndex + 1) return null;
    const bytes = new Uint8Array(count);
    for (let index = 0; index < count; index += 1) {
      const byte = legacy[String(index)];
      if (typeof byte !== "number") return null;
      bytes[index] = byte;
    }
    return bytes;
  }
  const padding = value.data.endsWith("==")
    ? 2
    : value.data.endsWith("=")
      ? 1
      : 0;
  const decodedLength = Math.floor((value.data.length * 3) / 4) - padding;
  if (decodedLength < 0 || decodedLength > maximumBytes) return null;
  try {
    const binary = atob(value.data);
    if (binary.length !== decodedLength) return null;
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

export function stringifyBinaryJson(value: unknown) {
  return JSON.stringify(value, (_key, candidate) =>
    candidate instanceof Uint8Array ? encodeBytesForJson(candidate) : candidate,
  );
}
