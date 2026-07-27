import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { translate } from "../localization";
import type { WelcomeTourBranch, WelcomeTourSessionV1 } from "./model";
import { progressForStep, welcomeTourSteps } from "./steps";
import "./welcomeTour.css";

type TargetGeometry = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type WelcomeTourOverlayProps = {
  session: WelcomeTourSessionV1;
  actionComplete: boolean;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
  onExit: () => void;
  onChooseBranch: (branch: WelcomeTourBranch) => void;
  onChooseAdvanced: (advanced: boolean) => void;
  onFinishBranch: (nextBranch: WelcomeTourBranch | null) => void;
  onChooseMode: (
    mode: "advanced" | "beginner-friendly" | "keep-current",
  ) => void;
};

const focusableSelector =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

function expandedGeometry(rect: DOMRect): TargetGeometry {
  const padding = 8;
  const top = Math.max(8, rect.top - padding);
  const left = Math.max(8, rect.left - padding);
  const right = Math.min(window.innerWidth - 8, rect.right + padding);
  const bottom = Math.min(window.innerHeight - 8, rect.bottom + padding);
  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function coachmarkStyle(
  target: TargetGeometry | null,
  cardHeight: number,
): CSSProperties | undefined {
  if (!target || window.innerWidth < 720) return undefined;
  const width = Math.min(390, window.innerWidth - 32);
  const gap = 18;
  const height = Math.min(Math.max(cardHeight, 320), window.innerHeight - 32);
  const maximumTop = Math.max(16, window.innerHeight - height - 16);
  const alignedTop = Math.min(Math.max(16, target.top), maximumTop);
  if (window.innerWidth - target.right >= width + gap)
    return { width, left: target.right + gap, top: alignedTop };
  if (target.left >= width + gap)
    return {
      width,
      left: target.left - width - gap,
      top: alignedTop,
    };
  if (window.innerHeight - target.bottom >= height + gap)
    return {
      width,
      left: Math.min(Math.max(16, target.left), window.innerWidth - width - 16),
      top: target.bottom + gap,
    };
  if (target.top >= height + gap)
    return {
      width,
      left: Math.min(Math.max(16, target.left), window.innerWidth - width - 16),
      top: target.top - height - gap,
    };
  const placeAbove = target.top >= window.innerHeight - target.bottom;
  return {
    width,
    left: Math.min(Math.max(16, target.left), window.innerWidth - width - 16),
    top: placeAbove
      ? Math.max(16, target.top - height - gap)
      : Math.min(maximumTop, target.bottom + gap),
  };
}

export function WelcomeTourOverlay(props: WelcomeTourOverlayProps) {
  const { onExit, session } = props;
  const step = welcomeTourSteps[session.stepId];
  const showingCompletedAction = Boolean(
    props.actionComplete && step.completedTarget,
  );
  const targetName = showingCompletedAction
    ? (step.completedTarget ?? null)
    : step.target;
  const descriptionId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState<TargetGeometry | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const progress = progressForStep(session.stepId);

  useLayoutEffect(() => {
    if (!targetName) {
      const frame = window.requestAnimationFrame(() => {
        setTargetMissing(false);
        setTarget(null);
        setGeometry(null);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    let live = true;
    let observer: ResizeObserver | null = null;
    let decoratedTarget: HTMLElement | null = null;
    const clearDecoratedTarget = () => {
      decoratedTarget?.classList.remove("is-welcome-tour-target");
      if (decoratedTarget?.getAttribute("aria-describedby") === descriptionId)
        decoratedTarget.removeAttribute("aria-describedby");
      decoratedTarget = null;
    };
    const update = () => {
      if (!live) return;
      const scope = step.branch
        ? document.querySelector<HTMLElement>(
            `[data-welcome-tour-scope="${step.branch}"]`,
          )
        : document;
      const found = scope?.querySelector<HTMLElement>(
        `[data-tour-target="${targetName}"]`,
      );
      if (!found) {
        clearDecoratedTarget();
        setTarget(null);
        setGeometry(null);
        return;
      }
      const isNewTarget = decoratedTarget !== found;
      if (isNewTarget) clearDecoratedTarget();
      const initialRect = found.getBoundingClientRect();
      if (
        isNewTarget &&
        (initialRect.bottom < 16 ||
          initialRect.top > window.innerHeight - 16 ||
          initialRect.right < 16 ||
          initialRect.left > window.innerWidth - 16)
      )
        found.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "auto",
        });
      setTarget(found);
      setGeometry(expandedGeometry(found.getBoundingClientRect()));
      found.classList.add("is-welcome-tour-target");
      found.setAttribute("aria-describedby", descriptionId);
      decoratedTarget = found;
      observer?.disconnect();
      observer = new ResizeObserver(() =>
        setGeometry(expandedGeometry(found.getBoundingClientRect())),
      );
      observer.observe(found);
    };
    const frame = window.requestAnimationFrame(() => {
      setTargetMissing(false);
      update();
    });
    const mutation = new MutationObserver(update);
    mutation.observe(document.body, { subtree: true, childList: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const timeout = window.setTimeout(() => {
      if (
        !(step.branch
          ? document
              .querySelector(`[data-welcome-tour-scope="${step.branch}"]`)
              ?.querySelector(`[data-tour-target="${targetName}"]`)
          : document.querySelector(`[data-tour-target="${targetName}"]`))
      )
        setTargetMissing(true);
    }, 700);
    return () => {
      live = false;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      mutation.disconnect();
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      clearDecoratedTarget();
    };
  }, [
    descriptionId,
    session.revision,
    session.stepId,
    step.branch,
    targetName,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => headingRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [session.stepId]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const update = () => setCardHeight(card.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(card);
    return () => observer.disconnect();
  }, [session.stepId]);

  const central =
    !targetName || targetMissing || (Boolean(targetName) && !geometry);
  const style = useMemo(
    () => coachmarkStyle(geometry, cardHeight),
    [cardHeight, geometry],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && session.stepId !== "mode-choice") {
        event.preventDefault();
        onExit();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(target?.querySelectorAll<HTMLElement>(focusableSelector) ?? []),
        ...(cardRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ??
          []),
      ].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? current <= 0
          ? focusable.length - 1
          : current - 1
        : current < 0 || current === focusable.length - 1
          ? 0
          : current + 1;
      event.preventDefault();
      focusable[next].focus();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onExit, session.stepId, target]);

  return createPortal(
    <div
      className={`welcome-tour-layer${central ? " is-central" : ""}`}
      data-tour-step={session.stepId}
    >
      {geometry && !central ? (
        <>
          <div
            className="welcome-tour-scrim"
            style={{ inset: `0 0 ${window.innerHeight - geometry.top}px 0` }}
          />
          <div
            className="welcome-tour-scrim"
            style={{
              top: geometry.top,
              left: 0,
              width: geometry.left,
              height: geometry.height,
            }}
          />
          <div
            className="welcome-tour-scrim"
            style={{
              top: geometry.top,
              left: geometry.right,
              right: 0,
              height: geometry.height,
            }}
          />
          <div
            className="welcome-tour-scrim"
            style={{ inset: `${geometry.bottom}px 0 0 0` }}
          />
          <div
            className="welcome-tour-spotlight"
            aria-hidden="true"
            style={{
              top: geometry.top,
              left: geometry.left,
              width: geometry.width,
              height: geometry.height,
            }}
          />
        </>
      ) : (
        <div className="welcome-tour-full-scrim" />
      )}
      <section
        ref={cardRef}
        className="welcome-tour-card"
        role="dialog"
        aria-modal={central || undefined}
        aria-labelledby={`${descriptionId}-heading`}
        aria-describedby={descriptionId}
        style={style}
      >
        <header className="welcome-tour-card-header">
          <div className="welcome-tour-mark" aria-hidden="true">
            <span>{translate("ui.appShell.text.jv")}</span>
          </div>
          <div>
            <p>
              {translate(`tour.sections.${step.section}`)}
              <span aria-hidden="true"> · </span>
              {translate("tour.progress", progress)}
            </p>
            <h2 ref={headingRef} id={`${descriptionId}-heading`} tabIndex={-1}>
              {targetMissing
                ? translate("tour.targetMissing.title")
                : translate(
                    `tour.steps.${session.stepId}.${
                      showingCompletedAction ? "completedTitle" : "title"
                    }`,
                  )}
            </h2>
          </div>
          {session.stepId !== "mode-choice" && (
            <button
              type="button"
              className="welcome-tour-exit"
              onClick={props.onExit}
            >
              {translate("tour.actions.exit")}
            </button>
          )}
        </header>

        <div
          className="welcome-tour-progress"
          aria-label={translate("tour.progressLabel", progress)}
        >
          {Array.from({ length: progress.total }, (_, index) => (
            <span
              key={index}
              className={index < progress.current ? "is-complete" : ""}
            />
          ))}
        </div>

        <div className="welcome-tour-copy">
          <p id={descriptionId}>
            {targetMissing
              ? translate("tour.targetMissing.body")
              : translate(
                  `tour.steps.${session.stepId}.${
                    showingCompletedAction ? "completedBody" : "body"
                  }`,
                )}
          </p>
          {!targetMissing && (
            <p className="welcome-tour-supporting-copy">
              {translate(
                `tour.steps.${session.stepId}.${
                  showingCompletedAction ? "completedDetail" : "detail"
                }`,
              )}
            </p>
          )}
          {step.action && props.actionComplete && (
            <div className="welcome-tour-success" role="status">
              <span aria-hidden="true">✓</span>
              {translate("tour.actions.stepComplete")}
            </div>
          )}
        </div>

        <SpecialStepContent {...props} />

        {![
          "choose-branch",
          "editor-advanced-offer",
          "editor-summary",
          "tracker-summary",
          "mode-choice",
        ].includes(session.stepId) && (
          <footer className="welcome-tour-actions">
            {session.stepId !== "welcome" && (
              <button type="button" onClick={props.onBack}>
                {translate("tour.actions.back")}
              </button>
            )}
            {targetMissing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setTargetMissing(false);
                    window.dispatchEvent(new Event("resize"));
                  }}
                >
                  {translate("tour.actions.retry")}
                </button>
                <button
                  type="button"
                  className="is-primary"
                  onClick={props.onSkip}
                >
                  {translate("tour.actions.skipStep")}
                </button>
              </>
            ) : (
              <>
                {step.action && !props.actionComplete && (
                  <button type="button" onClick={props.onSkip}>
                    {translate("tour.actions.skipStep")}
                  </button>
                )}
                <button
                  type="button"
                  className="is-primary"
                  disabled={step.action && !props.actionComplete}
                  onClick={props.onContinue}
                >
                  {session.stepId === "welcome"
                    ? translate("tour.actions.start")
                    : translate("tour.actions.continue")}
                </button>
              </>
            )}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}

function SpecialStepContent(props: WelcomeTourOverlayProps) {
  const { session } = props;
  if (session.stepId === "choose-branch")
    return (
      <div className="welcome-tour-branch-grid">
        {(["editor", "tracker"] as const).map((branch) => (
          <button
            key={branch}
            type="button"
            onClick={() => props.onChooseBranch(branch)}
          >
            <span className={`welcome-tour-branch-icon is-${branch}`}>
              {branch === "editor" ? "✎" : "↝"}
            </span>
            <strong>{translate(`tour.branch.${branch}.title`)}</strong>
            <small>{translate(`tour.branch.${branch}.body`)}</small>
          </button>
        ))}
      </div>
    );
  if (session.stepId === "editor-advanced-offer")
    return (
      <div className="welcome-tour-choice-actions">
        <button
          type="button"
          className="is-primary"
          onClick={() => props.onChooseAdvanced(true)}
        >
          {translate("tour.actions.exploreAdvanced")}
        </button>
        <button type="button" onClick={() => props.onChooseAdvanced(false)}>
          {translate("tour.actions.notNow")}
        </button>
      </div>
    );
  if (
    session.stepId === "editor-summary" ||
    session.stepId === "tracker-summary"
  ) {
    const other = session.stepId === "editor-summary" ? "tracker" : "editor";
    const otherDone = session.completedBranches.includes(other);
    return (
      <div className="welcome-tour-choice-actions">
        {!otherDone && (
          <button
            type="button"
            className="is-primary"
            onClick={() => props.onFinishBranch(other)}
          >
            {translate("tour.actions.continueOther", {
              branch: translate(`tour.branch.${other}.short`),
            })}
          </button>
        )}
        <button
          type="button"
          className={otherDone ? "is-primary" : ""}
          onClick={() => props.onFinishBranch(null)}
        >
          {translate("tour.actions.finishTour")}
        </button>
      </div>
    );
  }
  if (session.stepId === "mode-choice")
    return (
      <>
        <div className="welcome-tour-mode-grid">
          <button
            type="button"
            onClick={() => props.onChooseMode("beginner-friendly")}
          >
            <span aria-hidden="true">☀</span>
            <strong>{translate("tour.mode.beginner.title")}</strong>
            <small>{translate("tour.mode.beginner.body")}</small>
          </button>
          <button type="button" onClick={() => props.onChooseMode("advanced")}>
            <span aria-hidden="true">◆</span>
            <strong>{translate("tour.mode.advanced.title")}</strong>
            <small>{translate("tour.mode.advanced.body")}</small>
          </button>
        </div>
        {session.restartedFromSettings && (
          <div className="welcome-tour-choice-actions">
            <button
              type="button"
              onClick={() => props.onChooseMode("keep-current")}
            >
              {translate("tour.mode.keepCurrent")}
            </button>
          </div>
        )}
      </>
    );
  return null;
}
