import { describe, expect, it } from "vitest";
import {
  deletionFailureMessage,
  type DeletionTarget,
} from "./useDeletionController";

describe("deletionFailureMessage", () => {
  it.each([
    [
      { kind: "editor", id: "editor-1", name: "Project" },
      "The project could not be deleted. Nothing was removed.",
    ],
    [
      { kind: "chain", id: "chain-1", name: "Chain" },
      "The chain could not be deleted. Nothing was removed.",
    ],
  ] satisfies readonly [DeletionTarget, string][])(
    "preserves the $kind failure copy",
    (target, expected) => {
      expect(deletionFailureMessage(target)).toBe(expected);
    },
  );
});
