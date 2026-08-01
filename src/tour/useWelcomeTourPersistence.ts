import { useCallback, useMemo, useRef, useState } from "react";
import type { EventPipeline } from "../settings/logging";
import type { WelcomeTourSessionV1 } from "./model";
import {
  createWelcomeTourSessionRepository,
  stageWelcomeTourSession,
} from "./repository";

export function useWelcomeTourPersistence(logger: EventPipeline) {
  const repository = useMemo(() => createWelcomeTourSessionRepository(), []);
  const [session, setSession] = useState<WelcomeTourSessionV1 | null>(null);
  const sessionRef = useRef<WelcomeTourSessionV1 | null>(null);
  const saveQueue = useRef(Promise.resolve());

  const persist = useCallback(
    (next: WelcomeTourSessionV1) => {
      stageWelcomeTourSession(next);
      sessionRef.current = next;
      setSession(next);
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => repository.save(next))
        .catch((error: unknown) => {
          logger.emit("storage.write_failed", {
            attributes: {
              aggregate: "welcome-tour",
              errorCode: "WELCOME_TOUR_WRITE_FAILED",
            },
            error,
          });
        });
    },
    [logger, repository],
  );

  return {
    repository,
    session,
    setSession,
    sessionRef,
    saveQueue,
    persist,
  };
}
