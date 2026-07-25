import { describe, expect, it } from "vitest";
import {
  createPreviewActorState,
  reducePreviewActorState,
} from "./previewActorState";

describe("preview actor state", () => {
  it("records choice rolls and advances their sequence", () => {
    const first = reducePreviewActorState(createPreviewActorState(), {
      type: "record-choice-roll",
      entryId: "preview-entry",
      actorId: "jumper",
      choiceHandle: "pending",
      result: 4,
    });
    const second = reducePreviewActorState(first, {
      type: "record-choice-roll",
      entryId: "preview-entry",
      actorId: "jumper",
      choiceHandle: "pending",
      result: 2,
    });

    expect(second.choices.pending).toBe(2);
    expect(second.choiceRolls.pending).toEqual({ result: 2, sequence: 2 });
  });

  it("isolates preview actions and replaces source-roll selections", () => {
    const initial = createPreviewActorState();
    expect(
      reducePreviewActorState(initial, {
        type: "set-choice",
        entryId: "another-entry",
        actorId: "jumper",
        choiceHandle: "ignored",
        value: true,
      }),
    ).toBe(initial);

    const first = reducePreviewActorState(initial, {
      type: "record-source-roll",
      entryId: "preview-entry",
      actorId: "jumper",
      sourceKey: "section:source",
      result: "first",
    });
    const second = reducePreviewActorState(first, {
      type: "record-source-roll",
      entryId: "preview-entry",
      actorId: "jumper",
      sourceKey: "section:source",
      result: "second",
    });
    expect(second.choices).toMatchObject({ first: false, second: true });
    expect(second.sourceRolls["section:source"]).toEqual({
      result: "second",
      sequence: 2,
    });
  });
});
