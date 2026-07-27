import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createWelcomeTourSession } from "./fixtures";
import { transitionWelcomeTour } from "./controller";
import { WelcomeTourOverlay } from "./WelcomeTourOverlay";

const handlers = () => ({
  onContinue: vi.fn(),
  onBack: vi.fn(),
  onSkip: vi.fn(),
  onExit: vi.fn(),
  onChooseBranch: vi.fn(),
  onChooseAdvanced: vi.fn(),
  onFinishBranch: vi.fn(),
  onChooseMode: vi.fn(),
});

test("keeps an anchored coachmark in the viewport and describes its target", async () => {
  const session = transitionWelcomeTour(
    createWelcomeTourSession(),
    "home-navigation",
  );
  render(
    <>
      <nav
        data-tour-target="app-navigation"
        style={{
          position: "fixed",
          inset: "4px 8px auto",
          height: "54px",
        }}
      >
        <button type="button">Home control</button>
      </nav>
      <WelcomeTourOverlay session={session} actionComplete {...handlers()} />
    </>,
  );

  const card = page.getByRole("dialog");
  await expect.element(card).toBeVisible();
  await expect
    .poll(() => {
      const box = card.element().getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    })
    .toBe(true);
  await expect
    .element(page.getByRole("navigation"))
    .toHaveAttribute("aria-describedby");
  await expect
    .element(page.getByRole("heading", { name: "Your work is always close" }))
    .toHaveFocus();
});

test("traps focus across the highlighted subtree and routes Escape to Exit", async () => {
  const onExit = vi.fn();
  const session = transitionWelcomeTour(
    createWelcomeTourSession(),
    "home-navigation",
  );
  render(
    <>
      <nav data-tour-target="app-navigation">
        <button type="button">Home control</button>
      </nav>
      <button type="button">Outside control</button>
      <WelcomeTourOverlay
        session={session}
        actionComplete
        {...handlers()}
        onExit={onExit}
      />
    </>,
  );

  await page
    .getByRole("heading", { name: "Your work is always close" })
    .click();
  await userEvent.keyboard("{Tab}");
  expect(document.activeElement?.textContent).not.toBe("Outside control");
  await userEvent.keyboard("{Escape}");
  expect(onExit).toHaveBeenCalledOnce();
});

test("shows a usable recovery card when an expected control is unavailable", async () => {
  const session = transitionWelcomeTour(
    createWelcomeTourSession(),
    "home-navigation",
  );
  render(
    <WelcomeTourOverlay session={session} actionComplete {...handlers()} />,
  );
  await expect
    .element(
      page.getByRole("heading", {
        name: "This control is taking a moment",
      }),
    )
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Retry" }))
    .toBeVisible();
  await expect
    .element(
      page.getByRole("button", {
        name: "Skip step—do it for me",
      }),
    )
    .toBeVisible();
});
