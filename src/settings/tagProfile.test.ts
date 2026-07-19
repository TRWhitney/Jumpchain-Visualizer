import { describe, expect, it } from "vitest";
import {
  addTag,
  adaptTagTextToSurfaces,
  createDefaultTagProfile,
  deleteTag,
  exportTagProfile,
  hydrateTagProfile,
  importTagProfile,
  installedTagCandidates,
  normalizeTag,
  readableTagText,
  refreshInstalledTags,
  removeAlias,
  setTagParent,
  tagAliasesForMatching,
  tagAliasesForPresentation,
  tagLabelForPresentation,
  tagDisplayName,
  tagTextContrast,
  toggleAlias,
  updateTagPresentation,
  wouldCreateParentCycle,
} from "./tagProfile";
import { installedPackages } from "../tracker/fixtures";
import { primaryTagIds } from "./builtinTags";

describe("tag profiles", () => {
  it("normalizes compatibility forms, separators, and display particles", () => {
    expect(normalizeTag("  LORD_of_the‐great rings ")).toBe(
      "lord of the great rings",
    );
    expect(tagDisplayName("LORD_of_the‐great rings")).toBe(
      "Lord of the Great Rings",
    );
  });

  it("enforces parent and reciprocal alias rules", () => {
    let profile = createDefaultTagProfile();
    const fire = addTag(profile, "Solar Command", "manual");
    profile = fire.profile;
    const flame = addTag(profile, "Corona Shaping", "manual");
    profile = flame.profile;
    profile = setTagParent(profile, fire.selectedId!, "magic").profile;
    profile = setTagParent(
      profile,
      flame.selectedId!,
      fire.selectedId!,
    ).profile;
    expect(
      wouldCreateParentCycle(profile, fire.selectedId!, flame.selectedId!),
    ).toBe(true);
    const linked = toggleAlias(profile, fire.selectedId!, flame.selectedId!);
    expect(linked.error).toContain("parent");
    profile = setTagParent(profile, flame.selectedId!, "magic").profile;
    profile = toggleAlias(profile, fire.selectedId!, flame.selectedId!).profile;
    expect(profile.tags[fire.selectedId!].aliases).toEqual(["Corona Shaping"]);
    expect(profile.tags[flame.selectedId!].aliases).toEqual(["Solar Command"]);
  });

  it("ships a deep editable built-in catalog beneath twelve fixed primary tags", () => {
    let profile = createDefaultTagProfile();
    expect(Object.keys(profile.tags).length).toBeGreaterThan(150);
    expect(
      Object.values(profile.tags).filter((tag) => primaryTagIds.has(tag.id)),
    ).toHaveLength(12);
    expect(profile.tags.vehicles.name).toBe("Vehicle");
    expect(profile.tags.vehicles.aliases).toContain("Vehicles");
    expect(profile.tags.vehicles.parent).toBe("technology");
    const canonicalNames = new Set(
      Object.values(profile.tags).map((tag) => normalizeTag(tag.name)),
    );
    const aliases = new Set<string>();
    for (const tag of Object.values(profile.tags))
      for (const alias of tag.aliases) {
        expect(canonicalNames.has(normalizeTag(alias))).toBe(false);
        expect(aliases.has(normalizeTag(alias))).toBe(false);
        aliases.add(normalizeTag(alias));
      }
    const moved = setTagParent(profile, "vehicles", "miscellaneous");
    expect(moved.error).toBeUndefined();
    profile = moved.profile;
    expect(profile.tags.vehicles.parent).toBe("miscellaneous");
    profile = removeAlias(profile, "vehicles", "Vehicles");
    expect(profile.tags.vehicles.aliases).not.toContain("Vehicles");
    const roundTrip = importTagProfile(
      createDefaultTagProfile(),
      exportTagProfile(profile),
      "merge",
    );
    expect(roundTrip.error).toBeUndefined();
    expect(roundTrip.profile.tags.vehicles.aliases).not.toContain("Vehicles");
    expect(setTagParent(profile, "technology", "miscellaneous").error).toBe(
      "That parent would create an invalid relationship.",
    );
  });

  it("layers editable aliases over localized built-in presentation", () => {
    let profile = createDefaultTagProfile();
    const custom = addTag(profile, "Personal Auto", "manual");
    profile = custom.profile;
    profile = toggleAlias(profile, "vehicles", custom.selectedId!).profile;
    const vehicle = profile.tags.vehicles;

    expect(tagLabelForPresentation(vehicle, "en")).toBe("Vehicle");
    expect(tagAliasesForPresentation(vehicle, "en")).toEqual([
      "Vehicles",
      "Personal Auto",
    ]);
    expect(tagAliasesForMatching(vehicle, "en")).toEqual([
      "Vehicles",
      "Personal Auto",
    ]);

    profile = removeAlias(profile, "vehicles", "Vehicles");
    expect(tagAliasesForPresentation(profile.tags.vehicles, "en")).toEqual([
      "Personal Auto",
    ]);
  });

  it("discovers only missing installed-Jump strings when explicitly refreshed", () => {
    const profile = createDefaultTagProfile();
    const candidates = installedTagCandidates(profile, installedPackages);
    expect(candidates.some((candidate) => candidate.name === "Magic")).toBe(
      false,
    );
    expect(candidates.some((candidate) => candidate.name === "Vehicle")).toBe(
      false,
    );
    expect(
      candidates.find((candidate) => candidate.name === "Door Craft")
        ?.packageNames,
    ).toEqual(["Threshold of a Thousand Roads"]);

    const refreshed = refreshInstalledTags(profile, installedPackages);
    const acquired = refreshed.profile.tags["door-craft"];
    expect(acquired.source).toBe("acquired");
    expect(acquired.parent).toBe("miscellaneous");
    expect(acquired.presentation.colors).not.toEqual(
      profile.tags.miscellaneous.presentation.colors,
    );
    const sibling = addTag(
      refreshed.profile,
      "Another installed tag",
      "manual",
    );
    expect(
      sibling.profile.tags[sibling.selectedId!].presentation.colors,
    ).not.toEqual(acquired.presentation.colors);
    expect(
      refreshInstalledTags(refreshed.profile, installedPackages).added,
    ).toHaveLength(0);
  });

  it("uses the child name only as a stable seed for inherited badge colors", () => {
    let profile = createDefaultTagProfile();
    const first = addTag(profile, "Solar Weaving", "manual");
    profile = setTagParent(first.profile, first.selectedId!, "magic").profile;
    const second = addTag(profile, "Lunar Weaving", "manual");
    profile = setTagParent(second.profile, second.selectedId!, "magic").profile;
    expect(profile.tags[first.selectedId!].name).toBe("Solar Weaving");
    expect(profile.tags[first.selectedId!].presentation.colors).not.toEqual(
      profile.tags.magic.presentation.colors,
    );
    expect(profile.tags[first.selectedId!].presentation.colors).not.toEqual(
      profile.tags[second.selectedId!].presentation.colors,
    );
    const repeated = setTagParent(
      addTag(createDefaultTagProfile(), "Solar Weaving", "manual").profile,
      first.selectedId!,
      "magic",
    ).profile;
    expect(repeated.tags[first.selectedId!].presentation.colors).toEqual(
      profile.tags[first.selectedId!].presentation.colors,
    );
  });

  it("ships visibly shifted built-in child colors and refreshes uncustomized persisted presets", () => {
    const profile = createDefaultTagProfile();
    expect(profile.tags.adaptation.presentation.colors).not.toEqual(
      profile.tags.physical.presentation.colors,
    );
    expect(profile.tags.adaptation.presentation.colors).not.toEqual(
      profile.tags.strength.presentation.colors,
    );
    const stale = structuredClone(profile);
    stale.tags.adaptation.presentation = structuredClone(
      stale.tags.physical.presentation,
    );
    const hydrated = hydrateTagProfile(stale, profile);
    expect(hydrated.tags.adaptation.presentation.colors).toEqual(
      profile.tags.adaptation.presentation.colors,
    );
  });

  it("protects acquired tags and reparents children when deleting profile-only tags", () => {
    let profile = createDefaultTagProfile();
    const parent = addTag(profile, "Elemental", "manual");
    profile = parent.profile;
    const child = addTag(profile, "Flame", "manual");
    profile = setTagParent(
      child.profile,
      child.selectedId!,
      parent.selectedId!,
    ).profile;
    profile = deleteTag(profile, parent.selectedId!);
    expect(profile.tags[parent.selectedId!]).toBeUndefined();
    expect(profile.tags[child.selectedId!].parent).toBe("miscellaneous");
    const acquired = addTag(profile, "Flight", "acquired");
    expect(deleteTag(acquired.profile, acquired.selectedId!)).toEqual(
      acquired.profile,
    );
  });

  it("validates versioned merge imports and bounded presentation", () => {
    let profile = createDefaultTagProfile();
    const custom = addTag(profile, "Pyrokinesis", "manual");
    profile = updateTagPresentation(custom.profile, custom.selectedId!, {
      background: "gradient",
      colors: ["#ff0000", "#000000"],
      positions: [0, 100],
    });
    const exported = exportTagProfile(profile);
    const imported = importTagProfile(
      createDefaultTagProfile(),
      exported,
      "merge",
    );
    expect(imported.error).toBeUndefined();
    expect(
      Object.values(imported.profile.tags).find(
        (tag) => tag.name === "Pyrokinesis",
      )?.presentation.background,
    ).toBe("gradient");
    expect(
      importTagProfile(profile, '{"schemaVersion":2,"tags":[]}', "merge").error,
    ).toContain("schemaVersion 1");
    expect(
      importTagProfile(
        profile,
        '{"schemaVersion":1,"tags":[],"unexpected":true}',
        "merge",
      ).error,
    ).toContain("unsupported document fields");
  });

  it("resolves imported parent display names without rewriting record data", () => {
    const imported = importTagProfile(
      createDefaultTagProfile(),
      JSON.stringify({
        schemaVersion: 1,
        tags: [
          {
            name: "Weather Working",
            parent: "Magic",
            appearanceSource: "derived",
          },
        ],
        aliasLinks: [],
      }),
      "merge",
    );
    expect(imported.error).toBeUndefined();
    expect(imported.profile.tags["weather-working"].parent).toBe("magic");
  });

  it("chooses the strongest accessible automatic text color across gradient stops", () => {
    const text = readableTagText(["#f4e9bd", "#ffffff"]);
    expect(text).toBe("#111111");
    expect(tagTextContrast(text, "#f4e9bd")).toBeGreaterThan(4.5);
  });

  it("adapts transparent custom text only as far as its rendered surface requires", () => {
    const darkened = adaptTagTextToSurfaces("#ffffff", ["#f6f5f1"]);
    const lightened = adaptTagTextToSurfaces("#000000", ["#20201e"]);

    expect(darkened).not.toBe("#ffffff");
    expect(lightened).not.toBe("#000000");
    expect(tagTextContrast(darkened, "#f6f5f1")).toBeGreaterThanOrEqual(4.5);
    expect(tagTextContrast(lightened, "#20201e")).toBeGreaterThanOrEqual(4.5);
    expect(adaptTagTextToSurfaces("#761923", ["#f6f5f1"])).toBe("#761923");
  });
});
