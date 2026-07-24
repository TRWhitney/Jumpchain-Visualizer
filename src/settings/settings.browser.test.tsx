import { useState } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { CrashBoundary } from "./CrashBoundary";
import { useSessionEvents, useSettings } from "./SettingsContext";
import { SettingsProvider } from "./SettingsProvider";
import { SettingsSurface } from "./SettingsSurface";
import { defaultSettings, type SettingsCategory } from "./model";
import { createDefaultTagProfile } from "./tagProfile";
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

function SettingsSurfaceHarness({
  onResetMockData = async () => true,
}: {
  onResetMockData?: () => Promise<boolean>;
} = {}) {
  const [category, setCategory] = useState<SettingsCategory>("general");
  return (
    <SettingsSurface
      category={category}
      onCategoryChange={setCategory}
      onClose={() => undefined}
      onResetMockData={onResetMockData}
    />
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

test("window monitoring signals readiness before failures can be dispatched", async () => {
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository()}
      reportExporter={exporter}
    >
      <CrashBoundary>
        <p>Healthy surface</p>
      </CrashBoundary>
    </SettingsProvider>,
  );
  await expect.element(page.getByText("Healthy surface")).toBeVisible();
  await expect
    .poll(() => document.documentElement.dataset.crashMonitorReady)
    .toBe("true");
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

test("custom package limits require risk consent and invalid values never become effective", async () => {
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository()}
      reportExporter={exporter}
    >
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Developer" }).click();
  const toggle = page.getByLabelText("Use custom package limits");
  await toggle.click();
  await expect
    .element(
      page.getByRole("heading", {
        name: "Increase package limits at your own risk",
      }),
    )
    .toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect.element(toggle).not.toBeChecked();
  await expect
    .element(page.getByRole("spinbutton", { name: /Archive/ }))
    .toBeDisabled();

  await toggle.click();
  await page.getByRole("button", { name: "I understand, enable" }).click();
  const expanded = page.getByRole("spinbutton", { name: /Expanded package/ });
  await expect.element(expanded).toBeEnabled();
  await expect
    .element(page.getByTitle("Increase Expanded package limit"))
    .toBeVisible();
  await expect
    .element(page.getByTitle("Decrease Expanded package limit"))
    .toBeVisible();
  await expanded.fill("8");
  await expect
    .element(page.getByText(/cannot exceed the expanded package limit/))
    .toBeVisible();
  await expect.element(page.getByText("Archive").last()).toBeVisible();
  await expect.element(page.getByText("64 MiB").first()).toBeVisible();

  await page.getByRole("button", { name: "Reset package limits" }).click();
  await expect.element(toggle).not.toBeChecked();
  await expect.element(expanded).toHaveValue(96);
});

test("mock data reset follows the persisted visibility setting and reports completion", async () => {
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository()}
      reportExporter={exporter}
    >
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Developer" }).click();
  const visibility = page.getByLabelText("Show mock fixtures");
  const reset = page.getByRole("button", { name: "Reset Mock Data" });
  await expect.element(visibility).not.toBeChecked();
  await expect.element(reset).toBeDisabled();
  await visibility.click();
  await expect.element(reset).toBeEnabled();
  await reset.click();
  await expect.element(page.getByText("Mock data reset.")).toBeVisible();
});

test("mock data reset reports repository failure without claiming success", async () => {
  render(
    <SettingsProvider
      repository={
        new MemorySettingsRepository({
          ...defaultSettings(createDefaultTagProfile()),
          developer: {
            ...defaultSettings(createDefaultTagProfile()).developer,
            showMockData: true,
          },
        })
      }
      reportExporter={exporter}
    >
      <SettingsSurfaceHarness onResetMockData={async () => false} />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Developer" }).click();
  await page.getByRole("button", { name: "Reset Mock Data" }).click();
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("Mock data could not be reset. Nothing was changed.");
  await expect
    .element(page.getByText("Mock data reset."))
    .not.toBeInTheDocument();
});

test("permanent sidebar deletion is an off-by-default persisted Editor preference", async () => {
  const repository = new MemorySettingsRepository();
  render(
    <SettingsProvider repository={repository} reportExporter={exporter}>
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Editor" }).click();
  const toggle = page.getByLabelText("Permanently delete sidebar items");
  await expect.element(toggle).not.toBeChecked();
  await toggle.click();
  await expect.element(toggle).toBeChecked();
  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return stored?.editor.permanentlyDeleteSidebarItems;
    })
    .toBe(true);
});

test("layout preview placeholder length is unlimited by default and persists a bounded value", async () => {
  const repository = new MemorySettingsRepository();
  render(
    <SettingsProvider repository={repository} reportExporter={exporter}>
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Editor" }).click();
  const limit = page.getByLabelText("Layout preview placeholder length");
  await expect.element(limit).toHaveValue(null);
  await expect.element(limit).toHaveAttribute("placeholder", "Unlimited");
  await page.getByTitle("Increase Layout preview placeholder length").click();
  await expect.element(limit).toHaveValue(1);
  await expect
    .element(page.getByTitle("Decrease Layout preview placeholder length"))
    .toBeDisabled();
  await limit.fill("12");
  await expect.element(limit).toHaveValue(12);
  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return stored?.editor.layoutPreviewPlaceholderCharacterLimit;
    })
    .toBe(12);
  await limit.fill("");
  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return stored?.editor.layoutPreviewPlaceholderCharacterLimit;
    })
    .toBeNull();
});

test("image alt text hover is an on-by-default persisted Accessibility preference", async () => {
  const repository = new MemorySettingsRepository();
  render(
    <SettingsProvider repository={repository} reportExporter={exporter}>
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Accessibility" }).click();
  const toggle = page.getByLabelText("Show alt text on hover");
  await expect.element(toggle).toBeChecked();
  await toggle.click();
  await expect.element(toggle).not.toBeChecked();
  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return stored?.accessibility.imageAltTextHover;
    })
    .toBe(false);
});

test("an unavailable stored language recovers to English before Settings renders", async () => {
  const stored = {
    ...defaultSettings(createDefaultTagProfile()),
    language: { tag: "zz-Invalid" },
  };
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository(stored)}
      reportExporter={exporter}
    >
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await expect
    .element(page.getByRole("combobox", { name: "Language" }))
    .toHaveValue("en");
  expect(document.documentElement.lang).toBe("en");
  expect(document.documentElement.dir).toBe("ltr");
  expect(
    (page.getByRole("searchbox").element() as HTMLInputElement).spellcheck,
  ).toBe(false);
});
