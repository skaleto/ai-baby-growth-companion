// Apply Agent effectDecisions the same way the app shell does after receiving
// the final SSE response. The L2 runner uses this to verify product execution
// through /api/app/state instead of only checking the model response shape.

export async function applyEffectDecisions({
  baseUrl,
  token,
  scenarioId,
  beforeState = {},
  finalResponse = {},
  now = new Date().toISOString(),
  fetchImpl = fetch,
}) {
  const decisions = Array.isArray(finalResponse?.effectDecisions) ? finalResponse.effectDecisions : [];
  const safeId = safeSegment(scenarioId || "scenario");
  const applied = [];
  const pending = emptyPendingEffect(safeId, now, finalResponse);

  for (let index = 0; index < decisions.length; index += 1) {
    const decision = decisions[index];
    if (!decision || decision.mode === "ignore") continue;
    const payload = objectPayload(decision.payload);

    if (decision.mode === "pending") {
      collectPendingEffect(pending, decision.type, payload, safeId, index);
      continue;
    }

    if (decision.mode !== "auto") continue;

    if (decision.type === "careLog" && hasCareLogContent(payload)) {
      const careLog = buildCareLogSnapshot(beforeState, payload, safeId);
      await upsertStateRecord({
        baseUrl,
        token,
        collection: "careLogs",
        id: careLog.id,
        item: careLog,
        mode: "replace",
        fetchImpl,
      });
      applied.push({ collection: "careLogs", id: careLog.id, mode: "replace" });
      continue;
    }

    const direct = directCollectionFor(decision.type);
    if (direct && payload && Object.keys(payload).length > 0) {
      const item = { ...payload, id: payload.id || generatedRecordId(safeId, direct.kind, index) };
      await upsertStateRecord({
        baseUrl,
        token,
        collection: direct.collection,
        id: item.id,
        item,
        mode: "merge",
        fetchImpl,
      });
      applied.push({ collection: direct.collection, id: item.id, mode: "merge" });
    }
  }

  if (hasPendingContent(pending)) {
    await upsertStateRecord({
      baseUrl,
      token,
      collection: "pendingEffects",
      id: pending.id,
      item: pending,
      mode: "merge",
      fetchImpl,
    });
    applied.push({ collection: "pendingEffects", id: pending.id, mode: "merge" });
  }

  return { applied };
}

export async function upsertStateRecord({
  baseUrl,
  token,
  collection,
  id,
  item,
  mode = "merge",
  fetchImpl = fetch,
}) {
  const root = String(baseUrl || "").replace(/\/+$/, "");
  const url = `${root}/api/app/state/${encodeURIComponent(collection)}/${encodeURIComponent(id)}?mode=${encodeURIComponent(mode)}`;
  const res = await fetchImpl(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT app/state/${collection}/${id} failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

function emptyPendingEffect(safeId, now, finalResponse) {
  return {
    id: `l2-${safeId}-pending-${timestampSegment(now)}`,
    messageId: `l2-${safeId}-message`,
    createdAt: now,
    status: "pending",
    tags: Array.isArray(finalResponse?.tags) ? finalResponse.tags : [],
    growthEvent: undefined,
    careLogPatch: undefined,
    reminders: [],
    memories: [],
    expenses: [],
    growthMeasurements: [],
    safetyAlerts: Array.isArray(finalResponse?.safetyAlerts) ? finalResponse.safetyAlerts : [],
  };
}

function collectPendingEffect(pending, type, payload, safeId, index) {
  if (!payload || Object.keys(payload).length === 0) return;
  if (type === "growthEvent") {
    pending.growthEvent = { ...payload, id: payload.id || generatedRecordId(safeId, "growth", index) };
  } else if (type === "careLog" && hasCareLogContent(payload)) {
    pending.careLogPatch = payload;
  } else if (type === "reminder") {
    pending.reminders.push({ ...payload, id: payload.id || generatedRecordId(safeId, "reminder", index) });
  } else if (type === "memory") {
    pending.memories.push({ ...payload, id: payload.id || generatedRecordId(safeId, "memory", index) });
  } else if (type === "expenseItem") {
    pending.expenses.push({ ...payload, id: payload.id || generatedRecordId(safeId, "expense", index) });
  } else if (type === "growthMeasurement") {
    pending.growthMeasurements.push({ ...payload, id: payload.id || generatedRecordId(safeId, "growth-measurement", index) });
  }
}

function hasPendingContent(pending) {
  return Boolean(
    pending.growthEvent ||
      pending.careLogPatch ||
      pending.reminders.length ||
      pending.memories.length ||
      pending.expenses.length ||
      pending.growthMeasurements.length,
  );
}

function directCollectionFor(type) {
  if (type === "reminder") return { collection: "reminders", kind: "reminder" };
  if (type === "albumItem") return { collection: "albumItems", kind: "album" };
  if (type === "expenseItem") return { collection: "expenses", kind: "expense" };
  if (type === "growthEvent") return { collection: "growthEvents", kind: "growth" };
  if (type === "growthMeasurement") return { collection: "growthMeasurements", kind: "growth-measurement" };
  if (type === "memory") return { collection: "memories", kind: "memory" };
  return null;
}

function buildCareLogSnapshot(beforeState, payload, safeId) {
  const date = payload.date || firstEventDate(payload.events) || todayFromNow();
  const existing = Array.isArray(beforeState?.careLogs)
    ? beforeState.careLogs.find((item) => item?.date === date)
    : null;
  const id = existing?.id || payload.id || `l2-${safeId}-care-${date}`;
  const existingEvents = Array.isArray(existing?.events) ? existing.events : [];
  const payloadEvents = Array.isArray(payload.events) ? payload.events : [];
  const events = dedupeEvents([
    ...existingEvents,
    ...payloadEvents.map((event, index) => ({
      ...event,
      id: event.id || generatedRecordId(safeId, "care-event", index),
      date: event.date || date,
      title: event.title || eventTitle(event.type),
    })),
  ]);

  const snapshot = {
    ...(existing || {}),
    ...payload,
    id,
    date,
    events,
    solids: uniqueStrings([...(existing?.solids || []), ...(payload.solids || [])]),
    notes: uniqueStrings([...(existing?.notes || []), ...(payload.notes || [])]),
  };

  const milkEvents = events.filter((event) => event?.type === "milk");
  const sleepEvents = events.filter((event) => event?.type === "sleep");
  const milkSum = milkEvents.reduce((sum, event) => sum + finiteNumber(event.amountMl), 0);
  const sleepSum = sleepEvents.reduce((sum, event) => sum + finiteNumber(event.durationHours), 0);
  if (milkSum > 0) snapshot.milkMl = milkSum;
  if (milkEvents.length > 0) snapshot.milkTimes = milkEvents.length;
  if (sleepSum > 0) snapshot.sleepHours = Math.round(sleepSum * 100) / 100;
  return snapshot;
}

function hasCareLogContent(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value.events) && value.events.length > 0) return true;
  return ["milkMl", "milkTimes", "sleepHours", "wakes", "poop", "temperature"].some((key) => value[key] != null) ||
    (Array.isArray(value.notes) && value.notes.length > 0) ||
    (Array.isArray(value.solids) && value.solids.length > 0);
}

function objectPayload(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstEventDate(events) {
  return Array.isArray(events) ? events.find((event) => event?.date)?.date : null;
}

function dedupeEvents(events) {
  const byKey = new Map();
  for (const event of events) {
    const key = event?.id || `${event?.date || ""}:${event?.time || ""}:${event?.type || ""}:${event?.amountMl || ""}:${event?.durationHours || ""}`;
    if (!byKey.has(key)) byKey.set(key, event);
  }
  return Array.from(byKey.values());
}

function eventTitle(type) {
  if (type === "milk") return "喝奶";
  if (type === "sleep") return "睡觉";
  if (type === "wake") return "醒来";
  if (type === "poop") return "便便";
  if (type === "solid") return "辅食";
  if (type === "temperature") return "体温";
  if (type === "soothing") return "哄睡";
  return "记录";
}

function finiteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())));
}

function generatedRecordId(safeId, kind, index) {
  return `l2-${safeId}-${kind}-${index}`;
}

function safeSegment(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "scenario";
}

function timestampSegment(value) {
  return String(value).replace(/\D/g, "").slice(0, 14) || "now";
}

function todayFromNow() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
