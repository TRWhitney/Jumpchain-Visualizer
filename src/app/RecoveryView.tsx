import { translate } from "../localization";

export function RecoveryView({
  type,
  hidden,
  returnLabel,
  onReturn,
}: {
  type: "Editor workspace" | "Chain";
  hidden: boolean;
  returnLabel: string;
  onReturn: () => void;
}) {
  return (
    <section
      hidden={hidden}
      inert={hidden || undefined}
      data-active-route={!hidden}
      aria-labelledby={`app-${type === "Chain" ? "chain" : "editor"}-recovery-heading`}
    >
      <p className="app-mock-kicker">
        {translate("ui.appShell.text.recovery")}
      </p>
      <h1
        id={`app-${type === "Chain" ? "chain" : "editor"}-recovery-heading`}
        className="app-route-heading"
        data-route-heading
        tabIndex={-1}
      >
        {type} {translate("ui.appShell.text.unavailable")}
      </h1>
      <p>
        {translate(
          "ui.appShell.text.theRequestedLocalRecordCouldNotBeRestoredIts",
        )}
      </p>
      <div className="app-route-actions">
        <button type="button" onClick={onReturn}>
          {returnLabel}
        </button>
      </div>
    </section>
  );
}
