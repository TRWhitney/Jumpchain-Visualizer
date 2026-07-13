import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { CrashBoundary } from "./CrashBoundary";
import { useSessionEvents, useSettings } from "./SettingsContext";
import { SettingsProvider } from "./SettingsProvider";
import { MemorySettingsRepository, type ReportExporter } from "./repository";
import "../../documentation/styles.css";
import "../../documentation/settings-design.css";
import "../../documentation/logging-design.css";
import "./settings.css";

const exporter: ReportExporter = {
  save: async () => "saved",
};

function BrokenSurface(): never {
  throw new Error("Deliberate component failure");
}

function PersistenceHarness() {
  const { settings, update } = useSettings();
  const events = useSessionEvents();
  return (
    <div>
      <output aria-label="Current accent">
        {settings.appearance.accentColor}
      </output>
      <output aria-label="Storage failures">
        {
          events.filter((event) => event.eventName === "storage.write_failed")
            .length
        }
      </output>
      <button
        type="button"
        onClick={() => {
          update(
            (current) => ({
              ...current,
              appearance: { ...current.appearance, accentColor: "#112233" },
            }),
            "appearance.accentColor",
            true,
          );
          update(
            (current) => ({
              ...current,
              appearance: { ...current.appearance, accentColor: "#445566" },
            }),
            "appearance.accentColor",
            true,
          );
        }}
      >
        Apply continuous edits
      </button>
    </div>
  );
}

test("recoverable React failures render the private diagnostic surface", async () => {
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository()}
      reportExporter={exporter}
    >
      <CrashBoundary>
        <BrokenSurface />
      </CrashBoundary>
    </SettingsProvider>,
  );
  await expect
    .element(
      page.getByRole("heading", {
        name: "Jumpchain Visualizer encountered an error",
      }),
    )
    .toBeVisible();
  await expect
    .element(page.getByText(/Deliberate component failure/).first())
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Copy report" }))
    .toBeVisible();
});

test("a failed coalesced write rolls back to the last durable aggregate", async () => {
  const repository = {
    load: async () => null,
    save: async () => {
      throw new Error("storage unavailable");
    },
  };
  render(
    <SettingsProvider repository={repository} reportExporter={exporter}>
      <PersistenceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("button", { name: "Apply continuous edits" }).click();
  await expect
    .element(page.getByLabelText("Current accent"))
    .toHaveTextContent("#445566");
  await expect
    .element(page.getByLabelText("Current accent"))
    .toHaveTextContent("#d4af37");
  await expect
    .element(page.getByLabelText("Storage failures"))
    .toHaveTextContent("1");
});
