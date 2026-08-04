import type { PackageImportReview } from "../archive";
import { translate, translateDiagnostic } from "../localization";

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
          <dd className="package-review-hash">
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
