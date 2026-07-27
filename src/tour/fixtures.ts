import { emptyJumpEntryState } from "../domain";
import { canonicalizePackage, type CanonicalJumpPackage } from "../markup";
import {
  EDITOR_WORKSPACE_SCHEMA_VERSION,
  exactHashForFiles,
  type EditorWorkspaceSnapshot,
} from "../editor";
import { translate } from "../localization";
import { initialBodyModState } from "../supplements/bodyMod";
import { initialEnabled } from "../supplements/model";
import { createBlankTrackerFixture, trackerTags } from "../tracker/fixtures";
import {
  trackerReducer,
  type InstalledPackage,
  type TrackerState,
} from "../tracker/model";
import {
  WELCOME_TOUR_SESSION_SCHEMA_VERSION,
  type WelcomeTourSessionV1,
} from "./model";

export const WELCOME_TOUR_EDITOR_ID = "welcome-tour-editor";
export const WELCOME_TOUR_CHAIN_ID = "welcome-tour-chain";
export const WELCOME_TOUR_PACKAGE_ID = "welcome-tour-crossroads";
export const WELCOME_TOUR_PROLOGUE_PACKAGE_ID = "welcome-tour-trailhead";

function packageFromFiles(
  id: string,
  files: Record<string, string>,
): CanonicalJumpPackage {
  return canonicalizePackage({
    id,
    logicalId: id,
    source: "builtin",
    exactHash: exactHashForFiles(files),
    files,
  });
}

function installedPackage(
  id: string,
  document: CanonicalJumpPackage,
): InstalledPackage {
  return {
    id,
    logicalId: id,
    name: document.name.base ?? id,
    version: document.version,
    source: "builtin",
    description: document.description,
    tags: document.tags,
    availability: "library",
    exactHash: document.exactHash,
    authors: document.authors,
    nativeGauntlet: document.nativeGauntlet,
    document,
    assets: {},
  };
}

function tutorialJumpFiles() {
  return {
    "jump.jdef": `jump
  format: 1
  name: ${JSON.stringify(translate("tour.fixture.crossroadsName"))}
  description: ${JSON.stringify(translate("tour.fixture.crossroadsDescription"))}
  author: ${JSON.stringify(translate("tour.fixture.author"))}
  version: "1.0"
  starting-points: 500
  points-name: ${JSON.stringify(translate("tour.fixture.pointsName"))}
  points-abbreviation: "CP"

section
  handle: first_steps
  name: ${JSON.stringify(translate("tour.fixture.sectionName"))}

  choice
    handle: route
    target: route

  choice
    handle: field_training
    target: field_training

  choice
    handle: travel_pack
    target: travel_pack

  text
    handle: welcome
    content: ${JSON.stringify(translate("tour.fixture.sectionText"))}
`,
    "choices.jdef": `choice
  handle: route
  name: ${JSON.stringify(translate("tour.fixture.routeName"))}
  selection: select
  option: ${JSON.stringify(translate("tour.fixture.routeForest"))}
  option: ${JSON.stringify(translate("tour.fixture.routeCoast"))}

choice
  handle: field_training
  name: ${JSON.stringify(translate("tour.fixture.trainingName"))}
  cost: 100
  grant: perk

choice
  handle: travel_pack
  name: ${JSON.stringify(translate("tour.fixture.packName"))}
  cost: 50
  grant: item
`,
    "layout.jdef": "jump-appearance\n",
  };
}

function prologueFiles() {
  return {
    "jump.jdef": `jump
  format: 1
  name: ${JSON.stringify(translate("tour.fixture.trailheadName"))}
  description: ${JSON.stringify(translate("tour.fixture.trailheadDescription"))}
  author: ${JSON.stringify(translate("tour.fixture.author"))}
  version: "1.0"

section
  handle: prologue
  name: ${JSON.stringify(translate("tour.fixture.prologueName"))}

  text
    handle: note
    content: ${JSON.stringify(translate("tour.fixture.prologueText"))}
`,
    "choices.jdef": "",
    "layout.jdef": "jump-appearance\n",
  };
}

export function createWelcomeTourEditorWorkspace(
  now = new Date().toISOString(),
): EditorWorkspaceSnapshot {
  return {
    schemaVersion: EDITOR_WORKSPACE_SCHEMA_VERSION,
    id: WELCOME_TOUR_EDITOR_ID,
    location: "browser",
    files: {
      "jump.jdef": `jump
  format: 1
  name: ${JSON.stringify(translate("tour.fixture.editorName"))}
  description: ${JSON.stringify(translate("tour.fixture.editorDescription"))}
  author: ${JSON.stringify(translate("tour.fixture.author"))}
  version: "0.1"
  starting-points: 500
  points-name: ${JSON.stringify(translate("tour.fixture.pointsName"))}
  points-abbreviation: "CP"

section
  handle: first_steps
  name: ${JSON.stringify(translate("tour.fixture.sectionName"))}

  text
    handle: welcome
    content: ${JSON.stringify(translate("tour.fixture.sectionText"))}
`,
      "choices.jdef": `# ${translate("tour.fixture.editorChoicesComment")}\n`,
      "layout.jdef": "jump-appearance\n",
    },
    assets: {},
    assetEditorDocuments: {},
    trash: [],
    starred: false,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    revision: 0,
  };
}

export function createWelcomeTourTrackerState(): TrackerState {
  const base = createBlankTrackerFixture(translate("tour.fixture.chainName"));
  const tutorial = installedPackage(
    WELCOME_TOUR_PACKAGE_ID,
    packageFromFiles(WELCOME_TOUR_PACKAGE_ID, tutorialJumpFiles()),
  );
  const prologue = installedPackage(
    WELCOME_TOUR_PROLOGUE_PACKAGE_ID,
    packageFromFiles(WELCOME_TOUR_PROLOGUE_PACKAGE_ID, prologueFiles()),
  );
  const earth = base.packages[base.entries[base.order[0]].packageId];
  const clean: TrackerState = {
    ...base,
    packages: {
      [earth.id]: earth,
      [prologue.id]: prologue,
      [tutorial.id]: tutorial,
    },
    tags: trackerTags,
    enabledSupplements: Object.fromEntries(
      Object.keys(initialEnabled).map((id) => [id, false]),
    ) as TrackerState["enabledSupplements"],
    bodyMod: structuredClone(initialBodyModState),
    preferences: {
      ...base.preferences,
      showMockData: false,
      allowDuplicateJumps: false,
      allowMultiplePackageVersions: false,
      warnUpstreamChanges: false,
    },
  };
  const withPrologue = trackerReducer(clean, {
    type: "add-package",
    packageId: prologue.id,
  });
  return {
    ...withPrologue,
    selectedEntryId: withPrologue.order[0],
    inspectionPointId: withPrologue.order[0],
    railPage: "chain",
    page: "jump",
    jumpState: {
      ...withPrologue.jumpState,
      [withPrologue.order[1]]:
        withPrologue.jumpState[withPrologue.order[1]] ?? emptyJumpEntryState(),
    },
  };
}

export function createWelcomeTourSession(
  returnPath = "/",
  restartedFromSettings = false,
): WelcomeTourSessionV1 {
  return {
    schemaVersion: WELCOME_TOUR_SESSION_SCHEMA_VERSION,
    revision: 0,
    stepId: "welcome",
    history: [],
    activeBranch: null,
    completedBranches: [],
    advancedEditor: false,
    editorAdvancedOpen: false,
    navigation: {
      editorDetailsOpened: false,
      editorSectionOpened: false,
      editorFilesOpened: false,
      editorAppearanceOpened: false,
      trackerBodyModOpened: false,
    },
    pendingOutcome: null,
    restartedFromSettings,
    returnPath: returnPath.startsWith("/") ? returnPath : "/",
    editorWorkspace: createWelcomeTourEditorWorkspace(),
    trackerState: createWelcomeTourTrackerState(),
    checkpoints: {},
  };
}
