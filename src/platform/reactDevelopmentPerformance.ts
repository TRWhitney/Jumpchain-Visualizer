const developmentConsole = console as unknown as {
  timeStamp: typeof console.timeStamp | undefined;
};
const originalTimeStamp = import.meta.env.DEV
  ? developmentConsole.timeStamp
  : undefined;

// React's development-only Performance Tracks serialize changed props. Binary
// workspace values are Uint8Arrays, so that serializer enumerates every byte
// whenever a rendered asset is committed. React checks for console.timeStamp
// while react-dom is initialized; temporarily hiding it disables only those
// optional timeline tracks while retaining the development build and warnings.
if (originalTimeStamp) developmentConsole.timeStamp = undefined;

export function restoreDevelopmentConsoleTimeStamp() {
  if (originalTimeStamp) developmentConsole.timeStamp = originalTimeStamp;
}
