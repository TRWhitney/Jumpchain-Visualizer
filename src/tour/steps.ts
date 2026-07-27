import type { WelcomeTourBranch, WelcomeTourStepId } from "./model";

export type WelcomeTourStep = {
  id: WelcomeTourStepId;
  section: "welcome" | "home" | "editor" | "tracker" | "finish";
  branch: WelcomeTourBranch | null;
  target: string | null;
  completedTarget?: string;
  action: boolean;
};

export const welcomeTourSteps: Record<WelcomeTourStepId, WelcomeTourStep> = {
  welcome: {
    id: "welcome",
    section: "welcome",
    branch: null,
    target: null,
    action: false,
  },
  "home-navigation": {
    id: "home-navigation",
    section: "home",
    branch: null,
    target: "app-navigation",
    action: false,
  },
  "home-workspaces": {
    id: "home-workspaces",
    section: "home",
    branch: null,
    target: "home-workspaces",
    action: false,
  },
  "choose-branch": {
    id: "choose-branch",
    section: "home",
    branch: null,
    target: null,
    action: false,
  },
  "editor-overview": {
    id: "editor-overview",
    section: "editor",
    branch: "editor",
    target: null,
    action: false,
  },
  "editor-open-details": {
    id: "editor-open-details",
    section: "editor",
    branch: "editor",
    target: "editor-navigation-details",
    action: true,
  },
  "editor-metadata": {
    id: "editor-metadata",
    section: "editor",
    branch: "editor",
    target: "editor-jump-details",
    action: false,
  },
  "editor-add-choice": {
    id: "editor-add-choice",
    section: "editor",
    branch: "editor",
    target: "editor-add",
    action: true,
  },
  "editor-configure-choice": {
    id: "editor-configure-choice",
    section: "editor",
    branch: "editor",
    target: "editor-choice-fields",
    action: true,
  },
  "editor-open-section": {
    id: "editor-open-section",
    section: "editor",
    branch: "editor",
    target: "editor-navigation-section",
    action: true,
  },
  "editor-place-choice": {
    id: "editor-place-choice",
    section: "editor",
    branch: "editor",
    target: "editor-section-content",
    action: true,
  },
  "editor-preview": {
    id: "editor-preview",
    section: "editor",
    branch: "editor",
    target: "editor-preview",
    action: false,
  },
  "editor-advanced-offer": {
    id: "editor-advanced-offer",
    section: "editor",
    branch: "editor",
    target: null,
    action: false,
  },
  "editor-advanced-toggle": {
    id: "editor-advanced-toggle",
    section: "editor",
    branch: "editor",
    target: "editor-advanced-toggle",
    action: true,
  },
  "editor-advanced-tabs": {
    id: "editor-advanced-tabs",
    section: "editor",
    branch: "editor",
    target: "editor-advanced-tabs",
    action: true,
  },
  "editor-advanced-appearance": {
    id: "editor-advanced-appearance",
    section: "editor",
    branch: "editor",
    target: "editor-navigation-appearance",
    action: true,
  },
  "editor-advanced-export": {
    id: "editor-advanced-export",
    section: "editor",
    branch: "editor",
    target: "editor-export",
    action: false,
  },
  "editor-summary": {
    id: "editor-summary",
    section: "editor",
    branch: "editor",
    target: null,
    action: false,
  },
  "tracker-overview": {
    id: "tracker-overview",
    section: "tracker",
    branch: "tracker",
    target: null,
    action: false,
  },
  "tracker-library": {
    id: "tracker-library",
    section: "tracker",
    branch: "tracker",
    target: "tracker-library-tab",
    action: true,
  },
  "tracker-add-jump": {
    id: "tracker-add-jump",
    section: "tracker",
    branch: "tracker",
    target: "tracker-add-tutorial",
    completedTarget: "tracker-selected-entry",
    action: true,
  },
  "tracker-route-choice": {
    id: "tracker-route-choice",
    section: "tracker",
    branch: "tracker",
    target: "tracker-choice-route",
    action: true,
  },
  "tracker-perk-choice": {
    id: "tracker-perk-choice",
    section: "tracker",
    branch: "tracker",
    target: "tracker-choice-perk",
    action: true,
  },
  "tracker-item-choice": {
    id: "tracker-item-choice",
    section: "tracker",
    branch: "tracker",
    target: "tracker-choice-item",
    action: true,
  },
  "tracker-reorder": {
    id: "tracker-reorder",
    section: "tracker",
    branch: "tracker",
    target: "tracker-chain-list",
    action: true,
  },
  "tracker-inventory": {
    id: "tracker-inventory",
    section: "tracker",
    branch: "tracker",
    target: "tracker-inventory-tab",
    action: true,
  },
  "tracker-inventory-result": {
    id: "tracker-inventory-result",
    section: "tracker",
    branch: "tracker",
    target: "tracker-inventory-tutorial-results",
    action: false,
  },
  "tracker-supplements": {
    id: "tracker-supplements",
    section: "tracker",
    branch: "tracker",
    target: "tracker-supplements-tab",
    action: true,
  },
  "tracker-enable-body-mod": {
    id: "tracker-enable-body-mod",
    section: "tracker",
    branch: "tracker",
    target: "tracker-enable-body-mod",
    action: true,
  },
  "tracker-open-body-mod": {
    id: "tracker-open-body-mod",
    section: "tracker",
    branch: "tracker",
    target: "tracker-enable-body-mod",
    completedTarget: "tracker-use-body-mod",
    action: true,
  },
  "tracker-use-body-mod": {
    id: "tracker-use-body-mod",
    section: "tracker",
    branch: "tracker",
    target: "tracker-use-body-mod",
    action: true,
  },
  "tracker-summary": {
    id: "tracker-summary",
    section: "tracker",
    branch: "tracker",
    target: null,
    action: false,
  },
  "mode-choice": {
    id: "mode-choice",
    section: "finish",
    branch: null,
    target: null,
    action: false,
  },
};

export const rootStepOrder: WelcomeTourStepId[] = [
  "welcome",
  "home-navigation",
  "home-workspaces",
  "choose-branch",
];

export const editorCoreStepOrder: WelcomeTourStepId[] = [
  "editor-overview",
  "editor-open-details",
  "editor-metadata",
  "editor-add-choice",
  "editor-configure-choice",
  "editor-open-section",
  "editor-place-choice",
  "editor-preview",
  "editor-advanced-offer",
];

export const editorAdvancedStepOrder: WelcomeTourStepId[] = [
  "editor-advanced-toggle",
  "editor-advanced-tabs",
  "editor-advanced-appearance",
  "editor-advanced-export",
];

export const trackerStepOrder: WelcomeTourStepId[] = [
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
];

export function progressForStep(stepId: WelcomeTourStepId) {
  const editor = [...editorCoreStepOrder, ...editorAdvancedStepOrder];
  const section = welcomeTourSteps[stepId].section;
  const order =
    section === "home" || section === "welcome"
      ? rootStepOrder
      : section === "editor"
        ? editor
        : section === "tracker"
          ? trackerStepOrder
          : ["mode-choice" as const];
  const index = Math.max(0, order.indexOf(stepId));
  return { current: index + 1, total: order.length };
}
