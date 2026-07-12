import { expect } from "@wdio/globals";

describe("native application scaffold", () => {
  it("opens the Tauri window", async () => {
    await expect($("#root")).toExist();
  });
});
