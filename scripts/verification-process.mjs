export function childProcessGroupOptions(platform = process.platform) {
  return { detached: platform !== "win32" };
}

export function terminateProcessTree(
  child,
  platform = process.platform,
  signalProcess = process.kill,
) {
  if (platform === "win32" || !child.pid) return child.kill("SIGTERM");
  try {
    return signalProcess(-child.pid, "SIGTERM");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ESRCH")
      return false;
    throw error;
  }
}
