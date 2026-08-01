import { useState } from "react";
import { JumpPackageImportService, PackageSecurityError } from "../archive";
import type { EditorWorkspaceSnapshot } from "../editor";
import { summarizeWorkspace } from "../editor";
import {
  isStructuredCommandError,
  translate,
  translateDiagnostic,
  translateError,
} from "../localization";
import { isTauriRuntime } from "../platform/runtime";
import type { SettingsContextValue } from "../settings/SettingsContext";
import { effectivePackageSizeLimits } from "../settings/model";

export function EditorExportReview({
  workspace,
  settings,
  onClose,
  onOverrideUse,
}: {
  workspace: EditorWorkspaceSnapshot;
  settings: SettingsContextValue["settings"];
  onClose: () => void;
  onOverrideUse: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const limits = effectivePackageSizeLimits(settings.developer);
  const summary = summarizeWorkspace(workspace);
  const perform = async () => {
    setExporting(true);
    setError(null);
    try {
      const blockedAsset = Object.entries(workspace.assetEditorDocuments).find(
        ([, document]) =>
          document.kind === "svg" ||
          (document.kind === "raster" && document.validationError),
      );
      if (blockedAsset)
        throw new Error(
          `${blockedAsset[0].replace(/^assets\//, "")} has an unresolved local editor draft. Fix it before export.`,
        );
      const archive = await new JumpPackageImportService().export(
        { definitions: workspace.files, assets: workspace.assets },
        limits,
      );
      if (settings.developer.useCustomPackageSizeLimits) onOverrideUse();
      const safeName =
        summary.name
          .toLocaleLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "jump-package";
      if (isTauriRuntime()) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("save_editor_package", {
          suggestedName: `${safeName}.jmp`,
          bytes: [...archive],
          limits,
        });
      } else {
        const url = URL.createObjectURL(new Blob([archive.slice().buffer]));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${safeName}.jmp`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      onClose();
    } catch (caught) {
      setError(
        caught instanceof PackageSecurityError
          ? translate(`packageErrors.${caught.code}`, {
              ...caught.parameters,
              ...(caught.diagnostic
                ? { value0: translateDiagnostic(caught.diagnostic) }
                : {}),
            })
          : isStructuredCommandError(caught)
            ? translateError(caught)
            : caught instanceof Error
              ? caught.message
              : translate("errors.EXPORT_FAILED"),
      );
      setExporting(false);
    }
  };
  return (
    <div className="editor-departure-backdrop">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="editor-export-heading"
      >
        <p>{translate("ui.appShell.text.preflightAndExport")}</p>
        <h2 id="editor-export-heading">
          {translate("ui.appShell.text.export")}
          {summary.name} {translate("ui.appShell.text.asJmp")}
        </h2>
        <p>
          {translate(
            "ui.appShell.text.everySourceFileAndAssetWillBeValidatedBefore",
          )}
        </p>
        <div className="editor-export-limits">
          <strong>{translate("ui.appShell.text.effectiveLimits")}</strong>
          <span>
            {translate("ui.appShell.text.archive")}
            {limits.maxArchiveMiB} {translate("ui.appShell.text.mib")}
          </span>
          <span>
            {translate("ui.appShell.text.definition")}
            {limits.maxDefinitionFileMiB} {translate("ui.appShell.text.mib")}
          </span>
          <span>
            {translate("ui.appShell.text.asset")}
            {limits.maxAssetFileMiB} {translate("ui.appShell.text.mib")}
          </span>
          <span>
            {translate("ui.appShell.text.expanded")}
            {limits.maxExpandedPackageMiB} {translate("ui.appShell.text.mib")}
          </span>
        </div>
        {settings.developer.useCustomPackageSizeLimits && (
          <p className="editor-export-risk">
            <strong>{translate("ui.appShell.text.atYourOwnRisk")}</strong>{" "}
            {translate(
              "ui.appShell.text.customPackageByteBudgetsAreActiveMandatorySecurityChecks",
            )}
          </p>
        )}
        {error && (
          <p className="editor-export-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void perform()}
          >
            {exporting ? "Exporting…" : "Export Package"}
          </button>
          <button
            autoFocus
            type="button"
            disabled={exporting}
            onClick={onClose}
          >
            {translate("ui.appShell.text.cancel")}
          </button>
        </div>
      </section>
    </div>
  );
}
