import { useCallback, useMemo, useState } from "react";

export type StructuredDisclosureState = Readonly<Record<string, boolean>>;

export const emptyStructuredDisclosureState: StructuredDisclosureState = {};

const noviceCollapsedExplorerGroups = new Set([
  "content:resources",
  "content:layouts",
  "content:themes",
  "content:trash",
  "files:trash",
]);

export function defaultExplorerGroupExpanded(
  groupId: string,
  collapseOptionalSectionsInitially: boolean,
) {
  return (
    !collapseOptionalSectionsInitially ||
    !noviceCollapsedExplorerGroups.has(groupId)
  );
}

export function useEditorDisclosureController(
  collapseOptionalSectionsByDefault: boolean,
) {
  const [collapseOptionalSectionsInitially] = useState(
    collapseOptionalSectionsByDefault,
  );
  const [explorerGroups, setExplorerGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [structured, setStructured] = useState<
    Record<string, StructuredDisclosureState>
  >({});

  const isExplorerGroupExpanded = useCallback(
    (groupId: string) =>
      explorerGroups[groupId] ??
      defaultExplorerGroupExpanded(groupId, collapseOptionalSectionsInitially),
    [collapseOptionalSectionsInitially, explorerGroups],
  );
  const setExplorerGroupExpanded = useCallback(
    (groupId: string, expanded: boolean) =>
      setExplorerGroups((current) =>
        current[groupId] === expanded
          ? current
          : { ...current, [groupId]: expanded },
      ),
    [],
  );
  const stateFor = useCallback(
    (owner: string | null) =>
      owner
        ? (structured[owner] ?? emptyStructuredDisclosureState)
        : emptyStructuredDisclosureState,
    [structured],
  );
  const remember = useCallback(
    (owner: string, section: string, expanded: boolean) => {
      setStructured((current) => {
        const ownerState = current[owner] ?? emptyStructuredDisclosureState;
        if (ownerState[section] === expanded) return current;
        return {
          ...current,
          [owner]: { ...ownerState, [section]: expanded },
        };
      });
    },
    [],
  );
  const reveal = useCallback((owner: string, section: string) => {
    setStructured((current) => ({
      ...current,
      [owner]: { ...(current[owner] ?? {}), [section]: true },
    }));
  }, []);
  const commands = useMemo(
    () => ({ setExplorerGroupExpanded, remember, reveal }),
    [remember, reveal, setExplorerGroupExpanded],
  );

  return {
    collapseOptionalSectionsInitially,
    isExplorerGroupExpanded,
    stateFor,
    commands,
  } as const;
}
