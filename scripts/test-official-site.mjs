#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = process.cwd();
const tempDir = mkdtempSync(path.join(tmpdir(), "xiaobao-official-site-"));

try {
  const outfile = path.join(tempDir, "siteRouting.mjs");
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/siteRouting.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });
  const { shouldRenderOfficialSite } = await import(pathToFileURL(outfile).href);

  assert.equal(
    shouldRenderOfficialSite({ pathname: "/", hostname: "skbaby.top", buildTarget: "" }),
    true,
    "skbaby.top root should render the official website",
  );
  assert.equal(
    shouldRenderOfficialSite({ pathname: "/", hostname: "www.skbaby.top", buildTarget: "" }),
    true,
    "www.skbaby.top root should render the official website",
  );
  assert.equal(
    shouldRenderOfficialSite({ pathname: "/official", hostname: "localhost", buildTarget: "" }),
    true,
    "legacy /official route should still render the official website",
  );
  assert.equal(
    shouldRenderOfficialSite({ pathname: "/app", hostname: "skbaby.top", buildTarget: "" }),
    false,
    "domain /app should remain the Web App entry",
  );
  assert.equal(
    shouldRenderOfficialSite({ pathname: "/", hostname: "localhost", buildTarget: "" }),
    false,
    "localhost root should remain the app entry for smoke/dev",
  );
  assert.equal(
    shouldRenderOfficialSite({ pathname: "/", hostname: "skbaby.top", buildTarget: "mobile" }),
    false,
    "mobile builds should always render the app, even on website domains",
  );

  const officialSource = readFileSync("frontend/src/OfficialSite.tsx", "utf8");
  assert.match(officialSource, /敬请期待/, "download cards should show coming-soon copy");
  assert.match(officialSource, /浙ICP备2026046330号-1/, "official site should display the ICP filing number");
  assert.doesNotMatch(officialSource, /PUBLIC_SECURITY/, "official site should not keep public-security placeholder constants");
  assert.doesNotMatch(officialSource, /公安备案|公网安备/, "official site should not render public-security placeholder copy");
  assert.doesNotMatch(officialSource, /official-police-icon/, "official site should not render a placeholder police badge");
  assert.match(officialSource, /href="\/app"/, "official site Web App action should go to /app");
  assert.doesNotMatch(officialSource, /\bQrCode\b/, "official site should not render placeholder QR code icons");
  assert.doesNotMatch(officialSource, /二维码/, "official site should not mention placeholder QR codes");

  console.log("official site routing and content tests passed");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
