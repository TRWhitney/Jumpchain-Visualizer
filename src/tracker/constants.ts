export const trackerPages = [
  "jump",
  "inventory",
  "forms",
  "companions",
  "supplements",
] as const;
export type TrackerPage = (typeof trackerPages)[number];

export const EARTH_ENTRY_ID = "entry-earth";
export const EARTH_PACKAGE_ID = "system-earth";
export const EARTH_ENTRY_STATUS = "The Beginning";
