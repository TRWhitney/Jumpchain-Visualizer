import type { EditorWorkspaceSnapshot } from "../editor";
import type { TrackerState } from "../tracker/model";

export const WELCOME_TOUR_SESSION_SCHEMA_VERSION = 1;

export const welcomeTourStepIds = [
  "welcome",
  "home-navigation",
  "home-workspaces",
  "choose-branch",
  "editor-overview",
  "editor-open-details",
  "editor-metadata",
  "editor-add-choice",
  "editor-configure-choice",
  "editor-open-section",
  "editor-place-choice",
  "editor-preview",
  "editor-advanced-offer",
  "editor-advanced-toggle",
  "editor-advanced-tabs",
  "editor-advanced-appearance",
  "editor-advanced-export",
  "editor-summary",
  "tracker-overview",
  "tracker-library",
  "tracker-add-jump",
  "tracker-route-choice",
  "tracker-perk-choice",
  "tracker-item-choice",
  "tracker-reorder",
  "tracker-inventory",
  "tracker-inventory-result",
  "tracker-supplements",
  "tracker-enable-body-mod",
  "tracker-open-body-mod",
  "tracker-use-body-mod",
  "tracker-summary",
  "mode-choice",
] as const;

export type WelcomeTourStepId = (typeof welcomeTourStepIds)[number];
export type WelcomeTourBranch = "editor" | "tracker";
export type WelcomeTourOutcome = "completed" | "dismissed";
export type WelcomeTourNavigation = {
  editorDetailsOpened: boolean;
  editorSectionOpened: boolean;
  editorFilesOpened: boolean;
  editorAppearanceOpened: boolean;
  trackerBodyModOpened: boolean;
};

export type WelcomeTourSnapshot = {
  editorWorkspace?: EditorWorkspaceSnapshot;
  trackerState?: TrackerState;
  navigation?: WelcomeTourNavigation;
};

export type WelcomeTourSessionV1 = {
  schemaVersion: 1;
  revision: number;
  stepId: WelcomeTourStepId;
  history: WelcomeTourStepId[];
  activeBranch: WelcomeTourBranch | null;
  completedBranches: WelcomeTourBranch[];
  advancedEditor: boolean;
  editorAdvancedOpen: boolean;
  navigation: WelcomeTourNavigation;
  pendingOutcome: WelcomeTourOutcome | null;
  restartedFromSettings: boolean;
  returnPath: string;
  editorWorkspace: EditorWorkspaceSnapshot;
  trackerState: TrackerState;
  checkpoints: Partial<Record<WelcomeTourStepId, WelcomeTourSnapshot>>;
};

const stepIdSet = new Set<string>(welcomeTourStepIds);
const branchSet = new Set<string>(["editor", "tracker"]);
const expectedEditorFiles = new Set([
  "jump.jdef",
  "choices.jdef",
  "layout.jdef",
]);
const expectedPackageIds = new Set([
  "system-earth",
  "welcome-tour-trailhead",
  "welcome-tour-crossroads",
]);

export function isWelcomeTourStepId(
  value: unknown,
): value is WelcomeTourStepId {
  return typeof value === "string" && stepIdSet.has(value);
}

export function isWelcomeTourSession(
  value: unknown,
): value is WelcomeTourSessionV1 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WelcomeTourSessionV1>;
  const editor = candidate.editorWorkspace as
    Partial<EditorWorkspaceSnapshot> | undefined;
  const tracker = candidate.trackerState as Partial<TrackerState> | undefined;
  const editorFiles =
    editor?.files && typeof editor.files === "object"
      ? Object.entries(editor.files)
      : [];
  const trackerPackages =
    tracker?.packages && typeof tracker.packages === "object"
      ? Object.keys(tracker.packages)
      : [];
  const checkpointKeys =
    candidate.checkpoints && typeof candidate.checkpoints === "object"
      ? Object.keys(candidate.checkpoints)
      : [];
  return (
    candidate.schemaVersion === WELCOME_TOUR_SESSION_SCHEMA_VERSION &&
    typeof candidate.revision === "number" &&
    Number.isSafeInteger(candidate.revision) &&
    candidate.revision >= 0 &&
    isWelcomeTourStepId(candidate.stepId) &&
    Array.isArray(candidate.history) &&
    candidate.history.length <= 100 &&
    candidate.history.every(isWelcomeTourStepId) &&
    (candidate.activeBranch === null ||
      (typeof candidate.activeBranch === "string" &&
        branchSet.has(candidate.activeBranch))) &&
    Array.isArray(candidate.completedBranches) &&
    new Set(candidate.completedBranches).size ===
      candidate.completedBranches.length &&
    candidate.completedBranches.every(
      (branch) => typeof branch === "string" && branchSet.has(branch),
    ) &&
    typeof candidate.advancedEditor === "boolean" &&
    typeof candidate.editorAdvancedOpen === "boolean" &&
    Boolean(candidate.navigation) &&
    typeof candidate.navigation === "object" &&
    Object.values(candidate.navigation).length === 5 &&
    Object.values(candidate.navigation).every(
      (completed) => typeof completed === "boolean",
    ) &&
    (candidate.pendingOutcome === null ||
      candidate.pendingOutcome === "completed" ||
      candidate.pendingOutcome === "dismissed") &&
    typeof candidate.restartedFromSettings === "boolean" &&
    typeof candidate.returnPath === "string" &&
    candidate.returnPath.length <= 2048 &&
    candidate.returnPath.startsWith("/") &&
    editor?.id === "welcome-tour-editor" &&
    editorFiles.length === expectedEditorFiles.size &&
    editorFiles.every(
      ([file, source]) =>
        expectedEditorFiles.has(file) &&
        typeof source === "string" &&
        source.length <= 256 * 1024,
    ) &&
    Boolean(tracker) &&
    trackerPackages.length === expectedPackageIds.size &&
    trackerPackages.every((id) => expectedPackageIds.has(id)) &&
    Array.isArray(tracker?.order) &&
    tracker.order.length >= 2 &&
    tracker.order.length <= 3 &&
    Boolean(tracker?.entries) &&
    tracker.order.every((id) => {
      const entry = tracker.entries?.[id];
      return (
        Boolean(entry) &&
        typeof entry?.packageId === "string" &&
        expectedPackageIds.has(entry.packageId)
      );
    }) &&
    Boolean(candidate.checkpoints) &&
    typeof candidate.checkpoints === "object" &&
    checkpointKeys.every(isWelcomeTourStepId)
  );
}
