import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useSettings } from "./SettingsContext";
import type { EventPipeline } from "./logging";
import type { ReportExporter } from "./repository";

type Props = {
  children: ReactNode;
  logger: EventPipeline;
  exporter: ReportExporter;
};
type State = { error: Error | null };

class ReactCrashBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (!error.stack && info.componentStack) error.stack = info.componentStack;
    this.props.logger.emit("app.crashed", {
      attributes: {
        routeKind: window.location.pathname.split("/")[1] || "home",
        errorCode: error.name,
      },
      error,
    });
  }
  render() {
    if (this.state.error)
      return (
        <CrashSurface
          error={this.state.error}
          logger={this.props.logger}
          exporter={this.props.exporter}
        />
      );
    return this.props.children;
  }
}

export function CrashBoundary({ children }: { children: ReactNode }) {
  const { logger, reportExporter } = useSettings();
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const next =
        event.error instanceof Error
          ? event.error
          : new Error(event.message || "Unexpected application error.");
      logger.emit("app.crashed", {
        attributes: {
          routeKind: window.location.pathname.split("/")[1] || "home",
          errorCode: next.name,
        },
        error: next,
      });
      setError(next);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const next =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      logger.emit("app.crashed", {
        attributes: {
          routeKind: window.location.pathname.split("/")[1] || "home",
          errorCode: next.name,
        },
        error: next,
      });
      setError(next);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [logger]);
  if (error)
    return (
      <CrashSurface error={error} logger={logger} exporter={reportExporter} />
    );
  return (
    <ReactCrashBoundary logger={logger} exporter={reportExporter}>
      {children}
    </ReactCrashBoundary>
  );
}

function CrashSurface({
  error,
  logger,
  exporter,
}: {
  error: Error;
  logger: EventPipeline;
  exporter: ReportExporter;
}) {
  const [message, setMessage] = useState("");
  const event = logger.snapshot().at(-1) ?? null;
  const report = logger.report(event);
  return (
    <main className="app-crash-surface" aria-labelledby="app-crash-heading">
      <section role="alertdialog" aria-modal="true">
        <p>Application recovery</p>
        <h1 id="app-crash-heading">
          Jumpchain Visualizer encountered an error
        </h1>
        <p>
          The current diagnostic session is still memory-only. Review the report
          before copying or saving it; imported content, credentials, and user
          paths are excluded.
        </p>
        <dl>
          <div>
            <dt>Application</dt>
            <dd>Jumpchain Visualizer 0.1.0</dd>
          </div>
          <div>
            <dt>Route</dt>
            <dd>{window.location.pathname}</dd>
          </div>
          <div>
            <dt>Runtime</dt>
            <dd>{navigator.platform || "Browser runtime"}</dd>
          </div>
          <div>
            <dt>Error</dt>
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
            Copy report
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
            Save report…
          </button>
          <button type="button" onClick={() => window.location.assign("/")}>
            Return Home
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
        <p role="status">{message}</p>
      </section>
    </main>
  );
}
