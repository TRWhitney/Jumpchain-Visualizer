import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useSettings } from "./SettingsContext";
import type { EventPipeline, LogEvent } from "./logging";
import type { ReportExporter } from "./repository";
import { translate } from "../localization";

type Props = {
  children: ReactNode;
  logger: EventPipeline;
  exporter: ReportExporter;
};
type State = { error: Error | null; event: LogEvent | null };

class ReactCrashBoundary extends Component<Props, State> {
  state: State = { error: null, event: null };
  static getDerivedStateFromError(error: Error) {
    return { error, event: null };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (!error.stack && info.componentStack) error.stack = info.componentStack;
    const event = this.props.logger.emit("app.crashed", {
      attributes: {
        routeKind: window.location.pathname.split("/")[1] || "home",
        errorCode: error.name,
      },
      error,
    });
    this.setState({ event });
  }
  render() {
    if (this.state.error)
      return (
        <CrashSurface
          error={this.state.error}
          event={this.state.event}
          logger={this.props.logger}
          exporter={this.props.exporter}
        />
      );
    return this.props.children;
  }
}

export function CrashBoundary({ children }: { children: ReactNode }) {
  const { logger, reportExporter } = useSettings();
  const [crash, setCrash] = useState<State>({ error: null, event: null });
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      event.preventDefault();
      const next =
        event.error instanceof Error
          ? event.error
          : new Error(event.message || "Unexpected application error.");
      const logged = logger.emit("app.crashed", {
        attributes: {
          routeKind: window.location.pathname.split("/")[1] || "home",
          errorCode: next.name,
        },
        error: next,
      });
      setCrash({ error: next, event: logged });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const next =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      const logged = logger.emit("app.crashed", {
        attributes: {
          routeKind: window.location.pathname.split("/")[1] || "home",
          errorCode: next.name,
        },
        error: next,
      });
      setCrash({ error: next, event: logged });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.documentElement.dataset.crashMonitorReady = "true";
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      delete document.documentElement.dataset.crashMonitorReady;
    };
  }, [logger]);
  if (crash.error)
    return (
      <CrashSurface
        error={crash.error}
        event={crash.event}
        logger={logger}
        exporter={reportExporter}
      />
    );
  return (
    <ReactCrashBoundary logger={logger} exporter={reportExporter}>
      {children}
    </ReactCrashBoundary>
  );
}

function CrashSurface({
  error,
  event,
  logger,
  exporter,
}: {
  error: Error;
  event: LogEvent | null;
  logger: EventPipeline;
  exporter: ReportExporter;
}) {
  const [message, setMessage] = useState("");
  const report = logger.report(event);
  return (
    <main className="app-crash-surface" aria-labelledby="app-crash-heading">
      <section role="alertdialog" aria-modal="true">
        <p>{translate("ui.crashBoundary.text.applicationRecovery")}</p>
        <h1 id="app-crash-heading">
          {translate(
            "ui.crashBoundary.text.jumpchainVisualizerEncounteredAnError",
          )}
        </h1>
        <p>
          {translate(
            "ui.crashBoundary.text.theCurrentDiagnosticSessionIsStillMemoryOnlyReview",
          )}
        </p>
        <dl>
          <div>
            <dt>{translate("ui.crashBoundary.text.application")}</dt>
            <dd>{translate("ui.crashBoundary.text.applicationVersion")}</dd>
          </div>
          <div>
            <dt>{translate("ui.crashBoundary.text.route")}</dt>
            <dd>{window.location.pathname}</dd>
          </div>
          <div>
            <dt>{translate("ui.crashBoundary.text.runtime")}</dt>
            <dd>{navigator.platform || "Browser runtime"}</dd>
          </div>
          <div>
            <dt>{translate("ui.crashBoundary.text.error")}</dt>
            <dd>
              {error.name}: {error.message}
            </dd>
          </div>
        </dl>
        <pre>{error.stack ?? "Stack trace unavailable."}</pre>
        <div>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(report);
                setMessage("Diagnostic report copied.");
              } catch {
                setMessage("Clipboard access is unavailable.");
              }
            }}
          >
            {translate("ui.crashBoundary.text.copyReport")}
          </button>
          <button
            type="button"
            onClick={async () => {
              const result = await exporter.save(
                "jumpchain-visualizer-crash-report.txt",
                report,
              );
              setMessage(
                result === "saved"
                  ? "Diagnostic report saved."
                  : "Save cancelled.",
              );
            }}
          >
            {translate("ui.crashBoundary.text.saveReport")}
          </button>
          <button type="button" onClick={() => window.location.assign("/")}>
            {translate("ui.crashBoundary.text.returnHome")}
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            {translate("ui.crashBoundary.text.reload")}
          </button>
        </div>
        <p role="status">{message}</p>
      </section>
    </main>
  );
}
