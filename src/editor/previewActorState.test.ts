import { describe, expect, it } from "vitest";
import {
  createPreviewActorState,
  reducePreviewActorState,
} from "./previewActorState";

describe("preview actor state", () => {
  it("records choice rolls and advances their sequence", () => {
    const first = reducePreviewActorState(createPreviewActorState(), {
      type: "record-choice-roll",
      choiceHandle: "pending",
      result: 4,
    });
    const second = reducePreviewActorState(first, {
      type: "record-choice-roll",
      choiceHandle: "pending",
      result: 2,
    });

    expect(second.choices.pending).toBe(2);
    expect(second.choiceRolls.pending).toEqual({ result: 2, sequence: 2 });
  });

  it("replaces source-roll selections", () => {
    const initial = createPreviewActorState();
    const first = reducePreviewActorState(initial, {
      type: "record-source-roll",
      sourceKey: "section:source",
      mode: "single",
      result: "first",
    });
    const second = reducePreviewActorState(first, {
      type: "record-source-roll",
      sourceKey: "section:source",
      mode: "single",
      result: "second",
    });
    expect(second.choices).toEqual({});
    expect(second.sourceSelections["section:source"]).toEqual(["second"]);
    expect(second.sourceRolls["section:source"]).toEqual({
      result: "second",
      sequence: 2,
    });
  });
});
