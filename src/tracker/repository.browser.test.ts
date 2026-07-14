import { beforeEach, expect, test } from "vitest";
import { createBlankTrackerFixture } from "./fixtures";
import { APPLICATION_DATABASE_NAME } from "../platform/indexedDb";
import { aggregateFromTracker, IndexedDbChainRepository } from "./repository";

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(APPLICATION_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
});

test("IndexedDB stores independent complete chain aggregates", async () => {
  const repository = new IndexedDbChainRepository();
  const first = aggregateFromTracker(
    "browser-one",
    createBlankTrackerFixture("One"),
    {
      description: "First durable chain",
      lastOpenedSequence: 2,
      lastOpenedLabel: "Opened today",
    },
  );
  const second = aggregateFromTracker(
    "browser-two",
    createBlankTrackerFixture("Two"),
    {
      description: "Second durable chain",
      lastOpenedSequence: 1,
      lastOpenedLabel: "Opened yesterday",
    },
  );
  await repository.save(first);
  await repository.save(second);
  expect((await repository.list()).map((item) => item.id).sort()).toEqual([
    "browser-one",
    "browser-two",
  ]);
  expect(await repository.load("browser-one")).toMatchObject({
    name: "One",
    description: "First durable chain",
    order: ["entry-earth"],
  });
});
