export const APPLICATION_DATABASE_NAME = "jumpchain-visualizer";
export const SETTINGS_STORE_NAME = "aggregates";
export const CHAINS_STORE_NAME = "chains";
export const EDITOR_WORKSPACES_STORE_NAME = "editor-workspaces";
const APPLICATION_DATABASE_VERSION = 3;

export function openApplicationDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(
      APPLICATION_DATABASE_NAME,
      APPLICATION_DATABASE_VERSION,
    );
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB could not be opened."));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SETTINGS_STORE_NAME))
        request.result.createObjectStore(SETTINGS_STORE_NAME);
      if (!request.result.objectStoreNames.contains(CHAINS_STORE_NAME))
        request.result.createObjectStore(CHAINS_STORE_NAME, { keyPath: "id" });
      if (
        !request.result.objectStoreNames.contains(EDITOR_WORKSPACES_STORE_NAME)
      )
        request.result.createObjectStore(EDITOR_WORKSPACES_STORE_NAME, {
          keyPath: "id",
        });
    };
    request.onsuccess = () => resolve(request.result);
  });
}
