import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  checkNoticeFingerprint,
  fallbackLicense,
  productionCargoPackageIds,
  renderNotices,
  sourceFingerprint,
} from "./generate-third-party-notices.mjs";

test("Cargo production traversal excludes build and development edges", () => {
  const metadata = {
    workspace_members: ["app"],
    resolve: {
      nodes: [
        {
          id: "app",
          deps: [
            { pkg: "runtime", dep_kinds: [{ kind: null }] },
            { pkg: "build-only", dep_kinds: [{ kind: "build" }] },
            { pkg: "test-only", dep_kinds: [{ kind: "dev" }] },
          ],
        },
        {
          id: "runtime",
          deps: [{ pkg: "transitive", dep_kinds: [{ kind: null }] }],
        },
        { id: "transitive", deps: [] },
      ],
    },
  };

  assert.deepEqual([...productionCargoPackageIds(metadata)].sort(), [
    "runtime",
    "transitive",
  ]);
});

test("notice rendering is sorted and deduplicates identical license documents", () => {
  const document = {
    name: "LICENSE",
    text: "Copyright Example\n\nPermission granted.",
    provenance: "upstream package",
  };
  const dependency = (name) => ({
    ecosystem: "Rust",
    name,
    version: "1.0.0",
    license: "MIT",
    authors: [],
    source: undefined,
    documents: [document],
  });
  const notice = renderNotices(
    [dependency("z-last"), dependency("a-first")],
    "a".repeat(64),
  );

  assert.ok(notice.indexOf("a-first@1.0.0") < notice.indexOf("z-last@1.0.0"));
  assert.match(notice, /Unique license documents: 1/);
  assert.equal(notice.match(/Copyright Example/g)?.length, 1);
});

test("reviewed fallbacks choose a permissible license and reject unknown terms", () => {
  assert.equal(
    fallbackLicense("dual-crate", "Apache-2.0 OR MIT").selectedLicense,
    "MIT",
  );
  assert.equal(
    fallbackLicense("selectors", "MPL-2.0").selectedLicense,
    "MPL-2.0",
  );
  assert.throws(
    () => fallbackLicense("unknown", "GPL-3.0-only"),
    /no reviewed fallback/,
  );
});

test("fingerprint checking reports stale generated notices", () => {
  const current = "b".repeat(64);
  assert.doesNotThrow(() =>
    checkNoticeFingerprint(`Source fingerprint: ${current}\n`, current),
  );
  assert.throws(
    () =>
      checkNoticeFingerprint(
        `Source fingerprint: ${"c".repeat(64)}\n`,
        current,
      ),
    /is stale/,
  );
});

test("checked-in notices cover shipped dependencies and omit development tools", () => {
  const notice = readFileSync("THIRD_PARTY_NOTICES.txt", "utf8");
  checkNoticeFingerprint(notice, sourceFingerprint());

  for (const inventoryEntry of [
    "JavaScript: @tauri-apps/api@2.11.1",
    "JavaScript: dictionary-en@4.0.0",
    "JavaScript: react@19.2.7",
    "Rust: rusqlite@",
    "Rust: tauri@",
  ]) {
    assert.ok(notice.includes(inventoryEntry), inventoryEntry);
  }
  for (const excludedEntry of [
    "JavaScript: @playwright/test@",
    "JavaScript: @tauri-apps/cli@",
    "JavaScript: pdfjs-dist@",
    "JavaScript: vitest@",
  ]) {
    assert.ok(!notice.includes(excludedEntry), excludedEntry);
  }
  assert.match(notice, /Copyright 2000-2018 by Kevin Atkinson/);
  assert.ok(!notice.includes("<year>"));
  assert.ok(!notice.includes(process.cwd()));
});
