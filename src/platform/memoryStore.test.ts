import { describe, expect, it } from "vitest";
import { ClonedMapStore, ClonedValueStore } from "./memoryStore";

describe("cloned memory stores", () => {
  it("isolate values on both read and write", () => {
    const source = { nested: { value: 1 } };
    const value = new ClonedValueStore(source);
    const first = value.read();
    first.nested.value = 2;
    expect(value.read()).toEqual(source);

    value.write(first);
    first.nested.value = 3;
    expect(value.read()).toEqual({ nested: { value: 2 } });
  });

  it("preserves insertion order and isolates map records", () => {
    const store = new ClonedMapStore(
      [
        { id: "first", value: 1 },
        { id: "second", value: 2 },
      ],
      (item) => item.id,
    );
    const listed = store.list();
    listed[0].value = 9;
    expect(store.list()).toEqual([
      { id: "first", value: 1 },
      { id: "second", value: 2 },
    ]);
    expect(store.get("missing")).toBeNull();
  });
});
