#!/usr/bin/env node
import { prepareWorkspace } from "./workspace-lib.mjs";

const [source, mode] = process.argv.slice(2);
if (!source || !mode) {
  console.error(
    "Usage: prepare-workspace.mjs <source.pdf|page-image|page-directory> <semantic|facsimile>",
  );
  process.exit(2);
}

const result = prepareWorkspace(source, mode);
console.log(JSON.stringify(result, null, 2));
