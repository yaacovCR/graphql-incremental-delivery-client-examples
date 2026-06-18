import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";

const exampleDir = dirname(dirname(fileURLToPath(import.meta.url)));

describe("Vue components", () => {
  for (const fileName of [
    "ProductDetails.vue",
    "ProductPage.vue",
    "RecommendationsList.vue",
  ]) {
    it(`compiles ${fileName}`, () => {
      const filePath = join(exampleDir, fileName);
      const source = readFileSync(filePath, "utf8");
      const parsed = parse(source, { filename: filePath });

      assert.deepEqual(parsed.errors, []);

      if (
        parsed.descriptor.script != null ||
        parsed.descriptor.scriptSetup != null
      ) {
        compileScript(parsed.descriptor, { id: filePath });
      }

      if (parsed.descriptor.template == null) {
        return;
      }

      const template = compileTemplate({
        filename: filePath,
        id: filePath,
        source: parsed.descriptor.template.content,
      });

      assert.deepEqual(template.errors, []);
    });
  }
});
