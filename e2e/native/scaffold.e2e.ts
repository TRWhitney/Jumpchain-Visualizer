import { expect } from "@wdio/globals";

describe("native application scaffold", () => {
  it("opens the Tauri window", async () => {
    await expect($("#root")).toExist();
  });

  it("starts with English and exposes the language dropdown in General", async () => {
    await expect($("html")).toHaveAttribute("lang", "en");
    const settings = await $("button=Settings");
    await settings.click();
    const generalTab = await $("button=General");
    await expect(generalTab).toExist();
    await generalTab.click();
    const language = await $("#language-selection");
    await expect(language).toHaveValue("en");
  });
});
