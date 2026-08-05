import { describe, expect, test } from "vitest";
import { zipSync } from "fflate";
import { JumpPackageImportService } from "../archive";
import { SAFE_PACKAGE_SIZE_LIMITS } from "../archive/packageLimits";
import {
  installedPackageFromReview,
  restoreStoredChainPackage,
} from "./importedPackage";
import {
  MemoryChainPackageRepository,
  storedChainPackage,
} from "./packageRepository";

const archive = () =>
  zipSync({
    "jump.jdef": new TextEncoder().encode(`jump
  format: 1
  name: "Persistent Import"
  author: "Persistence Fixture"
  version: "1.0"

section
  handle: choices
  name: "Choices"
  choice
    handle: persistent_placement
    target: persistent_choice

choice
  handle: persistent_choice
  name: "Remember This"
`),
  });

describe("chain package persistence", () => {
  test("round-trips an owned archive and securely reconstructs its package", async () => {
    const review = await new JumpPackageImportService().inspect(
      archive(),
      SAFE_PACKAGE_SIZE_LIMITS,
    );
    const installed = installedPackageFromReview(review);
    const repository = new MemoryChainPackageRepository();
    await repository.save(
      storedChainPackage(
        "ch-imported",
        installed.id,
        review.archive,
        review.limits,
      ),
    );

    const [stored] = await repository.list("ch-imported");
    const restored = await restoreStoredChainPackage(stored);
    expect(restored?.id).toBe(installed.id);
    expect(restored?.document?.name.base).toBe("Persistent Import");
  });

  test("rejects a stored archive whose content does not match its id", async () => {
    const value = storedChainPackage(
      "ch-imported",
      "imported-not-the-archive-hash",
      archive(),
      SAFE_PACKAGE_SIZE_LIMITS,
    );
    await expect(restoreStoredChainPackage(value)).resolves.toBeNull();
  });
});
