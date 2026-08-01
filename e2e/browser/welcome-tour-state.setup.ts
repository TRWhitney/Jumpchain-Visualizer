import { expect, test as setup } from "@playwright/test";
import {
  captureWelcomeTourStorageState,
  dismissWelcomeTour,
  PLAYWRIGHT_APPLICATION_ORIGIN,
} from "./support/welcomeTourState";

setup("prepare dismissed welcome-tour state", async ({ page }) => {
  await dismissWelcomeTour(page);
  const state = await captureWelcomeTourStorageState(page);

  expect(state.cookies).toEqual([]);
  expect(state.origins).toHaveLength(1);
  expect(state).toMatchObject({
    cookies: [],
    origins: [
      {
        origin: PLAYWRIGHT_APPLICATION_ORIGIN,
        indexedDB: expect.arrayContaining([
          expect.objectContaining({
            name: "jumpchain-visualizer",
            stores: expect.arrayContaining([
              expect.objectContaining({
                name: "aggregates",
                records: [expect.objectContaining({ key: "settings" })],
              }),
              expect.objectContaining({ name: "chains", records: [] }),
            ]),
          }),
        ]),
      },
    ],
  });
});
