import type { ModuleId, ToolId } from "./model";
import { translate } from "../localization";

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
  {
    id: "limited-inheritance",
    module: "limited-inheritance",
    get name() {
      return translate("ui.limitedInheritance.name");
    },
    get job() {
      return translate("ui.limitedInheritance.contextualJob");
    },
  },
];
