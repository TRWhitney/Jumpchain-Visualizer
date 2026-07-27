import { expect, test as base } from "@playwright/test";
import { reviewArtifactsEnabled } from "./reviewArtifacts";

export { expect };
export type { Locator, Page, TestInfo } from "@playwright/test";

const reviewTimestamp = Date.UTC(2026, 0, 15, 12, 0, 0);

export const test = base.extend<{
  deterministicReviewClock: void;
  welcomeTourSetup: void;
  welcomeTourStatus: "dismissed" | "pending";
}>({
  welcomeTourStatus: ["dismissed", { option: true }],
  deterministicReviewClock: [
    async ({ context }, use) => {
      if (reviewArtifactsEnabled) {
        await context.addInitScript(
          ({ timestamp }) => {
            const NativeDate = Date;
            let uuidSequence = 0;
            globalThis.Date = new Proxy(NativeDate, {
              apply(target, thisArgument, argumentsList) {
                if (argumentsList.length > 0)
                  return Reflect.apply(target, thisArgument, argumentsList);
                return new target(timestamp).toString();
              },
              construct(target, argumentsList) {
                return Reflect.construct(
                  target,
                  argumentsList.length > 0 ? argumentsList : [timestamp],
                );
              },
              get(target, property, receiver) {
                if (property === "now") return () => timestamp;
                return Reflect.get(target, property, receiver);
              },
            });
            Object.defineProperty(globalThis.crypto, "randomUUID", {
              configurable: true,
              value: () => {
                uuidSequence += 1;
                return `00000000-0000-4000-8000-${uuidSequence
                  .toString(16)
                  .padStart(12, "0")}`;
              },
            });
          },
          { timestamp: reviewTimestamp },
        );
      }
      await use();
    },
    { auto: true },
  ],
  welcomeTourSetup: [
    async ({ page, welcomeTourStatus }, use) => {
      if (welcomeTourStatus === "dismissed") {
        await page.goto("/");
        await page
          .getByRole("heading", {
            name: "Welcome to Jumpchain Visualizer",
          })
          .waitFor();
        await page.getByRole("button", { name: "Exit tour" }).click();
        await page.getByRole("button", { name: /Advanced/ }).click();
        await page.waitForFunction(
          () =>
            new Promise<boolean>((resolve, reject) => {
              const open = indexedDB.open("jumpchain-visualizer", 4);
              open.onerror = () => reject(open.error);
              open.onsuccess = () => {
                const database = open.result;
                const read = database
                  .transaction("aggregates", "readonly")
                  .objectStore("aggregates")
                  .get("settings");
                read.onerror = () => reject(read.error);
                read.onsuccess = () => {
                  database.close();
                  resolve(
                    read.result?.onboarding?.welcomeTourStatus === "dismissed",
                  );
                };
              };
            }),
        );
        await expect(
          page.getByRole("heading", {
            name: "Welcome to Jumpchain Visualizer",
          }),
        ).toHaveCount(0);
      }
      await use();
    },
    { auto: true },
  ],
});
