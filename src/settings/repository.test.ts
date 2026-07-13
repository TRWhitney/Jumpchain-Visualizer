import { describe, expect, it } from "vitest";
import { defaultSettings } from "./model";
import { MemorySettingsRepository } from "./repository";
import { createDefaultTagProfile } from "./tagProfile";

describe("settings repositories", () => {
  it("round trips an isolated aggregate through the memory contract", async () => {
    const repository = new MemorySettingsRepository();
    expect(await repository.load()).toBeNull();
    const settings = defaultSettings(createDefaultTagProfile());
    settings.chain.warnUpstreamChanges = true;
    await repository.save(settings);
    settings.chain.warnUpstreamChanges = false;
    const stored = await repository.load();
    expect(stored).toMatchObject({
      schemaVersion: 1,
      chain: { warnUpstreamChanges: true },
    });
  });
});
