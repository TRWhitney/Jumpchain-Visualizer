import { useContext } from "react";
import { BodyModContext } from "./bodyModContextDefinition";

export function useBodyMod() {
  const value = useContext(BodyModContext);
  if (!value) throw new Error("useBodyMod must be used within BodyModProvider");
  return value;
}
