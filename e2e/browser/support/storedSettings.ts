import type { Page } from "@playwright/test";

export async function waitForStoredSetting(
  page: Page,
  path: string[],
  expected: string | number | boolean | null,
) {
  await page.waitForFunction(
    async ({ expectedValue, settingPath }) => {
      const request = indexedDB.open("jumpchain-visualizer");
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction("aggregates", "readonly");
      const read = transaction.objectStore("aggregates").get("settings");
      const stored = await new Promise<unknown>((resolve, reject) => {
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
      });
      database.close();
      let value = stored;
      for (const segment of settingPath) {
        if (typeof value !== "object" || value === null) return false;
        value = (value as Record<string, unknown>)[segment];
      }
      return value === expectedValue;
    },
    { expectedValue: expected, settingPath: path },
  );
}

export async function waitForStoredChainValue(
  page: Page,
  chainId: string,
  path: string[],
  expected: string | number | boolean | null,
) {
  await page.waitForFunction(
    async ({ expectedValue, id, valuePath }) => {
      const request = indexedDB.open("jumpchain-visualizer");
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction("chains", "readwrite");
      const read = transaction.objectStore("chains").get(id);
      const stored = await new Promise<unknown>((resolve, reject) => {
        let value: unknown;
        read.onsuccess = () => {
          value = read.result;
        };
        read.onerror = () => reject(read.error);
        transaction.oncomplete = () => resolve(value);
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
      let value = stored;
      for (const segment of valuePath) {
        if (typeof value !== "object" || value === null) return false;
        value = (value as Record<string, unknown>)[segment];
      }
      return value === expectedValue;
    },
    {
      expectedValue: expected,
      id: chainId,
      valuePath: path,
    },
  );
}
