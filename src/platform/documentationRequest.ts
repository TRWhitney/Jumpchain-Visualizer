export function documentationRequestNeedsVite(
  requestUrl: string,
  fetchDestination?: string,
) {
  const url = new URL(requestUrl, "http://localhost");
  return (
    url.searchParams.has("import") ||
    (url.pathname.toLocaleLowerCase().endsWith(".css") &&
      fetchDestination === "script")
  );
}
