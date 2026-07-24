import { spawn } from "node:child_process";
import { PLAYWRIGHT_MODES } from "./verification-contract.mjs";

const mode = process.argv[2] ?? "chromium";
const forwardedArguments = process.argv
  .slice(3)
  .filter((argument) => argument !== "--");
const corepackCommand =
  process.platform === "win32" ? "corepack.cmd" : "corepack";

const selectedMode = PLAYWRIGHT_MODES[mode];
if (!selectedMode) {
  console.error(
    `Unknown Playwright mode "${mode}". Expected one of: ${Object.keys(PLAYWRIGHT_MODES).join(", ")}.`,
  );
  process.exit(2);
}

const child = spawn(
  corepackCommand,
  [
    "pnpm",
    "exec",
    "playwright",
    "test",
    ...selectedMode.arguments,
    ...forwardedArguments,
  ],
  {
    env: { ...process.env, ...selectedMode.environment },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
