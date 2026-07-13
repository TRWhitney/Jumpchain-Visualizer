export const exampleWorkspaceId = "ws-7f3a";
export const exampleChainId = "ch-92b1";

export type ApplicationRoute =
  | { kind: "home"; path: "/" }
  | { kind: "editor-hub"; path: "/editor" }
  | {
      kind: "editor-workspace";
      path: string;
      workspaceId: string;
      available: boolean;
    }
  | { kind: "chain-hub"; path: "/chain" }
  | {
      kind: "chain-workspace";
      path: string;
      chainId: string;
    }
  | { kind: "not-found"; path: string };

const normalizedPath = (pathname: string) => {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
};

const decodedId = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export function routeFromPath(pathname: string): ApplicationRoute {
  const path = normalizedPath(pathname);
  if (path === "/") return { kind: "home", path };
  if (path === "/editor") return { kind: "editor-hub", path };
  if (path === "/chain") return { kind: "chain-hub", path };

  const editorMatch = /^\/editor\/([^/]+)$/.exec(path);
  if (editorMatch) {
    const workspaceId = decodedId(editorMatch[1]);
    if (workspaceId === null) return { kind: "not-found", path };
    return {
      kind: "editor-workspace",
      path,
      workspaceId,
      available: workspaceId === exampleWorkspaceId,
    };
  }

  const chainMatch = /^\/chain\/([^/]+)$/.exec(path);
  if (chainMatch) {
    const chainId = decodedId(chainMatch[1]);
    if (chainId === null) return { kind: "not-found", path };
    return {
      kind: "chain-workspace",
      path,
      chainId,
    };
  }

  return { kind: "not-found", path };
}

export function titleForRoute(route: ApplicationRoute, chainName?: string) {
  switch (route.kind) {
    case "home":
      return "Home · Jumpchain Visualizer";
    case "editor-hub":
      return "Editor · Jumpchain Visualizer";
    case "editor-workspace":
      return route.available
        ? "Example Jump · Editor"
        : "Editor workspace unavailable · Jumpchain Visualizer";
    case "chain-hub":
      return "Chain Tracker · Jumpchain Visualizer";
    case "chain-workspace":
      return chainName
        ? `${chainName} · Chain Tracker`
        : "Chain unavailable · Jumpchain Visualizer";
    case "not-found":
      return "Page not found · Jumpchain Visualizer";
  }
}

export function workspaceForRoute(route: ApplicationRoute) {
  if (route.kind === "editor-hub" || route.kind === "editor-workspace")
    return "editor";
  if (route.kind === "chain-hub" || route.kind === "chain-workspace")
    return "chain";
  return "home";
}
