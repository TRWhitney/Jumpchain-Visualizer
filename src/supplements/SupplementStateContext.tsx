import { useMemo, useReducer, type ReactNode } from "react";
import { initialSupplementState, supplementReducer } from "./supplementState";
import { SupplementStateContext } from "./supplementStateContextDefinition";
export function SupplementStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    supplementReducer,
    initialSupplementState,
  );
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <SupplementStateContext.Provider value={value}>
      {children}
    </SupplementStateContext.Provider>
  );
}
