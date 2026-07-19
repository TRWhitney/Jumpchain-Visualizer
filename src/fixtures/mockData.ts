import type { InstalledPackage } from "../tracker/model";
import { validGeneratedJumpPackages } from "./generatedPackages";

export const MOCK_CHAIN_ID = "ch-92b1";

export const mockChainDefinition = {
  id: MOCK_CHAIN_ID,
  name: "Morgan",
  description:
    "A three-Jump demonstration chain spanning every Format 1 capability.",
  lastOpenedSequence: 80,
  lastOpenedLabel: "Opened yesterday",
  starred: false,
} as const;

const mockPackageOrder = [
  "threshold-roads",
  "confluence-engine",
  "last-trial",
] as const;

export const mockInstalledPackages: readonly InstalledPackage[] =
  validGeneratedJumpPackages
    .map((document) => ({
      id: document.id,
      logicalId: document.logicalId,
      name: document.name.base ?? document.id,
      version: document.version,
      source: "mock" as const,
      description: document.description,
      tags: [
        ...new Set([
          ...document.tags,
          ...document.choices.flatMap((choice) => [
            ...choice.tags,
            ...choice.grants.flatMap((grant) => grant.tags),
          ]),
        ]),
      ],
      exactHash: document.exactHash,
      authors: document.authors,
      nativeGauntlet: document.nativeGauntlet,
      document,
    }))
    .sort(
      (left, right) =>
        mockPackageOrder.indexOf(left.id as (typeof mockPackageOrder)[number]) -
        mockPackageOrder.indexOf(right.id as (typeof mockPackageOrder)[number]),
    );

export const mockPackageIds = mockPackageOrder;

export function isMockChainId(id: string) {
  return id === MOCK_CHAIN_ID;
}
