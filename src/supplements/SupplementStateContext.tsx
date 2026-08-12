import { useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import {
  initialSupplementState,
  supplementReducer,
  type SupplementAction,
  type SupplementState,
} from "./supplementState";
import { SupplementStateContext } from "./supplementStateContextDefinition";
export function SupplementStateProvider({
  children,
  state: controlledState,
  dispatch: controlledDispatch,
  entryLabels = {},
}: {
  children: ReactNode;
  state?: SupplementState;
  dispatch?: Dispatch<SupplementAction>;
  entryLabels?: Readonly<Record<string, string>>;
}) {
  const [localState, localDispatch] = useReducer(
    supplementReducer,
    initialSupplementState,
  );
  const state = controlledState ?? localState;
  const dispatch = controlledDispatch ?? localDispatch;
  const value = useMemo(
    () => ({ state, dispatch, entryLabels }),
    [dispatch, entryLabels, state],
  );
  return (
    <SupplementStateContext.Provider value={value}>
      {children}
    </SupplementStateContext.Provider>
  );
}
