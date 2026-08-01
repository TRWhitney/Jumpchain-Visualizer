import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const OUTPUT_PATH = resolve("test-results/e2e-performance.json");

function stepCategory(title) {
  if (title.startsWith("Navigate to ")) return "navigation";
  if (title === "Create context") return "context";
  if (title === "Create page") return "page";
  if (title.includes("Screenshot")) return "screenshot";
  if (
    /^(Click|Check|Uncheck|Fill|Press|Type|Select|Set input files)/.test(title)
  )
    return "action";
  return "other";
}

function addAggregate(target, key, milliseconds) {
  const current = target.get(key) ?? { count: 0, milliseconds: 0 };
  current.count += 1;
  current.milliseconds += milliseconds;
  target.set(key, current);
}

function sortedAggregates(values) {
  return [...values.entries()]
    .map(([id, aggregate]) => ({ id, ...aggregate }))
    .sort((left, right) => right.milliseconds - left.milliseconds);
}

export default class PlaywrightPerformanceReporter {
  tests = [];
  projects = new Map();
  files = new Map();
  steps = new Map();

  onStepEnd(_test, _result, step) {
    if (step.steps?.length > 0) return;
    addAggregate(this.steps, stepCategory(step.title), step.duration);
  }

  onTestEnd(test, result) {
    const project = test.parent.project()?.name ?? "unknown";
    const file = relative(process.cwd(), test.location.file).replaceAll(
      "\\",
      "/",
    );
    const record = {
      project,
      file,
      title: test.title,
      milliseconds: result.duration,
      status: result.status,
      retry: result.retry,
    };
    this.tests.push(record);
    addAggregate(this.projects, project, result.duration);
    addAggregate(this.files, file, result.duration);
  }

  async onEnd(result) {
    const report = {
      schemaVersion: 1,
      status: result.status,
      generatedAt: new Date().toISOString(),
      totals: {
        tests: this.tests.length,
        milliseconds: this.tests.reduce(
          (total, test) => total + test.milliseconds,
          0,
        ),
      },
      steps: Object.fromEntries(
        sortedAggregates(this.steps).map(({ id, ...value }) => [id, value]),
      ),
      projects: sortedAggregates(this.projects),
      files: sortedAggregates(this.files),
      tests: [...this.tests].sort(
        (left, right) => right.milliseconds - left.milliseconds,
      ),
    };
    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

    const seconds = (milliseconds) => `${(milliseconds / 1_000).toFixed(1)}s`;
    console.log("\nPlaywright performance summary");
    console.log(
      `  ${report.totals.tests} results · ${seconds(report.totals.milliseconds)} summed test time`,
    );
    for (const project of report.projects)
      console.log(
        `  project ${project.id}: ${project.count} results · ${seconds(project.milliseconds)}`,
      );
    console.log("  slowest files:");
    for (const file of report.files.slice(0, 5))
      console.log(
        `    ${file.id}: ${file.count} results · ${seconds(file.milliseconds)}`,
      );
    console.log("  slowest tests:");
    for (const test of report.tests.slice(0, 5))
      console.log(
        `    ${seconds(test.milliseconds)} · ${test.project} · ${test.file} · ${test.title}`,
      );
  }
}

export { OUTPUT_PATH, stepCategory };
