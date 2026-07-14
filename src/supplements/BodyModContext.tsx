import { type ReactNode, useState } from "react";
import {
  changeBodyModType,
  freePerks,
  freeStats,
  initialBodyModState,
} from "./bodyMod";
import { BodyModContext } from "./bodyModContextDefinition";

export function BodyModProvider({
  children,
  state: controlledState,
  onChange,
}: {
  children: ReactNode;
  state?: import("./bodyMod").BodyModState;
  onChange?: (value: import("./bodyMod").BodyModState) => void;
}) {
  const [localState, setLocalState] = useState(initialBodyModState);
  const state = controlledState ?? localState;
  const setState = (
    update: (
      current: import("./bodyMod").BodyModState,
    ) => import("./bodyMod").BodyModState,
  ) => {
    const next = update(state);
    if (onChange) onChange(next);
    else setLocalState(next);
  };
  return (
    <BodyModContext.Provider
      value={{
        state,
        setBuild: (build) => setState((current) => ({ ...current, build })),
        setBody: (type) =>
          setState((current) => changeBodyModType(current, type)),
        setAnimal: (animal) => setState((current) => ({ ...current, animal })),
        setBestialTier: (bestialTier) =>
          setState((current) => ({ ...current, bestialTier })),
        setBestialStat: (bestialStat) =>
          setState((current) => ({ ...current, bestialStat })),
        setStat: (name, value) =>
          setState((current) => ({
            ...current,
            purchasedStats: {
              ...current.purchasedStats,
              [name]: Math.max(0, value - (freeStats(current)[name] ?? 0)),
            },
          })),
        setPerk: (name, value) =>
          setState((current) => ({
            ...current,
            purchasedPerks: {
              ...current.purchasedPerks,
              [name]: Math.max(0, value - (freePerks(current)[name] ?? 0)),
            },
          })),
      }}
    >
      {children}
    </BodyModContext.Provider>
  );
}
