#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

import featureList from "../harness/feature_list.json" with { type: "json" };
import { scenarios } from "./l2-benchmark/scenarios.mjs";
import { productCoverageIndex } from "./l2-benchmark/product-coverage-index.mjs";

const allowedStatuses = new Set(["covered", "covered_by_non_agent_gate", "known_gap"]);
const allowedLayers = new Set(["harness", "l0_l1", "l2", "frontend", "backend", "cloud", "native", "docs"]);
const scenarioIds = new Set(scenarios.map((scenario) => scenario.id));
const featureIds = new Set(featureList.features.map((feature) => feature.id));
const coverageByFeatureId = new Map(productCoverageIndex.map((entry) => [entry.featureId, entry]));

for (const feature of featureList.features) {
  assert.ok(coverageByFeatureId.has(feature.id), `missing product coverage entry for ${feature.id}`);
}

for (const entry of productCoverageIndex) {
  assert.ok(featureIds.has(entry.featureId), `coverage entry references unknown feature ${entry.featureId}`);
  assert.ok(allowedStatuses.has(entry.status), `${entry.featureId} has unsupported status ${entry.status}`);
  assert.ok(Array.isArray(entry.coverage) && entry.coverage.length > 0, `${entry.featureId} must list coverage evidence`);
  for (const coverage of entry.coverage) {
    assert.ok(allowedLayers.has(coverage.layer), `${entry.featureId} has unsupported layer ${coverage.layer}`);
    assert.ok(typeof coverage.evidence === "string" && coverage.evidence.trim(), `${entry.featureId} coverage item needs evidence`);
    for (const scenarioId of coverage.scenarioIds || []) {
      assert.ok(scenarioIds.has(scenarioId), `${entry.featureId} references missing L2 scenario ${scenarioId}`);
      assert.equal(Boolean(scenarios.find((scenario) => scenario.id === scenarioId)?.skip), false, `${scenarioId} should be runnable if referenced as coverage`);
    }
  }
  if (entry.status === "known_gap") {
    assert.ok(typeof entry.nextAction === "string" && entry.nextAction.trim(), `${entry.featureId} known gap needs nextAction`);
  }
}

const agentCoverage = coverageByFeatureId.get("agent-tool-first-2026-06-06");
for (const requiredScenario of [
  "feed-complete",
  "expense-record",
  "growth-measurement-complete",
]) {
  assert.ok(
    agentCoverage.coverage.some((coverage) => coverage.scenarioIds?.includes(requiredScenario)),
    `agent-tool-first-2026-06-06 should reference representative scenario ${requiredScenario}`,
  );
}

for (const nonAgentFeature of ["product-ia-2026-06-06", "frontend-001", "cloud-001", "mobile-001", "release-hardening-2026-06-05", "legal-data-2026-06-06"]) {
  const entry = coverageByFeatureId.get(nonAgentFeature);
  assert.ok(entry.status !== "covered", `${nonAgentFeature} should be explicit that it is covered by non-agent gates or has known gaps`);
  assert.ok(entry.coverage.some((coverage) => coverage.layer !== "l2"), `${nonAgentFeature} needs a non-L2 gate`);
}

const markdownPath = new URL("../docs/agent-product-coverage-index.md", import.meta.url);
assert.ok(fs.existsSync(markdownPath), "docs/agent-product-coverage-index.md should exist");
const markdown = fs.readFileSync(markdownPath, "utf8");
for (const featureId of featureIds) {
  assert.ok(markdown.includes(`\`${featureId}\``), `coverage markdown should mention ${featureId}`);
}

console.log("agent product coverage index tests passed");
