import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  JumpPackageImportService,
  PackageSecurityError,
  type PackageImportReview,
} from "../archive";
import { useSettings } from "../settings/SettingsContext";
import { effectivePackageSizeLimits } from "../settings/model";
import {
  filterEditorWorkspaces,
  orderedEditorWorkspaces,
  summarizeWorkspace,
  type EditorWorkspaceSnapshot,
} from "./model";
import {
  localeDate,
  localeNumber,
  translate,
  translateDiagnostic,
} from "../localization";
import { useContextMenu } from "../ui";

const service = new JumpPackageImportService();

const openedLabel = (value: string) => {
  const elapsed = Date.now() - Date.parse(value);
  if (elapsed < 60_000) return translate("ui.editorHub.opened.justNow");
  if (elapsed < 86_400_000) return translate("ui.editorHub.opened.today");
  if (elapsed < 172_800_000) return translate("ui.editorHub.opened.yesterday");
  return translate("ui.editorHub.opened.date", {
    date: localeDate(new Date(value)),
  });
};

function ProjectDescription({ children }: { children: string }) {
  const tooltipId = useId();
  const text = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [above, setAbove] = useState(false);
  useLayoutEffect(() => {
    const element = text.current;
    if (!element) return;
    const measure = () => {
      setTruncated(element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);
  return (
    <span
      className={`editor-project-description-wrap${above ? " is-above" : ""}`}
      onPointerEnter={() => {
        const bounds = text.current?.getBoundingClientRect();
        if (bounds) setAbove(window.innerHeight - bounds.bottom < 180);
      }}
    >
      <p
        ref={text}
        className="editor-project-card-description"
        tabIndex={truncated ? 0 : undefined}
        aria-describedby={truncated ? tooltipId : undefined}
      >
        {children}
      </p>
      {truncated && (
        <span
          id={tooltipId}
          className="editor-project-description-tooltip"
          role="tooltip"
        >
          {children}
        </span>
      )}
    </span>
  );
}

export function EditorHub({
  workspaces,
  loading,
  error,
  desktop,
  onCreate,
  onOpen,
  onOpenFolder,
  onImport,
  onToggleStar,
  onExport,
  onDelete,
}: {
  workspaces: readonly EditorWorkspaceSnapshot[];
  loading: boolean;
  error: string | null;
  desktop: boolean;
  onCreate: () => void;
  onOpen: (workspace: EditorWorkspaceSnapshot) => void;
  onOpenFolder: () => void;
  onImport: (review: PackageImportReview) => void;
  onToggleStar: (workspace: EditorWorkspaceSnapshot) => void;
  onExport: (workspace: EditorWorkspaceSnapshot) => void;
  onDelete: (workspace: EditorWorkspaceSnapshot) => void;
}) {
  const { openContextMenu, openContextMenuFromKeyboard } = useContextMenu();
  const { settings, logger } = useSettings();
  const [search, setSearch] = useState("");
  const [inspectState, setInspectState] = useState<
    | { kind: "idle" }
    | { kind: "inspecting"; controller: AbortController }
    | { kind: "review"; review: PackageImportReview }
    | { kind: "blocked"; code: string; message: string }
  >({ kind: "idle" });
  const fileInput = useRef<HTMLInputElement>(null);
  const limits = effectivePackageSizeLimits(settings.developer);
  const ordered = useMemo(
    () => orderedEditorWorkspaces(workspaces),
    [workspaces],
  );
  const visible = useMemo(
    () => filterEditorWorkspaces(ordered, search),
    [ordered, search],
  );
  const customLimits = settings.developer.useCustomPackageSizeLimits;

  const inspect = async (file: File) => {
    const controller = new AbortController();
    setInspectState({ kind: "inspecting", controller });
    try {
      const review = await service.inspect(
        new Uint8Array(await file.arrayBuffer()),
        limits,
        controller.signal,
      );
      if (customLimits)
        logger.emit("package.limits.override_used", {
          attributes: { operation: "editor-import" },
        });
      setInspectState({ kind: "review", review });
    } catch (error) {
      const blocked =
        error instanceof PackageSecurityError
          ? error
          : new PackageSecurityError("archive.inspect_failed", {});
      setInspectState({
        kind: "blocked",
        code: blocked.code,
        message: translate(`packageErrors.${blocked.code}`, {
          ...blocked.parameters,
          ...(blocked.diagnostic
            ? { value0: translateDiagnostic(blocked.diagnostic) }
            : {}),
        }),
      });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="app-chain-hub-content editor-hub-content">
      <header className="app-chain-hub-heading">
        <div>
          <p className="app-mock-kicker">
            {translate("ui.editorHub.text.editor")}
          </p>
          <h1
            id="app-editor-heading"
            className="app-route-heading"
            data-route-heading
            tabIndex={-1}
          >
            {translate("ui.editorHub.text.yourJumpProjects")}
          </h1>
          <p>
            {translate(
              "ui.editorHub.text.createAPackageResumeRecentAuthoringOrSecurelyInspect",
            )}
          </p>
        </div>
        <span>
          <strong>{workspaces.length}</strong>
          <small>{translate("ui.editorHub.text.savedProjects")}</small>
        </span>
      </header>

      <section
        className="editor-create-callout"
        aria-labelledby="create-jump-heading"
      >
        <span className="app-entry-icon" aria-hidden="true">
          +
        </span>
        <div>
          <h2 id="create-jump-heading">
            {translate("ui.editorHub.text.createANewJump")}
          </h2>
          <p>
            {translate(
              "ui.editorHub.text.startsAValidFormat1ProjectAuthoredByAnonymous",
            )}
          </p>
        </div>
        <button type="button" onClick={onCreate}>
          {translate("ui.editorHub.text.createProject")}
        </button>
        {settings.developer.showOpenProjectFolder && (
          <button
            type="button"
            onClick={onOpenFolder}
            disabled={!desktop}
            title={
              desktop
                ? translate("ui.editorHub.title.chooseProjectFolder")
                : translate("ui.editorHub.title.projectFoldersDesktopOnly")
            }
          >
            {translate("ui.editorHub.text.openProjectFolder")}
          </button>
        )}
        <button type="button" onClick={() => fileInput.current?.click()}>
          {translate("ui.editorHub.text.importJmp")}
        </button>
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept=".jmp,application/zip"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void inspect(file);
          }}
        />
      </section>

      <section
        className="app-saved-chains"
        aria-labelledby="saved-editor-heading"
      >
        <div className="app-saved-chains-heading">
          <div>
            <h2 id="saved-editor-heading">
              {translate("ui.editorHub.text.allSavedProjects")}
            </h2>
            <p>
              {translate(
                "ui.editorHub.text.starredProjectsFirstThenByWhenYouLastOpened",
              )}
            </p>
          </div>
          <label className="app-chain-search">
            <span>{translate("ui.editorHub.text.searchSavedProjects")}</span>
            <input
              type="search"
              spellCheck={false}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={translate(
                "ui.editorHub.placeholder.nameAuthorVersionTagDiagnostic",
              )}
            />
          </label>
          <span>
            {visible.length === workspaces.length
              ? translate("ui.editorHub.count.total", {
                  count: workspaces.length,
                  formattedCount: localeNumber(workspaces.length),
                })
              : translate("ui.editorHub.count.visible", {
                  visible: localeNumber(visible.length),
                  total: localeNumber(workspaces.length),
                })}
          </span>
        </div>
        <div
          className="app-chain-card-list editor-project-card-list"
          tabIndex={0}
        >
          {loading && (
            <div className="app-chain-empty" role="status">
              <strong>
                {translate("ui.editorHub.text.loadingSavedProjects")}
              </strong>
            </div>
          )}
          {error && (
            <div className="app-chain-empty is-error" role="alert">
              <strong>{error}</strong>
              <span>
                {translate(
                  "ui.editorHub.text.yourInMemoryWorkRemainsAvailable",
                )}
              </span>
            </div>
          )}
          {!loading &&
            visible.map((workspace) => {
              const summary = summarizeWorkspace(workspace);
              const errors = summary.diagnostics.filter(
                (item) => item.severity === "error",
              ).length;
              const warnings = summary.diagnostics.filter(
                (item) => item.severity === "warning",
              ).length;
              const menu = {
                label: translate("ui.editorHub.ariaLabel.projectActions", {
                  project: summary.name,
                }),
                actions: [
                  {
                    id: "open",
                    label: translate("common.open"),
                    onAction: () => onOpen(workspace),
                  },
                  {
                    id: "star",
                    label: translate(
                      summary.starred ? "common.unstar" : "common.star",
                    ),
                    onAction: () => onToggleStar(workspace),
                  },
                  {
                    id: "export",
                    label: translate("common.exportJmp"),
                    onAction: () => onExport(workspace),
                  },
                  {
                    id: "delete",
                    label: translate("common.deleteProject"),
                    danger: true,
                    separatorBefore: true,
                    onAction: () => onDelete(workspace),
                  },
                ],
              };
              return (
                <article
                  className="app-chain-card editor-project-card"
                  key={workspace.id}
                  onContextMenu={(event) => openContextMenu(event, menu)}
                >
                  <button
                    type="button"
                    className="app-card-delete"
                    aria-label={translate("ui.editorHub.ariaLabel.delete", {
                      project: summary.name,
                    })}
                    title={translate("ui.editorHub.ariaLabel.delete", {
                      project: summary.name,
                    })}
                    onClick={() => onDelete(workspace)}
                  >
                    {translate("ui.editorHub.text.delete")}
                  </button>
                  <div className="editor-project-card-main">
                    <p className="editor-project-card-format">
                      {summary.nativeGauntlet
                        ? translate("ui.editorHub.text.nativeGauntlet")
                        : translate("ui.editorHub.text.format1Jump")}
                    </p>
                    <h3 title={summary.name}>{summary.name}</h3>
                    <span
                      className="editor-project-card-author"
                      title={summary.authors.join(", ")}
                    >
                      {summary.authors.join(", ") ||
                        translate("ui.editorHub.text.unknownAuthor")}
                    </span>
                    <small>{openedLabel(summary.lastOpenedAt)}</small>
                    <ProjectDescription>
                      {summary.description}
                    </ProjectDescription>
                  </div>
                  <dl>
                    <div>
                      <dt>{translate("ui.editorHub.text.version")}</dt>
                      <dd>{summary.version}</dd>
                    </div>
                    <div>
                      <dt>{translate("ui.editorHub.text.sections")}</dt>
                      <dd>{summary.sectionCount}</dd>
                    </div>
                    <div>
                      <dt>{translate("ui.editorHub.text.choices")}</dt>
                      <dd>{summary.choiceCount}</dd>
                    </div>
                    <div>
                      <dt>{translate("ui.editorHub.text.diagnostics")}</dt>
                      <dd
                        className={
                          errors
                            ? "is-error"
                            : warnings
                              ? "is-warning"
                              : "is-clean"
                        }
                      >
                        {errors
                          ? translate("ui.editorHub.count.errors", {
                              count: errors,
                              formattedCount: localeNumber(errors),
                            })
                          : warnings
                            ? translate("ui.editorHub.count.warnings", {
                                count: warnings,
                                formattedCount: localeNumber(warnings),
                              })
                            : translate("ui.editorHub.text.clean")}
                      </dd>
                    </div>
                  </dl>
                  <div className="app-chain-card-actions">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      onKeyDown={(event) =>
                        openContextMenuFromKeyboard(event, menu)
                      }
                      onClick={() => onOpen(workspace)}
                    >
                      {translate("ui.editorHub.text.openProject")}
                    </button>
                    <button
                      type="button"
                      className="app-chain-star"
                      aria-label={translate(
                        summary.starred
                          ? "ui.editorHub.ariaLabel.unstar"
                          : "ui.editorHub.ariaLabel.star",
                        { project: summary.name },
                      )}
                      aria-pressed={summary.starred}
                      title={translate(
                        summary.starred
                          ? "ui.editorHub.ariaLabel.unstar"
                          : "ui.editorHub.ariaLabel.star",
                        { project: summary.name },
                      )}
                      onClick={() => onToggleStar(workspace)}
                    >
                      <span aria-hidden="true">
                        {summary.starred ? "★" : "☆"}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
          {!loading && !visible.length && (
            <div className="app-chain-empty" role="status">
              <strong>
                {search
                  ? translate("ui.editorHub.empty.noMatch", {
                      search: search.trim(),
                    })
                  : translate("ui.editorHub.empty.noProjects")}
              </strong>
              <span>
                {search
                  ? translate("ui.editorHub.empty.searchHelp")
                  : translate("ui.editorHub.empty.createHelp")}
              </span>
            </div>
          )}
        </div>
      </section>

      {inspectState.kind !== "idle" && (
        <div className="package-review-backdrop">
          {inspectState.kind === "inspecting" ? (
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="package-inspecting-heading"
            >
              <p>{translate("ui.editorHub.text.securePackageInspection")}</p>
              <h2 id="package-inspecting-heading">
                {translate("ui.editorHub.text.inspectingEveryEntry")}
              </h2>
              <p>
                {translate(
                  "ui.editorHub.text.compressedAndExpandedBytesFileTypesPathsSignaturesImages",
                )}
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => inspectState.controller.abort()}
                >
                  {translate("ui.editorHub.text.cancel")}
                </button>
              </div>
            </section>
          ) : inspectState.kind === "blocked" ? (
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="package-blocked-heading"
            >
              <p>{translate("ui.editorHub.text.importBlocked")}</p>
              <h2 id="package-blocked-heading">
                {translate(
                  "ui.editorHub.text.thisPackageMayBeUnsafeOrMalformed",
                )}
              </h2>
              <p>{inspectState.message}</p>
              <code>{inspectState.code}</code>
              <p>
                <strong>
                  {translate(
                    "ui.editorHub.text.nothingWasInstalledExtractedOrCreated",
                  )}
                </strong>
              </p>
              <div>
                <button
                  autoFocus
                  type="button"
                  onClick={() => setInspectState({ kind: "idle" })}
                >
                  {translate("ui.editorHub.text.close")}
                </button>
              </div>
            </section>
          ) : (
            <PackageReview
              review={inspectState.review}
              customLimits={customLimits}
              onCancel={() => setInspectState({ kind: "idle" })}
              onImport={() => {
                onImport(inspectState.review);
                setInspectState({ kind: "idle" });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function PackageReview({
  review,
  customLimits,
  onCancel,
  onImport,
}: {
  review: PackageImportReview;
  customLimits: boolean;
  onCancel: () => void;
  onImport: () => void;
}) {
  return (
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="package-review-heading"
    >
      <p>
        {review.status === "warning"
          ? translate("ui.editorHub.text.reviewAuthoringWarnings")
          : translate("ui.editorHub.text.secureInspectionComplete")}
      </p>
      <h2 id="package-review-heading">
        {review.name}{" "}
        <small>
          {translate("ui.editorHub.text.versionPrefix")}
          {review.version}
        </small>
      </h2>
      <dl className="package-review-identity">
        <div>
          <dt>{translate("ui.editorHub.text.identity")}</dt>
          <dd>{review.identity}</dd>
        </div>
        <div>
          <dt>{translate("ui.editorHub.text.sha256")}</dt>
          <dd>
            <code>{review.hash}</code>
          </dd>
        </div>
        <div>
          <dt>{translate("ui.editorHub.text.files")}</dt>
          <dd>
            {review.definitionCount}{" "}
            {translate("ui.editorHub.text.definitions")}
            {review.assetCount} {translate("ui.editorHub.text.assets")}
          </dd>
        </div>
        <div>
          <dt>{translate("ui.editorHub.text.expanded")}</dt>
          <dd>
            {(review.expandedBytes / 1024 / 1024).toFixed(2)}{" "}
            {translate("ui.editorHub.text.mib")}
          </dd>
        </div>
      </dl>
      <div className="package-review-limits">
        <strong>{translate("ui.editorHub.text.effectivePackageLimits")}</strong>
        <span>
          {translate("ui.editorHub.text.archive")}
          {review.limits.maxArchiveMiB} {translate("ui.editorHub.text.mib")}
        </span>
        <span>
          {translate("ui.editorHub.text.definition")}
          {review.limits.maxDefinitionFileMiB}{" "}
          {translate("ui.editorHub.text.mib")}
        </span>
        <span>
          {translate("ui.editorHub.text.asset")}
          {review.limits.maxAssetFileMiB} {translate("ui.editorHub.text.mib")}
        </span>
        <span>
          {translate("ui.editorHub.text.expandedSizePrefix")}
          {review.limits.maxExpandedPackageMiB}{" "}
          {translate("ui.editorHub.text.mib")}
        </span>
      </div>
      {customLimits && (
        <p className="package-review-risk">
          <strong>{translate("ui.editorHub.text.atYourOwnRisk")}</strong>{" "}
          {translate(
            "ui.editorHub.text.customByteBudgetsAreActiveMandatoryMaliciousArchiveProtections",
          )}
        </p>
      )}
      {review.diagnostics.length > 0 && (
        <div className="package-review-diagnostics">
          {review.diagnostics.map((diagnostic, index) => (
            <p
              className={`is-${diagnostic.severity}`}
              key={`${diagnostic.code}:${index}`}
            >
              <strong>{diagnostic.severity}</strong>{" "}
              {translateDiagnostic(diagnostic)}
            </p>
          ))}
        </div>
      )}
      <div>
        <button
          className="package-review-primary"
          type="button"
          onClick={onImport}
        >
          {review.status === "warning"
            ? translate("ui.editorHub.text.importAnyway")
            : translate("ui.editorHub.text.importProject")}
        </button>
        <button autoFocus type="button" onClick={onCancel}>
          {translate("ui.editorHub.text.cancel")}
        </button>
      </div>
    </section>
  );
}
