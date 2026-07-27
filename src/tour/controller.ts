import { canonicalWorkspace } from "../editor";
import { translate } from "../localization";
import { initialBodyModState } from "../supplements/bodyMod";
import { trackerReducer, type TrackerState } from "../tracker/model";
import {
  WELCOME_TOUR_PACKAGE_ID,
  WELCOME_TOUR_PROLOGUE_PACKAGE_ID,
} from "./fixtures";
import type {
  WelcomeTourBranch,
  WelcomeTourSessionV1,
  WelcomeTourStepId,
} from "./model";
import {
  editorAdvancedStepOrder,
  editorCoreStepOrder,
  rootStepOrder,
  trackerStepOrder,
  welcomeTourSteps,
} from "./steps";

const clone = <T>(value: T): T => structuredClone(value);

function snapshot(session: WelcomeTourSessionV1) {
  return {
    editorWorkspace: clone(session.editorWorkspace),
    trackerState: clone(session.trackerState),
    navigation: clone(session.navigation),
  };
}

export function transitionWelcomeTour(
  session: WelcomeTourSessionV1,
  stepId: WelcomeTourStepId,
  options: {
    branch?: WelcomeTourBranch | null;
    resetHistory?: boolean;
  } = {},
): WelcomeTourSessionV1 {
  return {
    ...session,
    revision: session.revision + 1,
    stepId,
    activeBranch:
      options.branch === undefined ? session.activeBranch : options.branch,
    history: options.resetHistory ? [] : [...session.history, session.stepId],
    checkpoints: {
      ...session.checkpoints,
      [stepId]: snapshot(session),
    },
  };
}

export function backWelcomeTour(
  session: WelcomeTourSessionV1,
): WelcomeTourSessionV1 {
  const previous = session.history.at(-1);
  if (!previous) return session;
  const checkpoint = session.checkpoints[previous];
  return {
    ...session,
    revision: session.revision + 1,
    stepId: previous,
    activeBranch: welcomeTourSteps[previous].branch,
    history: session.history.slice(0, -1),
    ...(checkpoint?.editorWorkspace
      ? { editorWorkspace: clone(checkpoint.editorWorkspace) }
      : {}),
    ...(checkpoint?.trackerState
      ? { trackerState: clone(checkpoint.trackerState) }
      : {}),
    ...(checkpoint?.navigation
      ? { navigation: clone(checkpoint.navigation) }
      : {}),
  };
}

export function nextWelcomeTourStep(
  session: WelcomeTourSessionV1,
): WelcomeTourSessionV1 {
  const { stepId } = session;
  const prepared =
    stepId === "tracker-open-body-mod"
      ? {
          ...session,
          trackerState: trackerReducer(session.trackerState, {
            type: "set-supplement-page",
            value: "body-mod",
          }),
        }
      : session;
  const nextIn = (order: readonly WelcomeTourStepId[]) => {
    const index = order.indexOf(stepId);
    return index >= 0 ? order[index + 1] : undefined;
  };
  const next =
    nextIn(rootStepOrder) ??
    nextIn(editorCoreStepOrder) ??
    nextIn(editorAdvancedStepOrder) ??
    nextIn(trackerStepOrder);
  if (next) return transitionWelcomeTour(prepared, next);
  if (stepId === "editor-advanced-export")
    return transitionWelcomeTour(prepared, "editor-summary");
  if (stepId === "tracker-use-body-mod")
    return transitionWelcomeTour(prepared, "tracker-summary");
  return prepared;
}

function tutorialEntryId(state: TrackerState) {
  return state.order.find(
    (id) => state.entries[id]?.packageId === WELCOME_TOUR_PACKAGE_ID,
  );
}

function prologueEntryId(state: TrackerState) {
  return state.order.find(
    (id) => state.entries[id]?.packageId === WELCOME_TOUR_PROLOGUE_PACKAGE_ID,
  );
}

function tutorialActorChoices(state: TrackerState) {
  const entryId = tutorialEntryId(state);
  return entryId ? state.jumpState[entryId]?.actors.jumper?.choices : undefined;
}

function editorChoice(session: WelcomeTourSessionV1) {
  try {
    return canonicalWorkspace(session.editorWorkspace).choices[0];
  } catch {
    return undefined;
  }
}

export function welcomeTourActionComplete(
  session: WelcomeTourSessionV1,
): boolean {
  const state = session.trackerState;
  const tutorialId = tutorialEntryId(state);
  const prologueId = prologueEntryId(state);
  const choices = tutorialActorChoices(state);
  switch (session.stepId) {
    case "editor-open-details":
      return session.navigation.editorDetailsOpened;
    case "editor-add-choice":
      return Boolean(editorChoice(session));
    case "editor-configure-choice": {
      const choice = editorChoice(session);
      return Boolean(
        choice?.handle &&
        choice.handle !== "new_choice" &&
        choice.name.base?.trim() &&
        choice.name.base !==
          translate("ui.editorWorkspace.starter.newChoiceName"),
      );
    }
    case "editor-open-section":
      return session.navigation.editorSectionOpened;
    case "editor-place-choice": {
      const handle = editorChoice(session)?.handle;
      return Boolean(
        handle &&
        new RegExp(
          `\\btarget:\\s*${handle.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`,
        ).test(session.editorWorkspace.files["jump.jdef"] ?? ""),
      );
    }
    case "editor-advanced-toggle":
      return session.editorAdvancedOpen;
    case "editor-advanced-tabs":
      return session.navigation.editorFilesOpened;
    case "editor-advanced-appearance":
      return session.navigation.editorAppearanceOpened;
    case "tracker-library":
      return state.railPage === "library";
    case "tracker-add-jump":
      return Boolean(tutorialId);
    case "tracker-route-choice":
      return typeof choices?.route === "string" && Boolean(choices.route);
    case "tracker-perk-choice":
      return choices?.field_training === true;
    case "tracker-item-choice":
      return choices?.travel_pack === true;
    case "tracker-reorder":
      return Boolean(
        tutorialId &&
        prologueId &&
        state.order.indexOf(tutorialId) < state.order.indexOf(prologueId),
      );
    case "tracker-inventory":
      return state.page === "inventory";
    case "tracker-supplements":
      return state.page === "supplements";
    case "tracker-enable-body-mod":
      return state.enabledSupplements["body-mod"];
    case "tracker-open-body-mod":
      return session.navigation.trackerBodyModOpened;
    case "tracker-use-body-mod":
      return (
        state.bodyMod.build !== initialBodyModState.build ||
        state.bodyMod.type !== initialBodyModState.type
      );
    default:
      return true;
  }
}

function skipEditorAction(session: WelcomeTourSessionV1): WelcomeTourSessionV1 {
  const workspace = clone(session.editorWorkspace);
  if (session.stepId === "editor-add-choice" && !editorChoice(session)) {
    workspace.files["choices.jdef"] =
      `${workspace.files["choices.jdef"] ?? ""}\nchoice\n  handle: new_choice\n  name: ${JSON.stringify(
        translate("ui.editorWorkspace.starter.newChoiceName"),
      )}\n  selection: toggle\n`;
  }
  if (session.stepId === "editor-configure-choice") {
    workspace.files["choices.jdef"] = (workspace.files["choices.jdef"] ?? "")
      .replace(/\bnew_choice\b/g, "road_companion")
      .replace(
        JSON.stringify(translate("ui.editorWorkspace.starter.newChoiceName")),
        JSON.stringify(translate("tour.fixture.guidedChoiceName")),
      );
  }
  if (session.stepId === "editor-place-choice") {
    const handle = editorChoice(session)?.handle ?? "road_companion";
    const source = workspace.files["jump.jdef"] ?? "";
    if (!new RegExp(`\\btarget:\\s*${handle}\\b`).test(source))
      workspace.files["jump.jdef"] = source.replace(
        /(\nsection\n {2}handle: first_steps\n {2}name: [^\n]+\n)/,
        `$1\n  choice\n    handle: ${handle}_placement\n    target: ${handle}\n`,
      );
  }
  workspace.revision += 1;
  workspace.updatedAt = new Date().toISOString();
  return {
    ...session,
    revision: session.revision + 1,
    editorWorkspace: workspace,
    editorAdvancedOpen:
      session.stepId === "editor-advanced-toggle"
        ? true
        : session.editorAdvancedOpen,
    navigation: {
      ...session.navigation,
      editorDetailsOpened:
        session.stepId === "editor-open-details" ||
        session.navigation.editorDetailsOpened,
      editorSectionOpened:
        session.stepId === "editor-open-section" ||
        session.navigation.editorSectionOpened,
      editorFilesOpened:
        session.stepId === "editor-advanced-tabs" ||
        session.navigation.editorFilesOpened,
      editorAppearanceOpened:
        session.stepId === "editor-advanced-appearance" ||
        session.navigation.editorAppearanceOpened,
    },
  };
}

function skipTrackerAction(
  session: WelcomeTourSessionV1,
): WelcomeTourSessionV1 {
  let state = session.trackerState;
  const entryId = tutorialEntryId(state);
  switch (session.stepId) {
    case "tracker-library":
      state = trackerReducer(state, { type: "set-rail-page", page: "library" });
      break;
    case "tracker-add-jump":
      state = trackerReducer(state, {
        type: "add-package",
        packageId: WELCOME_TOUR_PACKAGE_ID,
      });
      break;
    case "tracker-route-choice":
      if (entryId)
        state = trackerReducer(state, {
          type: "set-choice",
          entryId,
          actorId: "jumper",
          choiceHandle: "route",
          value: translate("tour.fixture.routeForest"),
        });
      break;
    case "tracker-perk-choice":
      if (entryId)
        state = trackerReducer(state, {
          type: "set-choice",
          entryId,
          actorId: "jumper",
          choiceHandle: "field_training",
          value: true,
        });
      break;
    case "tracker-item-choice":
      if (entryId)
        state = trackerReducer(state, {
          type: "set-choice",
          entryId,
          actorId: "jumper",
          choiceHandle: "travel_pack",
          value: true,
        });
      break;
    case "tracker-reorder":
      if (entryId)
        state = trackerReducer(state, {
          type: "request-move",
          entryId,
          toIndex: 1,
        });
      break;
    case "tracker-inventory":
      state = trackerReducer(state, { type: "set-page", page: "inventory" });
      break;
    case "tracker-supplements":
      state = trackerReducer(state, {
        type: "set-page",
        page: "supplements",
      });
      break;
    case "tracker-enable-body-mod":
      state = trackerReducer(state, {
        type: "set-enabled-supplements",
        value: { ...state.enabledSupplements, "body-mod": true },
      });
      state = trackerReducer(state, {
        type: "set-supplement-page",
        value: "body-mod",
      });
      break;
    case "tracker-open-body-mod":
      state = trackerReducer(state, {
        type: "set-supplement-page",
        value: "body-mod",
      });
      break;
    case "tracker-use-body-mod":
      state = trackerReducer(state, {
        type: "set-body-mod",
        value: { ...state.bodyMod, build: "Heavy", type: "Bodybuilder" },
      });
      break;
  }
  return {
    ...session,
    revision: session.revision + 1,
    trackerState: state,
    navigation: {
      ...session.navigation,
      trackerBodyModOpened:
        session.stepId === "tracker-open-body-mod" ||
        session.navigation.trackerBodyModOpened,
    },
  };
}

export function satisfyWelcomeTourStep(
  session: WelcomeTourSessionV1,
): WelcomeTourSessionV1 {
  if (session.stepId.startsWith("editor-")) return skipEditorAction(session);
  if (session.stepId.startsWith("tracker-")) return skipTrackerAction(session);
  return session;
}

export function completeWelcomeTourBranch(
  session: WelcomeTourSessionV1,
  nextBranch: WelcomeTourBranch | null,
): WelcomeTourSessionV1 {
  const branch = session.activeBranch;
  const completedBranches =
    branch && !session.completedBranches.includes(branch)
      ? [...session.completedBranches, branch]
      : session.completedBranches;
  const next = { ...session, completedBranches };
  if (nextBranch)
    return transitionWelcomeTour(
      next,
      nextBranch === "editor" ? "editor-overview" : "tracker-overview",
      { branch: nextBranch, resetHistory: true },
    );
  return {
    ...transitionWelcomeTour(next, "mode-choice", {
      branch: null,
      resetHistory: true,
    }),
    pendingOutcome: "completed",
  };
}
