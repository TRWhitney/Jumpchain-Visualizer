import { describe, expect, it } from "vitest";
import {
  assembleTranslationSources,
  createTranslationCatalog,
  localeList,
  localeNumber,
  normalizeAvailableLanguage,
  translationCatalog,
  validateTranslationPack,
} from "./catalog";

const english = {
  schemaVersion: 1,
  languageTag: "en",
  direction: "ltr",
  messages: translationCatalog.english.messages,
} as const;

describe("translation catalog", () => {
  it("discovers the canonical English resource and defaults unknown tags", () => {
    expect(translationCatalog.languages.map((pack) => pack.name)).toEqual([
      "English",
    ]);
    expect(translationCatalog.english.languageTag).toBe("en");
    expect(normalizeAvailableLanguage("not-a-real-locale")).toBe("en");
  });

  it("accepts partial packs while rejecting unknown keys and token drift", () => {
    expect(
      validateTranslationPack(
        "Français.json",
        {
          schemaVersion: 1,
          languageTag: "fr",
          direction: "ltr",
          messages: { common: { settings: "Paramètres" } },
        },
        english.messages,
      ).name,
    ).toBe("Français");
    expect(() =>
      validateTranslationPack(
        "Bad.json",
        {
          schemaVersion: 1,
          languageTag: "de",
          direction: "ltr",
          messages: { common: { unknown: "Unbekannt" } },
        },
        english.messages,
      ),
    ).toThrow(/unknown/);
    expect(() =>
      validateTranslationPack(
        "Bad.json",
        {
          schemaVersion: 1,
          languageTag: "de",
          direction: "ltr",
          messages: { routes: { chainWorkspaceTitle: "Kette" } },
        },
        english.messages,
      ),
    ).toThrow(/tokens/);
  });

  it("rejects duplicate tags and exposes locale formatters", () => {
    expect(() =>
      createTranslationCatalog({
        English: english,
        Duplicate: { ...english },
      }),
    ).toThrow(/duplicate/);
    expect(localeNumber(1234)).toMatch(/1.?234/);
    expect(localeList(["one", "two"])).toContain("one");
  });

  it("rejects duplicate file names and active-content strings", () => {
    expect(() =>
      createTranslationCatalog({
        "./languages/English": english,
        "./other/english": { ...english, languageTag: "en-GB" },
      }),
    ).toThrow(/file_name\.duplicate/);
    expect(() =>
      validateTranslationPack(
        "Unsafe.json",
        {
          schemaVersion: 1,
          languageTag: "fr",
          direction: "ltr",
          messages: { common: { settings: "<script>non</script>" } },
        },
        english.messages,
      ),
    ).toThrow(/component_forbidden/);
    expect(() =>
      validateTranslationPack(
        "Unsafe.json",
        {
          schemaVersion: 1,
          languageTag: "fr",
          direction: "ltr",
          messages: { common: { settings: "https://example.invalid" } },
        },
        english.messages,
      ),
    ).toThrow(/url_forbidden/);
  });

  it("assembles split language folders and rejects overlapping bundle keys", () => {
    const sources = assembleTranslationSources({
      "./languages/English/manifest.json": {
        schemaVersion: 1,
        languageTag: "en",
        direction: "ltr",
      },
      "./languages/English/common.json": { common: { settings: "Settings" } },
      "./languages/English/routes.json": { routes: { home: "Home" } },
    });
    expect(sources.English.messages).toEqual({
      common: { settings: "Settings" },
      routes: { home: "Home" },
    });
    expect(() =>
      assembleTranslationSources({
        "./languages/English/manifest.json": {
          schemaVersion: 1,
          languageTag: "en",
          direction: "ltr",
        },
        "./languages/English/one.json": { common: { settings: "Settings" } },
        "./languages/English/two.json": { common: { settings: "Duplicate" } },
      }),
    ).toThrow(/key\.duplicate/);
  });
});
