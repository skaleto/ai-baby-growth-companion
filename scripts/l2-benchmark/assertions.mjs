/** Resolve a dotted path (with numeric segments for arrays) inside a JSON value. */
export function getPath(obj, dottedPath) {
  if (obj == null) return undefined;
  const segments = String(dottedPath).split(".");
  let cursor = obj;
  for (const seg of segments) {
    if (cursor == null) return undefined;
    const key = /^\d+$/.test(seg) ? Number(seg) : seg;
    cursor = cursor[key];
  }
  return cursor;
}

export function assertOp(actual, op, expected) {
  switch (op) {
    case "eq":
      return { pass: actual === expected, detail: `${JSON.stringify(actual)} === ${JSON.stringify(expected)}` };
    case "approx": {
      const a = Number(actual);
      const e = Number(expected);
      const pass = Number.isFinite(a) && Number.isFinite(e) && Math.abs(a - e) <= Math.max(0.01, Math.abs(e) * 0.01);
      return { pass, detail: `${JSON.stringify(actual)} ~= ${JSON.stringify(expected)}` };
    }
    case "present":
      return { pass: actual !== undefined && actual !== null && actual !== "", detail: `present(${JSON.stringify(actual)})` };
    case "contains": {
      const pass = typeof actual === "string" && actual.includes(String(expected));
      return { pass, detail: `${JSON.stringify(actual)} contains ${JSON.stringify(expected)}` };
    }
    case "notContains": {
      const pass = typeof actual !== "string" || !actual.includes(String(expected));
      return { pass, detail: `${JSON.stringify(actual)} not contains ${JSON.stringify(expected)}` };
    }
    default:
      return { pass: false, detail: `unknown op ${op}` };
  }
}

const MUTATION_EFFECT_TYPES = new Set(["careLog", "reminder", "expenseItem", "albumItem", "growthEvent", "growthMeasurement", "memory"]);
const MUTATION_MODES = new Set(["auto", "pending"]);
const MUTATION_TOOL_IDS = new Set([
  "record_feeding_event",
  "record_sleep_event",
  "record_diaper_event",
  "record_temperature_event",
  "create_growth_measurement_pending",
  "create_milestone_pending",
  "create_expense_pending",
]);
const EFFECT_TOOL_FALLBACKS = {
  careLog: ["record_feeding_event", "record_sleep_event", "record_diaper_event", "record_temperature_event"],
  growthEvent: ["create_milestone_pending"],
  growthMeasurement: ["create_growth_measurement_pending"],
  expenseItem: ["create_expense_pending"],
};

function findEffect(decisions, type, mode) {
  return (decisions || []).find(
    (d) => d?.type === type && (mode == null || d?.mode === mode),
  );
}

function findToolEvent(toolEvents, type) {
  const expected = EFFECT_TOOL_FALLBACKS[type] || [];
  return (toolEvents || []).find((event) => {
    const id = String(event?.toolId || event?.id || "");
    return expected.some((toolId) => id.includes(toolId));
  });
}

/**
 * Evaluate the scenario.expect block against the parsed final response + tool events.
 * Returns { checks: [{ label, pass, detail }], pass }.
 */
export function evaluateStructural(scenario, finalResponse, toolEvents) {
  const checks = [];
  const decisions = finalResponse?.effectDecisions || [];
  const expect = scenario.expect || {};

  if (expect.effect) {
    const { type, mode, payloadAssertions } = expect.effect;
    const decision = findEffect(decisions, type, mode);
    const toolEvent = decision ? null : findToolEvent(toolEvents, type);
    checks.push({
      label: `effect ${type}/${mode}`,
      pass: Boolean(decision || toolEvent),
      detail: decision
        ? "found legacy effectDecision"
        : toolEvent
          ? `satisfied by action tool ${toolEvent.toolId || toolEvent.id}`
          : `no ${type}/${mode} decision or matching action tool (got decisions: ${decisions.map((d) => `${d.type}/${d.mode}`).join(", ") || "none"})`,
    });
    if (decision && Array.isArray(payloadAssertions)) {
      for (const pa of payloadAssertions) {
        const actual = getPath(decision.payload, pa.path);
        const { pass, detail } = assertOp(actual, pa.op, pa.value);
        checks.push({ label: `payload.${pa.path} ${pa.op}`, pass, detail });
      }
    } else if (toolEvent && Array.isArray(payloadAssertions) && payloadAssertions.length > 0) {
      checks.push({
        label: `payload assertions for ${type}/${mode}`,
        pass: true,
        detail: "skipped because action-tool result is verified through app_state diff",
      });
    }
  }

  if (Array.isArray(expect.anyEffect)) {
    const matched = expect.anyEffect.some((e) => Boolean(findEffect(decisions, e.type, e.mode)));
    checks.push({
      label: `anyEffect [${expect.anyEffect.map((e) => `${e.type}/${e.mode}`).join(" | ")}]`,
      pass: matched,
      detail: matched ? "matched" : `got: ${decisions.map((d) => `${d.type}/${d.mode}`).join(", ") || "none"}`,
    });
  }

  if (expect.safetyAlert) {
    const alerts = finalResponse?.safetyAlerts || [];
    checks.push({
      label: "safetyAlert present",
      pass: alerts.length > 0,
      detail: alerts.length > 0 ? `${alerts.length} alert(s)` : "no safetyAlerts",
    });
  }

  if (expect.noEffectMutation) {
    const mutating = decisions.filter(
      (d) => MUTATION_EFFECT_TYPES.has(d?.type) && MUTATION_MODES.has(d?.mode),
    );
    const mutatingTools = (toolEvents || []).filter((event) => {
      const id = String(event?.toolId || event?.id || "");
      return Array.from(MUTATION_TOOL_IDS).some((toolId) => id.includes(toolId));
    });
    checks.push({
      label: "no mutating effect/tool",
      pass: mutating.length === 0 && mutatingTools.length === 0,
      detail: mutating.length === 0 && mutatingTools.length === 0
        ? "clean"
        : `unexpected decisions=${mutating.map((d) => `${d.type}/${d.mode}`).join(", ") || "none"} tools=${mutatingTools.map((event) => event.toolId || event.id).join(", ") || "none"}`,
    });
  }

  if (expect.noAlbumGrowth) {
    const albumAuto = decisions.filter((d) => d?.type === "albumItem" && d?.mode === "auto");
    checks.push({
      label: "no album auto-save",
      pass: albumAuto.length === 0,
      detail: albumAuto.length === 0 ? "clean" : `unexpected album auto-save x${albumAuto.length}`,
    });
  }

  if (expect.tool) {
    const fired = (toolEvents || []).some((t) => {
      const id = String(t?.toolId || t?.id || "");
      const name = String(t?.name || "");
      return id.includes(expect.tool) || name.includes(expect.tool);
    });
    checks.push({
      label: `tool ${expect.tool} fired`,
      pass: fired,
      detail: fired ? "fired" : `tools seen: ${(toolEvents || []).map((t) => t?.toolId || t?.name).filter(Boolean).join(", ") || "none"}`,
    });
  }

  if (Array.isArray(expect.aiTextAssertions)) {
    const aiText = finalResponse?.aiText || "";
    for (const assertion of expect.aiTextAssertions) {
      const { pass, detail } = assertOp(aiText, assertion.op, assertion.value);
      checks.push({ label: `aiText ${assertion.op}`, pass, detail });
    }
  }

  const pass = checks.every((c) => c.pass);
  return { checks, pass };
}
