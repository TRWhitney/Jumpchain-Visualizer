import { createContext } from "react";
import type {
  BodyModPerk,
  BodyModState,
  BodyModStat,
  BodyModType,
} from "./bodyMod";

export type BodyModContextValue = {
  state: BodyModState;
  setBuild: (build: string) => void;
  setBody: (type: BodyModType) => void;
  setAnimal: (animal: string) => void;
  setBestialTier: (tier: number) => void;
  setBestialStat: (stat: BodyModStat) => void;
  setStat: (stat: BodyModStat, total: number) => void;
  setPerk: (perk: BodyModPerk, total: number) => void;
};

export const BodyModContext = createContext<BodyModContextValue | null>(null);
