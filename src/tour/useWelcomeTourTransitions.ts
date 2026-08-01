import { useCallback, useMemo, type Dispatch } from "react";
import type { EditorWorkspaceSnapshot } from "../editor";
import { trackerReducer, type TrackerAction } from "../tracker/model";
import {
  backWelcomeTour,
  completeWelcomeTourBranch,
  nextWelcomeTourStep,
  satisfyWelcomeTourStep,
  transitionWelcomeTour,
  welcomeTourActionComplete,
} from "./controller";
import type { WelcomeTourBranch, WelcomeTourSessionV1 } from "./model";

export function useWelcomeTourTransitions({
  session,
  sessionRef,
  persist,
}: {
  session: WelcomeTourSessionV1 | null;
  sessionRef: { current: WelcomeTourSessionV1 | null };
  persist: (session: WelcomeTourSessionV1) => void;
}) {
  const actionComplete = useMemo(
    () => (session ? welcomeTourActionComplete(session) : false),
    [session],
  );
  const changeEditorWorkspace = useCallback(
    (workspace: EditorWorkspaceSnapshot) => {
      if (!session) return;
      persist({
        ...session,
        revision: session.revision + 1,
        editorWorkspace: workspace,
      });
    },
    [persist, session],
  );
  const trackerDispatch = useCallback<Dispatch<TrackerAction>>(
    (action) => {
      const current = sessionRef.current;
      if (!current) return;
      const openedBodyMod =
        action.type === "set-supplement-page" && action.value === "body-mod";
      persist({
        ...current,
        revision: current.revision + 1,
        trackerState: trackerReducer(current.trackerState, action),
        navigation: {
          ...current.navigation,
          trackerBodyModOpened:
            current.navigation.trackerBodyModOpened || openedBodyMod,
        },
      });
    },
    [persist, sessionRef],
  );
  const continueTour = useCallback(() => {
    if (!session || !actionComplete) return;
    persist(nextWelcomeTourStep(session));
  }, [actionComplete, persist, session]);
  const skip = useCallback(() => {
    if (!session) return;
    persist(nextWelcomeTourStep(satisfyWelcomeTourStep(session)));
  }, [persist, session]);
  const chooseBranch = useCallback(
    (branch: WelcomeTourBranch) => {
      if (!session) return;
      persist(
        transitionWelcomeTour(
          session,
          branch === "editor" ? "editor-overview" : "tracker-overview",
          { branch },
        ),
      );
    },
    [persist, session],
  );
  const chooseAdvanced = useCallback(
    (advanced: boolean) => {
      if (!session) return;
      const next = { ...session, advancedEditor: advanced };
      persist(
        transitionWelcomeTour(
          next,
          advanced ? "editor-advanced-toggle" : "editor-summary",
        ),
      );
    },
    [persist, session],
  );
  const exit = useCallback(() => {
    if (!session) return;
    persist({
      ...transitionWelcomeTour(session, "mode-choice", {
        branch: null,
        resetHistory: true,
      }),
      pendingOutcome: "dismissed",
    });
  }, [persist, session]);
  const back = useCallback(() => {
    if (session) persist(backWelcomeTour(session));
  }, [persist, session]);
  const finishBranch = useCallback(
    (nextBranch: WelcomeTourBranch | null) => {
      if (session) persist(completeWelcomeTourBranch(session, nextBranch));
    },
    [persist, session],
  );
  const setEditorAdvancedOpen = useCallback(
    (advancedOpen: boolean) => {
      if (!session) return;
      persist({
        ...session,
        revision: session.revision + 1,
        editorAdvancedOpen: advancedOpen,
      });
    },
    [persist, session],
  );
  const recordEditorNavigation = useCallback(
    (destination: "details" | "section" | "files" | "appearance") => {
      if (!session) return;
      persist({
        ...session,
        revision: session.revision + 1,
        navigation: {
          ...session.navigation,
          editorDetailsOpened:
            session.navigation.editorDetailsOpened || destination === "details",
          editorSectionOpened:
            session.navigation.editorSectionOpened || destination === "section",
          editorFilesOpened:
            session.navigation.editorFilesOpened || destination === "files",
          editorAppearanceOpened:
            session.navigation.editorAppearanceOpened ||
            destination === "appearance",
        },
      });
    },
    [persist, session],
  );
  const commands = useMemo(
    () => ({
      changeEditorWorkspace,
      trackerDispatch,
      continue: continueTour,
      skip,
      chooseBranch,
      chooseAdvanced,
      exit,
      back,
      finishBranch,
      setEditorAdvancedOpen,
      recordEditorNavigation,
    }),
    [
      back,
      changeEditorWorkspace,
      chooseAdvanced,
      chooseBranch,
      continueTour,
      exit,
      finishBranch,
      recordEditorNavigation,
      setEditorAdvancedOpen,
      skip,
      trackerDispatch,
    ],
  );

  return { actionComplete, commands } as const;
}
