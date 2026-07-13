import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("application shell", () => {
  it("exposes the production application composition boundary", () => {
    expect(App).toBeTypeOf("function");
  });
});
