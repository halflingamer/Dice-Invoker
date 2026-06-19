import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSafePreviewFiles,
  createHostingerHtaccess,
  getApiIsolationPaths,
  getPreviewBuildCleanupPaths,
  getNpmInvocation,
} from "./hostinger-preview-lib.mjs";

test("Hostinger preview headers deny framing and never enable open CORS", () => {
  const htaccess = createHostingerHtaccess();

  assert.match(htaccess, /Header always set X-Frame-Options "DENY"/);
  assert.match(htaccess, /Header always set X-Content-Type-Options "nosniff"/);
  assert.doesNotMatch(htaccess, /Access-Control-Allow-Origin/);
});

test("Hostinger preview rejects server routes and private configuration", () => {
  assert.throws(
    () => assertSafePreviewFiles([
      { path: "api/runs/index.html", content: "" },
    ]),
    /rota de servidor/i,
  );

  assert.throws(
    () => assertSafePreviewFiles([
      { path: "index.html", content: "DATABASE_URL=postgresql:\/\/secret" },
    ]),
    /segredo/i,
  );
});

test("Hostinger preview accepts ordinary static game files", () => {
  assert.doesNotThrow(() => assertSafePreviewFiles([
    { path: "index.html", content: "<main>Dice Invoker</main>" },
    { path: "_next/static/game.js", content: "console.log('demo')" },
    { path: "assets/items/coin.png", content: null },
  ]));
});

test("Windows invokes npm through Node instead of spawning a cmd file", () => {
  assert.deepEqual(
    getNpmInvocation("win32", { npm_execpath: "C:\\npm\\npm-cli.js" }, "C:\\node\\node.exe"),
    { command: "C:\\node\\node.exe", args: ["C:\\npm\\npm-cli.js"] },
  );
});

test("static preview removes stale Next route types before building", () => {
  assert.deepEqual(
    getPreviewBuildCleanupPaths("C:\\project"),
    ["C:\\project\\.next", "C:\\project\\out"],
  );
});

test("API backup stays outside the Next app routing tree", () => {
  const paths = getApiIsolationPaths("C:\\project");

  assert.equal(paths.source, "C:\\project\\src\\app\\api");
  assert.equal(paths.backup, "C:\\project\\.hostinger-api-backup");
  assert.equal(paths.backup.includes("\\src\\app\\"), false);
});
