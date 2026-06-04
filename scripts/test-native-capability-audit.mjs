#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { productCoverageIndex } from "./l2-benchmark/product-coverage-index.mjs";
import { nativeCapabilityAudit, validateNativeCapabilityAudit } from "./native-capability-audit.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const allowedStatuses = new Set(["static_covered", "requires_device", "unsupported"]);
const requiredCapabilities = [
  "asr-voice-input",
  "local-notifications",
  "full-screen-ringing",
  "haptics",
  "native-media-picker",
  "ota-updater",
  "safe-area-keyboard",
];

assert.ok(Array.isArray(nativeCapabilityAudit), "nativeCapabilityAudit must be an array");
assert.equal(new Set(nativeCapabilityAudit.map((item) => item.id)).size, nativeCapabilityAudit.length, "native capabilities must have unique ids");

const auditById = new Map(nativeCapabilityAudit.map((item) => [item.id, item]));
for (const capabilityId of requiredCapabilities) {
  assert.ok(auditById.has(capabilityId), `missing native capability ${capabilityId}`);
}

for (const capability of nativeCapabilityAudit) {
  assert.ok(allowedStatuses.has(capability.status), `${capability.id} has unsupported status ${capability.status}`);
  assert.ok(typeof capability.productSurface === "string" && capability.productSurface.trim(), `${capability.id} needs productSurface`);
  assert.ok(typeof capability.requiredGate === "string" && capability.requiredGate.trim(), `${capability.id} needs requiredGate`);
  assert.ok(Array.isArray(capability.staticEvidence) && capability.staticEvidence.length > 0, `${capability.id} needs staticEvidence`);
  for (const evidence of capability.staticEvidence) {
    assert.ok(typeof evidence.path === "string" && evidence.path.trim(), `${capability.id} evidence needs path`);
    const evidencePath = path.join(repoRoot, evidence.path);
    assert.ok(fs.existsSync(evidencePath), `${capability.id} evidence path missing: ${evidence.path}`);
    if (evidence.includes) {
      const content = fs.readFileSync(evidencePath, "utf8");
      assert.ok(content.includes(evidence.includes), `${capability.id} evidence ${evidence.path} should include ${evidence.includes}`);
    }
  }
  if (capability.status === "requires_device") {
    assert.ok(typeof capability.deviceGap === "string" && capability.deviceGap.trim(), `${capability.id} requires_device needs deviceGap`);
    assert.ok(typeof capability.manualProbe === "string" && capability.manualProbe.trim(), `${capability.id} requires_device needs manualProbe`);
  }
}

const validation = validateNativeCapabilityAudit({ repoRoot });
assert.deepEqual(validation.errors, [], `native capability audit validation failed:\n${validation.errors.join("\n")}`);

const mobileCoverage = productCoverageIndex.find((entry) => entry.featureId === "mobile-001");
assert.ok(mobileCoverage, "product coverage index should include mobile-001");
assert.ok(
  mobileCoverage.coverage.some((coverage) => coverage.evidence.includes("native-capability-audit")),
  "mobile-001 coverage should reference native-capability-audit",
);
for (const capabilityId of requiredCapabilities) {
  assert.ok(
    mobileCoverage.coverage.some((coverage) => coverage.evidence.includes(capabilityId) || coverage.capabilityIds?.includes(capabilityId)),
    `mobile-001 coverage should mention ${capabilityId}`,
  );
}

const markdownPath = path.join(repoRoot, "docs/native-capability-benchmark.md");
assert.ok(fs.existsSync(markdownPath), "docs/native-capability-benchmark.md should exist");
const markdown = fs.readFileSync(markdownPath, "utf8");
for (const capabilityId of requiredCapabilities) {
  assert.ok(markdown.includes(`\`${capabilityId}\``), `native benchmark markdown should mention ${capabilityId}`);
}

console.log("native capability audit tests passed");
