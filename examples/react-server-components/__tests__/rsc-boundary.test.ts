import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("React Server Components client boundary", () => {
  it("rejects the raw GraphQL.js null-prototype object passed to a Client Component", () => {
    const fixturePath = fileURLToPath(
      new URL("./serializeClientBoundary.fixture.ts", import.meta.url),
    );
    const result = spawnSync(
      process.execPath,
      ["--conditions", "react-server", "--import", "tsx", fixturePath],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const payload = JSON.parse(result.stdout) as {
      messages: Array<string>;
      summaryPrototypeIsNull: boolean;
    };

    assert.equal(payload.summaryPrototypeIsNull, true);
    assert.match(
      payload.messages.join("\n"),
      /Only plain objects, and a few built-ins, can be passed to Client Components from Server Components\. Classes or null prototypes are not supported\./,
    );
  });
});
