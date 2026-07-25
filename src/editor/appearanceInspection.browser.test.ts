import { afterEach, expect, test } from "vitest";
import {
  annotateAppearanceInspectionTargets,
  appearanceInspectionAtPoint,
} from "./appearanceInspection";

let fixture: HTMLElement | null = null;

afterEach(() => {
  fixture?.remove();
  fixture = null;
});

test("appearance inspection annotates exact roles and excludes user-managed tags", () => {
  fixture = document.createElement("div");
  fixture.innerHTML = `
    <article class="shared-jump-renderer">
      <header><h4>Title</h4></header>
      <section class="rendered-jump-section">
        <article class="default-choice-card">
          <div class="jump-nested-inputs">
            <input data-example-input placeholder="Unset">
          </div>
          <span class="tag-profile-badge">Example Tag</span>
        </article>
      </section>
    </article>
  `;
  document.body.append(fixture);

  const cleanup = annotateAppearanceInspectionTargets(fixture);
  const title = fixture.querySelector<HTMLElement>("h4")!;
  const input = fixture.querySelector<HTMLElement>("[data-example-input]")!;
  const tag = fixture.querySelector<HTMLElement>(".tag-profile-badge")!;

  expect(title.dataset.appearanceColorField).toBe("header-title");
  expect(input.dataset.appearanceColorField).toBe("control-muted-text");
  expect(input.dataset.appearanceBorderField).toBe("control-border");
  expect(tag.dataset.appearanceColorField).toBeUndefined();

  const bounds = input.getBoundingClientRect();
  expect(
    appearanceInspectionAtPoint(
      input,
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    ),
  ).toMatchObject({ field: "control-muted-text", kind: "text" });
  expect(
    appearanceInspectionAtPoint(input, bounds.left, bounds.top),
  ).toMatchObject({ field: "control-border", kind: "border" });

  cleanup();
  expect(title.dataset.appearanceColorField).toBeUndefined();
  expect(input.dataset.appearanceColorField).toBeUndefined();
});

test("authored section and choice layout colors supersede appearance roles", () => {
  fixture = document.createElement("div");
  fixture.innerHTML = `
    <section class="rendered-jump-section">
      <div
        data-section-layout
        data-layout-color-owner-kind="section-layout"
        data-layout-color-owner-handle="section_card"
        data-layout-color-owner-path="stack[1]"
        data-layout-color-background="background"
      >
        <article class="default-choice-card">
          <div
            data-choice-layout
            data-layout-color-owner-kind="choice-layout"
            data-layout-color-owner-handle="choice_card"
            data-layout-color-owner-path="stack[1]/slot[1]"
            data-layout-color-background="background"
            data-layout-color-text="text-color"
          >
            <strong>Choice name</strong>
          </div>
        </article>
      </div>
    </section>
  `;
  document.body.append(fixture);

  annotateAppearanceInspectionTargets(fixture);
  const sectionLayout = fixture.querySelector<HTMLElement>(
    "[data-section-layout]",
  )!;
  const choiceLayout = fixture.querySelector<HTMLElement>(
    "[data-choice-layout]",
  )!;
  const heading = fixture.querySelector<HTMLElement>("strong")!;

  expect(sectionLayout.dataset.appearanceColorField).toBe("background");
  expect(choiceLayout.dataset.appearanceColorField).toBe("background");
  expect(appearanceInspectionAtPoint(heading, 10, 10)).toMatchObject({
    field: "text-color",
    kind: "text",
    layout: {
      kind: "choice-layout",
      handle: "choice_card",
      path: "stack[1]/slot[1]",
    },
  });
  expect(appearanceInspectionAtPoint(sectionLayout, 10, 10)).toMatchObject({
    field: "background",
    kind: "background",
    layout: {
      kind: "section-layout",
      handle: "section_card",
      path: "stack[1]",
    },
  });
});
