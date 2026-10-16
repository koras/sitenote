import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("кнопки автоматически загружаются на HTTP и HTTPS страницах", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.content_scripts, [{
    matches: ["http://*/*", "https://*/*"],
    js: ["notes-core.js", "content.js"],
    run_at: "document_idle"
  }]);
  assert.ok(manifest.permissions.includes("storage"));
});
