import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every production build is gated by the complete regression suite", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as {
    scripts?: Record<string, string>;
  };
  assert.equal(packageJson.scripts?.prebuild, "npm run test:regression");
  assert.equal(packageJson.scripts?.test, "npm run test:regression");
  assert.match(packageJson.scripts?.["test:regression"] ?? "", /src\/\*\*\/\*\.test\.ts/);
});
