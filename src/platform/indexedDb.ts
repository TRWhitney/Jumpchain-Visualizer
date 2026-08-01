export const APPLICATION_DATABASE_NAME = "jumpchain-visualizer";
export const SETTINGS_STORE_NAME = "aggregates";
export const CHAINS_STORE_NAME = "chains";
export const EDITOR_WORKSPACES_STORE_NAME = "editor-workspaces";
export const WELCOME_TOUR_STORE_NAME = "welcome-tour";
const APPLICATION_DATABASE_VERSION = 4;

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
      if (!request.result.objectStoreNames.contains(WELCOME_TOUR_STORE_NAME))
        request.result.createObjectStore(WELCOME_TOUR_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

type StorageError = (cause: DOMException | null) => Error;

export async function requestObjectStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  error: StorageError,
) {
  const database = await openApplicationDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onerror = () => reject(error(request.error));
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => database.close();
  });
}

export async function completeObjectStoreTransaction(
  storeName: string,
  operation: (store: IDBObjectStore) => void,
  error: StorageError,
) {
  const database = await openApplicationDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    operation(transaction.objectStore(storeName));
    transaction.onerror = () => reject(error(transaction.error));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
  });
}
