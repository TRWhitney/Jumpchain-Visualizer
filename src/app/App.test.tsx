import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("application scaffold", () => {
  it("exposes the application composition boundary", () => {
    expect(App).toBeTypeOf("function");
  });
});
