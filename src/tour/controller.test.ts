import { describe, expect, it } from "vitest";
import { canonicalWorkspace } from "../editor";
import { evaluateTracker, projectEvaluation } from "../tracker/evaluateTracker";
import {
  backWelcomeTour,
  nextWelcomeTourStep,
  satisfyWelcomeTourStep,
  transitionWelcomeTour,
  welcomeTourActionComplete,
} from "./controller";
import {
  WELCOME_TOUR_PACKAGE_ID,
  WELCOME_TOUR_PROLOGUE_PACKAGE_ID,
  createWelcomeTourSession,
} from "./fixtures";
import { isWelcomeTourSession, welcomeTourStepIds } from "./model";
import { MemoryWelcomeTourSessionRepository } from "./repository";
import {
  editorCoreStepOrder,
  trackerStepOrder,
  welcomeTourSteps,
} from "./steps";

describe("welcome tour", () => {
  it("defines every step in a branch-aware graph", () => {
    expect(Object.keys(welcomeTourSteps).sort()).toEqual(
      [...welcomeTourStepIds].sort(),
    );
    expect(editorCoreStepOrder).toContain("editor-open-details");
    expect(editorCoreStepOrder).toContain("editor-open-section");
    expect(trackerStepOrder).toContain("tracker-inventory-result");
    expect(trackerStepOrder).toContain("tracker-open-body-mod");
  });

  it("uses valid isolated fixtures with stable package identities", () => {
    const session = createWelcomeTourSession("/settings", true);
    expect(isWelcomeTourSession(session)).toBe(true);
    expect(session.restartedFromSettings).toBe(true);
    expect(canonicalWorkspace(session.editorWorkspace).name.base).toBe(
      "My First Jump",
    );
    expect(Object.keys(session.trackerState.packages).sort()).toEqual(
      [
        "system-earth",
        WELCOME_TOUR_PACKAGE_ID,
        WELCOME_TOUR_PROLOGUE_PACKAGE_ID,
      ].sort(),
    );
    expect(session.trackerState.enabledSupplements["body-mod"]).toBe(false);
  });

  it("performs Editor steps canonically and Back restores exact input", () => {
    let session = transitionWelcomeTour(
      createWelcomeTourSession(),
      "editor-add-choice",
      { branch: "editor" },
    );
    session = satisfyWelcomeTourStep(session);
    expect(welcomeTourActionComplete(session)).toBe(true);
    session = nextWelcomeTourStep(session);
    session = satisfyWelcomeTourStep(session);
    expect(
      canonicalWorkspace(session.editorWorkspace).choices[0],
    ).toMatchObject({
      handle: "road_companion",
      name: { base: "Road Companion" },
    });
    session = nextWelcomeTourStep(session);
    session = {
      ...session,
      navigation: { ...session.navigation, editorSectionOpened: true },
    };
    session = nextWelcomeTourStep(session);
    session = satisfyWelcomeTourStep(session);
    expect(welcomeTourActionComplete(session)).toBe(true);

    session = backWelcomeTour(session);
    expect(session.stepId).toBe("editor-open-section");
    expect(session.navigation.editorSectionOpened).toBe(false);
    expect(session.editorWorkspace.files["jump.jdef"]).not.toContain(
      "road_companion_placement",
    );
  });

  it("creates both Inventory grants, reorders Jumps, and configures Body Mod", () => {
    let session = transitionWelcomeTour(
      createWelcomeTourSession(),
      "tracker-add-jump",
      { branch: "tracker" },
    );
    for (const stepId of [
      "tracker-add-jump",
      "tracker-route-choice",
      "tracker-perk-choice",
      "tracker-item-choice",
      "tracker-reorder",
    ] as const) {
      expect(session.stepId).toBe(stepId);
      session = satisfyWelcomeTourStep(session);
      expect(welcomeTourActionComplete(session)).toBe(true);
      session = nextWelcomeTourStep(session);
    }

    const tutorialId = session.trackerState.order.find(
      (id) =>
        session.trackerState.entries[id]?.packageId === WELCOME_TOUR_PACKAGE_ID,
    );
    const prologueId = session.trackerState.order.find(
      (id) =>
        session.trackerState.entries[id]?.packageId ===
        WELCOME_TOUR_PROLOGUE_PACKAGE_ID,
    );
    expect(session.trackerState.order.indexOf(tutorialId!)).toBeLessThan(
      session.trackerState.order.indexOf(prologueId!),
    );

    const projected = projectEvaluation(
      session.trackerState,
      evaluateTracker(session.trackerState, null),
    );
    expect(projected.records.map((record) => record.grantHandle)).toEqual(
      expect.arrayContaining(["field_training", "travel_pack"]),
    );

    session = transitionWelcomeTour(session, "tracker-enable-body-mod");
    session = satisfyWelcomeTourStep(session);
    expect(session.trackerState.enabledSupplements["body-mod"]).toBe(true);
    session = transitionWelcomeTour(session, "tracker-use-body-mod");
    session = satisfyWelcomeTourStep(session);
    expect(welcomeTourActionComplete(session)).toBe(true);
  });

  it("round-trips valid sessions and rejects unexpected fixture data", async () => {
    const repository = new MemoryWelcomeTourSessionRepository();
    const session = createWelcomeTourSession();
    await repository.save(session);
    const loaded = await repository.load();
    expect(loaded).toEqual(session);
    loaded!.editorWorkspace.files["jump.jdef"] = "changed";
    expect(
      (await repository.load())?.editorWorkspace.files["jump.jdef"],
    ).not.toBe("changed");

    const corrupt = createWelcomeTourSession();
    corrupt.editorWorkspace.id = "ordinary-user-project";
    await expect(repository.save(corrupt)).rejects.toThrow(
      "Welcome tour session is invalid.",
    );
    await repository.clear();
    expect(await repository.load()).toBeNull();
  });
});
