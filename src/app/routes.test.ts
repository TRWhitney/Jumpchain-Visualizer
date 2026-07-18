import { describe, expect, it } from "vitest";
import {
  exampleChainId,
  routeFromPath,
  titleForRoute,
  workspaceForRoute,
} from "./routes";

describe("application routes", () => {
  it("recognizes every primary shell destination", () => {
    expect(routeFromPath("/")).toEqual({ kind: "home", path: "/" });
    expect(routeFromPath("/editor/")).toEqual({
      kind: "editor-hub",
      path: "/editor",
    });
    expect(routeFromPath("/editor/workspace-one")).toMatchObject({
      kind: "editor-workspace",
      workspaceId: "workspace-one",
    });
    expect(routeFromPath("/chain")).toEqual({
      kind: "chain-hub",
      path: "/chain",
    });
    expect(routeFromPath(`/chain/${exampleChainId}`)).toMatchObject({
      kind: "chain-workspace",
      chainId: exampleChainId,
    });
    expect(routeFromPath("/settings")).toEqual({
      kind: "settings",
      path: "/settings",
    });
    expect(titleForRoute(routeFromPath("/settings"))).toBe(
      "Settings · Jumpchain Visualizer",
    );
  });

  it("keeps inaccessible workspace IDs inside their owning recovery area", () => {
    const editor = routeFromPath("/editor/missing-local-workspace");
    const chain = routeFromPath("/chain/missing-local-chain");
    expect(editor).toMatchObject({
      kind: "editor-workspace",
      workspaceId: "missing-local-workspace",
    });
    expect(chain).toMatchObject({ kind: "chain-workspace" });
    expect(workspaceForRoute(editor)).toBe("editor");
    expect(workspaceForRoute(chain)).toBe("chain");
    expect(titleForRoute(editor)).toContain("Editor workspace");
    expect(titleForRoute(chain)).toContain("unavailable");
    expect(titleForRoute(chain, "Saved name")).toBe(
      "Saved name · Chain Tracker",
    );
  });

  it("rejects unknown and malformed paths", () => {
    expect(routeFromPath("/something-else").kind).toBe("not-found");
    expect(routeFromPath("/chain/%E0%A4%A").kind).toBe("not-found");
  });
});
