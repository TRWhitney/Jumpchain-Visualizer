import type { ModuleId, ToolId } from "./model";

export const supplementTools: readonly {
  id: ToolId;
  module: ModuleId;
  name: string;
  job: string;
}[] = [
  {
    id: "body",
    module: "body-mod",
    name: "Classic Body Mod",
    job: "At a glance",
  },
  {
    id: "essential",
    module: "essential-body-mod",
    name: "Essential Body Mod",
    job: "At a glance",
  },
  {
    id: "essential-progress",
    module: "essential-body-mod",
    name: "Essential Body Mod",
    job: "Progression",
  },
  {
    id: "warehouse",
    module: "warehouse",
    name: "Cosmic Warehouse",
    job: "At a glance",
  },
  {
    id: "reality",
    module: "personal-reality",
    name: "Personal Reality",
    job: "At a glance",
  },
  {
    id: "reality-progress",
    module: "personal-reality",
    name: "Personal Reality",
    job: "Spend new points",
  },
  {
    id: "drawbacks",
    module: "universal-drawbacks",
    name: "Universal Drawbacks",
    job: "Current effects",
  },
  {
    id: "quests",
    module: "quest-mode",
    name: "Quest Mode",
    job: "Quest checklist",
  },
  { id: "story", module: "story", name: "Story", job: "Write this Jump" },
];
