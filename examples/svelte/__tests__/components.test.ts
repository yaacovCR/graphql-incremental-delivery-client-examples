import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compile } from "svelte/compiler";

const exampleDir = dirname(dirname(fileURLToPath(import.meta.url)));

describe("Svelte components", () => {
  for (const fileName of [
    "ProductDetails.svelte",
    "ProductPage.svelte",
    "RecommendationsList.svelte",
  ]) {
    it(`compiles ${fileName}`, () => {
      const filePath = join(exampleDir, fileName);
      const source = readFileSync(filePath, "utf8");

      assert.doesNotThrow(() =>
        compile(source, { filename: filePath, generate: "client" }),
      );
    });
  }
});
