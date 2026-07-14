export type RandomIndexSource = (
  upperExclusive: number,
  priorSequence: number,
) => number;

export const deterministicRandomIndex: RandomIndexSource = (
  upperExclusive,
  priorSequence,
) => {
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0)
    throw new RangeError("Random selection requires at least one candidate.");
  return priorSequence % upperExclusive;
};

export const platformRandomIndex: RandomIndexSource = (upperExclusive) => {
  if (
    !Number.isSafeInteger(upperExclusive) ||
    upperExclusive <= 0 ||
    upperExclusive > 0x1_0000_0000
  )
    throw new RangeError("Random selection candidate count is invalid.");
  const range = 0x1_0000_0000;
  const ceiling = Math.floor(range / upperExclusive) * upperExclusive;
  const sample = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(sample);
  while (sample[0] >= ceiling);
  return sample[0] % upperExclusive;
};
