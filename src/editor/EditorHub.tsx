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

const service = new JumpPackageImportService();

const openedLabel = (value: string) => {
  const elapsed = Date.now() - Date.parse(value);
  if (elapsed < 60_000) return "Opened just now";
  if (elapsed < 86_400_000) return "Opened today";
  if (elapsed < 172_800_000) return "Opened yesterday";
  return `Opened ${new Date(value).toLocaleDateString()}`;
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
  onDelete: (workspace: EditorWorkspaceSnapshot) => void;
}) {
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
          : new PackageSecurityError(
              "archive.inspect_failed",
              "The package could not be inspected safely.",
            );
      setInspectState({
        kind: "blocked",
        code: blocked.code,
        message: blocked.message,
      });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="app-chain-hub-content editor-hub-content">
      <header className="app-chain-hub-heading">
        <div>
          <p className="app-mock-kicker">Editor</p>
          <h1
            id="app-editor-heading"
            className="app-route-heading"
            data-route-heading
            tabIndex={-1}
          >
            Your Jump projects
          </h1>
          <p>
            Create a package, resume recent authoring, or securely inspect a
            portable .jmp.
          </p>
        </div>
        <span>
          <strong>{workspaces.length}</strong>
          <small>saved projects</small>
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
          <h2 id="create-jump-heading">Create a new Jump</h2>
          <p>
            Starts a valid Format 1 project authored by Anonymous, version 0.1,
            with an Introduction section.
          </p>
        </div>
        <button type="button" onClick={onCreate}>
          Create Project
        </button>
        {settings.developer.showOpenProjectFolder && (
          <button
            type="button"
            onClick={onOpenFolder}
            disabled={!desktop}
            title={
              desktop
                ? "Choose a project folder"
                : "Project folders are available in the desktop application"
            }
          >
            Open Project Folder
          </button>
        )}
        <button type="button" onClick={() => fileInput.current?.click()}>
          Import .jmp
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
            <h2 id="saved-editor-heading">All saved projects</h2>
            <p>Starred projects first, then by when you last opened them.</p>
          </div>
          <label className="app-chain-search">
            <span>Search saved projects</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, author, version, tag, diagnostic"
            />
          </label>
          <span>
            {visible.length === workspaces.length
              ? `${workspaces.length} total`
              : `${visible.length} of ${workspaces.length}`}
          </span>
        </div>
        <div
          className="app-chain-card-list editor-project-card-list"
          tabIndex={0}
        >
          {loading && (
            <div className="app-chain-empty" role="status">
              <strong>Loading saved projects…</strong>
            </div>
          )}
          {error && (
            <div className="app-chain-empty is-error" role="alert">
              <strong>{error}</strong>
              <span>Your in-memory work remains available.</span>
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
              return (
                <article
                  className="app-chain-card editor-project-card"
                  key={workspace.id}
                >
                  <button
                    type="button"
                    className="app-card-delete"
                    aria-label={`Delete ${summary.name}`}
                    title={`Delete ${summary.name}`}
                    onClick={() => onDelete(workspace)}
                  >
                    Delete
                  </button>
                  <div className="editor-project-card-main">
                    <p className="editor-project-card-format">
                      {summary.nativeGauntlet
                        ? "Native Gauntlet"
                        : "Format 1 Jump"}
                    </p>
                    <h3 title={summary.name}>{summary.name}</h3>
                    <span
                      className="editor-project-card-author"
                      title={summary.authors.join(", ")}
                    >
                      {summary.authors.join(", ") || "Unknown author"}
                    </span>
                    <small>{openedLabel(summary.lastOpenedAt)}</small>
                    <ProjectDescription>
                      {summary.description}
                    </ProjectDescription>
                  </div>
                  <dl>
                    <div>
                      <dt>Version</dt>
                      <dd>{summary.version}</dd>
                    </div>
                    <div>
                      <dt>Sections</dt>
                      <dd>{summary.sectionCount}</dd>
                    </div>
                    <div>
                      <dt>Choices</dt>
                      <dd>{summary.choiceCount}</dd>
                    </div>
                    <div>
                      <dt>Diagnostics</dt>
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
                          ? `${errors} error${errors === 1 ? "" : "s"}`
                          : warnings
                            ? `${warnings} warning${warnings === 1 ? "" : "s"}`
                            : "Clean"}
                      </dd>
                    </div>
                  </dl>
                  <div className="app-chain-card-actions">
                    <button type="button" onClick={() => onOpen(workspace)}>
                      Open Project
                    </button>
                    <button
                      type="button"
                      className="app-chain-star"
                      aria-label={`${summary.starred ? "Unstar" : "Star"} ${summary.name}`}
                      aria-pressed={summary.starred}
                      title={`${summary.starred ? "Unstar" : "Star"} ${summary.name}`}
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
                  ? `No projects match “${search.trim()}”.`
                  : "No Editor projects yet."}
              </strong>
              <span>
                {search
                  ? "Try a name, author, version, tag, or diagnostic."
                  : "Create a project or import a secure .jmp package."}
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
              <p>Secure package inspection</p>
              <h2 id="package-inspecting-heading">Inspecting every entry…</h2>
              <p>
                Compressed and expanded bytes, file types, paths, signatures,
                images, source, schema, and references are being validated
                before anything is created.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => inspectState.controller.abort()}
                >
                  Cancel
                </button>
              </div>
            </section>
          ) : inspectState.kind === "blocked" ? (
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="package-blocked-heading"
            >
              <p>Import blocked</p>
              <h2 id="package-blocked-heading">
                This package may be unsafe or malformed
              </h2>
              <p>{inspectState.message}</p>
              <code>{inspectState.code}</code>
              <p>
                <strong>Nothing was installed, extracted, or created.</strong>
              </p>
              <div>
                <button
                  autoFocus
                  type="button"
                  onClick={() => setInspectState({ kind: "idle" })}
                >
                  Close
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
          ? "Review authoring warnings"
          : "Secure inspection complete"}
      </p>
      <h2 id="package-review-heading">
        {review.name} <small>version {review.version}</small>
      </h2>
      <dl className="package-review-identity">
        <div>
          <dt>Identity</dt>
          <dd>{review.identity}</dd>
        </div>
        <div>
          <dt>SHA-256</dt>
          <dd>
            <code>{review.hash}</code>
          </dd>
        </div>
        <div>
          <dt>Files</dt>
          <dd>
            {review.definitionCount} definitions · {review.assetCount} assets
          </dd>
        </div>
        <div>
          <dt>Expanded</dt>
          <dd>{(review.expandedBytes / 1024 / 1024).toFixed(2)} MiB</dd>
        </div>
      </dl>
      <div className="package-review-limits">
        <strong>Effective package limits</strong>
        <span>Archive {review.limits.maxArchiveMiB} MiB</span>
        <span>Definition {review.limits.maxDefinitionFileMiB} MiB</span>
        <span>Asset {review.limits.maxAssetFileMiB} MiB</span>
        <span>Expanded {review.limits.maxExpandedPackageMiB} MiB</span>
      </div>
      {customLimits && (
        <p className="package-review-risk">
          <strong>At your own risk.</strong> Custom byte budgets are active.
          Mandatory malicious-archive protections remain enforced.
        </p>
      )}
      {review.diagnostics.length > 0 && (
        <div className="package-review-diagnostics">
          {review.diagnostics.map((diagnostic, index) => (
            <p
              className={`is-${diagnostic.severity}`}
              key={`${diagnostic.code}:${index}`}
            >
              <strong>{diagnostic.severity}</strong> {diagnostic.message}
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
          {review.status === "warning" ? "Import Anyway" : "Import Project"}
        </button>
        <button autoFocus type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
