import { expect, test as base } from "@playwright/test";
import { reviewArtifactsEnabled } from "./reviewArtifacts";
import {
  welcomeTourStorageState,
  type WelcomeTourStatus,
} from "./welcomeTourState";

export { expect };
export type { Locator, Page, TestInfo } from "@playwright/test";

const reviewTimestamp = Date.UTC(2026, 0, 15, 12, 0, 0);

export const test = base.extend<{
  deterministicReviewClock: void;
  welcomeTourStatus: WelcomeTourStatus;
}>({
  welcomeTourStatus: ["dismissed", { option: true }],
  storageState: async ({ welcomeTourStatus }, applyStorageState) => {
    await applyStorageState(welcomeTourStorageState(welcomeTourStatus));
  },
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
});
