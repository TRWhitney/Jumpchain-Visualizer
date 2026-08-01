import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PackageImportReview } from "../archive";
import {
  createPlatformEditorWorkspaceRepository,
  createStarterWorkspace,
  type EditorWorkspaceRepository,
  type EditorWorkspaceSnapshot,
} from "../editor";
import { translate } from "../localization";

export type EditorSaveState = "saved" | "saving" | "unsaved" | "failed";

export function useEditorWorkspaceController(
  saveMode: "autosave" | "explicit",
  repositoryFactory: () => EditorWorkspaceRepository = createPlatformEditorWorkspaceRepository,
) {
  const repository = useMemo(() => repositoryFactory(), [repositoryFactory]);
  const [workspaces, setWorkspaces] = useState<
    Readonly<Record<string, EditorWorkspaceSnapshot>>
  >({});
  const workspacesRef = useRef(workspaces);
  const persistedRef = useRef<
    Readonly<Record<string, EditorWorkspaceSnapshot>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");
  const saveTimer = useRef<number | null>(null);
  const savingIndicatorTimer = useRef<number | null>(null);

  const replaceWorkspaces = useCallback(
    (next: Readonly<Record<string, EditorWorkspaceSnapshot>>) => {
      workspacesRef.current = next;
      setWorkspaces(next);
    },
    [],
  );

  useEffect(() => {
    let live = true;
    void repository
      .list()
      .then((stored) => {
        if (!live) return;
        const storedById = Object.fromEntries(
          stored.map((workspace) => [workspace.id, workspace]),
        );
        const indexed = { ...storedById, ...workspacesRef.current };
        persistedRef.current = indexed;
        replaceWorkspaces(indexed);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setError(translate("errors.EDITOR_PROJECTS_LOAD_FAILED"));
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [replaceWorkspaces, repository]);

  const persist = useCallback(
    async (workspace: EditorWorkspaceSnapshot, updateSaveState = true) => {
      try {
        await repository.save(workspace);
        persistedRef.current = {
          ...persistedRef.current,
          [workspace.id]: workspace,
        };
        if (updateSaveState) setSaveState("saved");
        setError(null);
        return true;
      } catch {
        if (updateSaveState) {
          setSaveState("failed");
          setError(translate("errors.EDITOR_AUTOSAVE_FAILED_MEMORY_RETAINED"));
        }
        return false;
      }
    },
    [repository],
  );

  const change = useCallback(
    (next: EditorWorkspaceSnapshot) => {
      replaceWorkspaces({ ...workspacesRef.current, [next.id]: next });
      setSaveState("unsaved");
      if (saveMode !== "autosave") return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (savingIndicatorTimer.current)
        window.clearTimeout(savingIndicatorTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const saving = workspacesRef.current[next.id];
        savingIndicatorTimer.current = window.setTimeout(() => {
          if (workspacesRef.current[next.id]?.revision === saving.revision)
            setSaveState("saving");
        }, 150);
        void persist(saving, false)
          .then((saved) => {
            if (workspacesRef.current[next.id]?.revision !== saving.revision)
              return;
            if (saved) {
              setSaveState("saved");
              setError(null);
            } else {
              setSaveState("failed");
              setError(
                translate("errors.EDITOR_AUTOSAVE_FAILED_MEMORY_RETAINED"),
              );
            }
          })
          .finally(() => {
            if (savingIndicatorTimer.current)
              window.clearTimeout(savingIndicatorTimer.current);
            savingIndicatorTimer.current = null;
          });
      }, 500);
    },
    [persist, replaceWorkspaces, saveMode],
  );

  const save = useCallback(
    async (id: string) => {
      const current = workspacesRef.current[id];
      if (!current) return false;
      setSaveState("saving");
      return persist(current);
    },
    [persist],
  );

  const create = useCallback(() => {
    const created = createStarterWorkspace();
    replaceWorkspaces({ ...workspacesRef.current, [created.id]: created });
    setSaveState("saved");
    void persist(created);
    return created;
  }, [persist, replaceWorkspaces]);

  const open = useCallback(
    (workspace: EditorWorkspaceSnapshot) => {
      const opened = { ...workspace, lastOpenedAt: new Date().toISOString() };
      replaceWorkspaces({ ...workspacesRef.current, [opened.id]: opened });
      setSaveState("saved");
      void persist(opened);
      return opened;
    },
    [persist, replaceWorkspaces],
  );

  const toggleStar = useCallback(
    (workspace: EditorWorkspaceSnapshot) => {
      const nextWorkspace = { ...workspace, starred: !workspace.starred };
      replaceWorkspaces({
        ...workspacesRef.current,
        [workspace.id]: nextWorkspace,
      });
      void persist(nextWorkspace);
      return nextWorkspace;
    },
    [persist, replaceWorkspaces],
  );

  const importReview = useCallback(
    (review: PackageImportReview) => {
      const now = new Date().toISOString();
      const imported: EditorWorkspaceSnapshot = {
        schemaVersion: 1,
        id: globalThis.crypto.randomUUID(),
        location: "imported",
        files: { ...review.files.definitions },
        assets: { ...review.files.assets },
        assetEditorDocuments: {},
        trash: [],
        starred: false,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        revision: 0,
      };
      replaceWorkspaces({ ...workspacesRef.current, [imported.id]: imported });
      void persist(imported);
      return imported;
    },
    [persist, replaceWorkspaces],
  );

  const remove = useCallback(
    async (id: string) => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (savingIndicatorTimer.current) {
        window.clearTimeout(savingIndicatorTimer.current);
        savingIndicatorTimer.current = null;
      }
      await repository.remove(id);
      const next = { ...workspacesRef.current };
      delete next[id];
      replaceWorkspaces(next);
      const persisted = { ...persistedRef.current };
      delete persisted[id];
      persistedRef.current = persisted;
      setError(null);
    },
    [replaceWorkspaces, repository],
  );

  const restorePersisted = useCallback(
    (id: string) => {
      const persisted = persistedRef.current[id];
      if (!persisted) return;
      replaceWorkspaces({ ...workspacesRef.current, [id]: persisted });
      setSaveState("saved");
    },
    [replaceWorkspaces],
  );

  const acceptExternal = useCallback(
    (workspace: EditorWorkspaceSnapshot, persistAccepted = false) => {
      replaceWorkspaces({
        ...workspacesRef.current,
        [workspace.id]: workspace,
      });
      persistedRef.current = {
        ...persistedRef.current,
        [workspace.id]: workspace,
      };
      if (persistAccepted) {
        setSaveState("saved");
        void repository.save(workspace);
      }
    },
    [replaceWorkspaces, repository],
  );

  const reportError = useCallback((message: string) => setError(message), []);

  const commands = useMemo(
    () => ({
      change,
      save,
      create,
      open,
      toggleStar,
      importReview,
      remove,
      restorePersisted,
      acceptExternal,
      reportError,
    }),
    [
      acceptExternal,
      change,
      create,
      importReview,
      open,
      remove,
      reportError,
      restorePersisted,
      save,
      toggleStar,
    ],
  );

  return {
    workspaces,
    loading,
    error,
    saveState,
    commands,
  } as const;
}
