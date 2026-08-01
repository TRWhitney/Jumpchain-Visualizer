export function formatDuration(milliseconds) {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1_000).toFixed(1)}s`;
}

export function commandFailureDescription(result) {
  if (result.error) return result.error.message;
  if (result.signal) return `terminated by ${result.signal}`;
  return `exited with code ${result.code}`;
}

export function renderTimingSummary({ commands, waves, totalMilliseconds }) {
  const lines = ["", "Verification timing"];
  const longestName = Math.max(
    "Command".length,
    ...commands.map(({ script }) => script.length),
  );

  lines.push(
    `${"Command".padEnd(longestName)}  Result      Elapsed`,
    `${"".padEnd(longestName, "-")}  ----------  -------`,
  );

  for (const command of commands) {
    const result = command.ok ? "passed" : "failed";
    lines.push(
      `${command.script.padEnd(longestName)}  ${result.padEnd(10)}  ${formatDuration(command.milliseconds)}`,
    );
  }

  lines.push("", "Wave    Result      Elapsed", "------  ----------  -------");
  waves.forEach((wave, index) => {
    const result = wave.commands.every((command) => command.ok)
      ? "passed"
      : "failed";
    lines.push(
      `${`Wave ${index + 1}`.padEnd(6)}  ${result.padEnd(10)}  ${formatDuration(wave.milliseconds)}`,
    );
  });

  const criticalCommands = waves
    .map((wave) =>
      wave.commands.reduce(
        (longest, command) =>
          !longest || command.milliseconds > longest.milliseconds
            ? command
            : longest,
        undefined,
      ),
    )
    .filter(Boolean);
  const criticalMilliseconds = criticalCommands.reduce(
    (total, command) => total + command.milliseconds,
    0,
  );

  if (criticalCommands.length > 0) {
    lines.push(
      `Critical path: ${criticalCommands.map(({ script }) => script).join(" -> ")} (${formatDuration(criticalMilliseconds)})`,
    );
  }
  lines.push(`Total: ${formatDuration(totalMilliseconds)}`);
  return lines.join("\n");
}
