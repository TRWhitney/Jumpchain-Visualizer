import { describe, expect, it } from "vitest";
import type { TrackerAction } from "./model";
import { createTrackerRendererActions } from "./rendererAdapter";

describe("Tracker renderer adapter", () => {
  it("adds actor ownership without changing callback order or payloads", () => {
    const received: TrackerAction[] = [];
    const actions = createTrackerRendererActions(
      "entry-2",
      "companion-1",
      (action) => received.push(action),
    );

    actions.setChoice("identity", "Traveler");
    actions.setInput("identity", "title", "Wanderer");
    actions.setSourceSelections("section:source", "multi", ["first"]);
    actions.recordChoiceRoll("age", 24);
    actions.recordSourceRoll("section:source", "single", "second");

    expect(received).toEqual([
      {
        type: "set-choice",
        entryId: "entry-2",
        actorId: "companion-1",
        choiceHandle: "identity",
        value: "Traveler",
      },
      {
        type: "set-input",
        entryId: "entry-2",
        actorId: "companion-1",
        choiceHandle: "identity",
        inputHandle: "title",
        value: "Wanderer",
      },
      {
        type: "set-source-selections",
        entryId: "entry-2",
        actorId: "companion-1",
        sourceKey: "section:source",
        mode: "multi",
        value: ["first"],
      },
      {
        type: "record-choice-roll",
        entryId: "entry-2",
        actorId: "companion-1",
        choiceHandle: "age",
        result: 24,
      },
      {
        type: "record-source-roll",
        entryId: "entry-2",
        actorId: "companion-1",
        sourceKey: "section:source",
        mode: "single",
        result: "second",
      },
    ]);
  });
});
