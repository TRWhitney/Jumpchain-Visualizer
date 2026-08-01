import { useCallback, useState } from "react";

export type DeletionTarget =
  | { kind: "chain"; id: string; name: string }
  | { kind: "editor"; id: string; name: string };

export function deletionFailureMessage(target: DeletionTarget) {
  return target.kind === "editor"
    ? "The project could not be deleted. Nothing was removed."
    : "The chain could not be deleted. Nothing was removed.";
}

export function useDeletionController(
  performDeletion: (target: DeletionTarget) => Promise<void>,
) {
  const [target, setTarget] = useState<DeletionTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const request = useCallback((next: DeletionTarget) => {
    setError(null);
    setTarget(next);
  }, []);

  const cancel = useCallback(() => {
    if (deleting) return;
    setTarget(null);
    setError(null);
  }, [deleting]);

  const confirm = useCallback(async () => {
    if (!target || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await performDeletion(target);
      setTarget(null);
    } catch {
      setError(deletionFailureMessage(target));
    } finally {
      setDeleting(false);
    }
  }, [deleting, performDeletion, target]);

  return { target, error, deleting, request, cancel, confirm } as const;
}
