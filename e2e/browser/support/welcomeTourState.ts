import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

export type WelcomeTourStatus = "dismissed" | "pending";

interface CapturedStorageState {
  cookies: unknown[];
  origins: Array<{
    origin: string;
    indexedDB?: Array<{
      stores: Array<{ name: string; records: unknown[] }>;
    }>;
  }>;
}

export const PLAYWRIGHT_APPLICATION_ORIGIN = "http://127.0.0.1:4173";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export const WELCOME_TOUR_STORAGE_STATE_PATH = resolve(
  repositoryRoot,
  "test-results/.auth/welcome-tour-dismissed.json",
);

export function welcomeTourStorageState(status: WelcomeTourStatus) {
  return status === "dismissed"
    ? WELCOME_TOUR_STORAGE_STATE_PATH
    : { cookies: [], origins: [] };
}

export async function dismissWelcomeTour(page: Page) {
  await page.goto("/");
  await page
    .getByRole("heading", { name: "Welcome to Jumpchain Visualizer" })
    .waitFor();
  await page.getByRole("button", { name: "Exit tour" }).dispatchEvent("click");

  const interfaceDialog = page.getByRole("dialog", {
    name: "Choose your interface",
  });
  await interfaceDialog.waitFor();
  await interfaceDialog
    .getByRole("button", { name: /Advanced/ })
    .dispatchEvent("click");
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolveState, reject) => {
        const open = indexedDB.open("jumpchain-visualizer", 5);
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
            resolveState(
              read.result?.onboarding?.welcomeTourStatus === "dismissed",
            );
          };
        };
      }),
  );
  await interfaceDialog.waitFor({ state: "detached" });
}

export async function captureWelcomeTourStorageState(page: Page) {
  return captureSanitizedStorageState(
    page,
    WELCOME_TOUR_STORAGE_STATE_PATH,
    sanitizeWelcomeTourStorageState,
  );
}

async function captureSanitizedStorageState(
  page: Page,
  path: string,
  sanitize: (state: CapturedStorageState) => CapturedStorageState,
) {
  await mkdir(dirname(path), { recursive: true });
  await page.context().storageState({ indexedDB: true, path });
  const captured = JSON.parse(
    await readFile(path, "utf8"),
  ) as CapturedStorageState;
  const sanitized = sanitize(captured);
  await writeFile(path, `${JSON.stringify(sanitized, null, 2)}\n`);
  return sanitized;
}

export function sanitizeWelcomeTourStorageState(state: CapturedStorageState) {
  return {
    cookies: [],
    origins: state.origins
      .filter(({ origin }) => origin === PLAYWRIGHT_APPLICATION_ORIGIN)
      .map((origin) => ({
        ...origin,
        indexedDB: origin.indexedDB?.map((database) => ({
          ...database,
          stores: database.stores.map((store) => ({
            ...store,
            records: store.records.filter((record) => {
              if (typeof record !== "object" || record === null) return false;
              return (
                store.name === "aggregates" &&
                "key" in record &&
                record.key === "settings"
              );
            }),
          })),
        })),
      })),
  };
}
