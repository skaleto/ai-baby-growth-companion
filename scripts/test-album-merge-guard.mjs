#!/usr/bin/env node

// Regression guard for the production data-loss bug:
// An optimistic album item (chat auto_save) whose persistRecord PUT failed must
// NOT be silently dropped when applyAppSnapshot overwrites album state with a
// backend snapshot that does not yet contain it.
//
// mergeAlbumItemsFromSnapshot is the pure merge that applyAppSnapshot delegates to.
// It keeps locally-present, not-yet-persisted (pending) optimistic items alive
// across a snapshot that omits them, without duplicating items the backend owns.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-album-merge-guard-"));
const bundlePath = path.join(tempDir, "appStateDomain.mjs");

const mediaItem = (overrides = {}) => ({
  id: "album-media-msg1-attA",
  kind: "media",
  title: "宝宝成长照片",
  date: "2026-06-04",
  occurredAt: "2026-06-04T10:30:00+08:00",
  category: "growth",
  tags: ["成长", "照片"],
  attachmentId: "attA",
  attachment: {
    id: "attA",
    name: "baby.jpg",
    kind: "image",
    url: "http://local.test/baby.jpg",
    publicUrl: "http://local.test/baby.jpg",
    mimeType: "image/jpeg",
    width: 1200,
    height: 900,
    createdAt: "2026-06-04T10:30:00+08:00",
  },
  linkedType: "chatMessage",
  linkedId: "msg1",
  source: "rule",
  ...overrides,
});

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/appStateDomain.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    logLevel: "silent",
  });

  const domain = await import(pathToFileURL(bundlePath).href);
  assert.equal(
    typeof domain.mergeAlbumItemsFromSnapshot,
    "function",
    "mergeAlbumItemsFromSnapshot should be exported from appStateDomain",
  );

  // --- Core bug reproduction -------------------------------------------------
  // Two photos uploaded. One persisted (in backend snapshot), one's PUT FAILED
  // (only in local optimistic state + pending-persist set). Backend snapshot
  // does NOT contain the failed one.
  const persisted = mediaItem({ id: "album-media-msg1-attA", attachmentId: "attA" });
  const failedOptimistic = mediaItem({
    id: "album-media-msg1-attB",
    attachmentId: "attB",
    title: "另一张宝宝照片",
    attachment: { ...mediaItem().attachment, id: "attB", name: "baby2.jpg" },
  });

  const local = [failedOptimistic, persisted];
  const backendSnapshot = [persisted]; // failedOptimistic never landed
  const pendingPersistIds = new Set(["album-media-msg1-attB"]);

  const merged = domain.mergeAlbumItemsFromSnapshot(local, backendSnapshot, pendingPersistIds);
  const mergedIds = merged.map((item) => item.id);

  assert.ok(
    mergedIds.includes("album-media-msg1-attB"),
    "failed-to-persist optimistic album item must survive the snapshot overwrite, not be silently dropped",
  );
  assert.ok(mergedIds.includes("album-media-msg1-attA"), "persisted item must remain");
  assert.equal(merged.length, 2, "exactly the two distinct photos, no loss and no phantom");

  // --- No duplication once the backend catches up ---------------------------
  // A later snapshot now DOES include the previously-failed item (retry/agent run
  // persisted it). The id is still in the pending set for one tick; merge must not
  // produce a duplicate of the same media attachment.
  const backendCaughtUp = [persisted, failedOptimistic];
  const mergedAfter = domain.mergeAlbumItemsFromSnapshot(local, backendCaughtUp, pendingPersistIds);
  const attBCount = mergedAfter.filter((item) => item.attachmentId === "attB").length;
  assert.equal(attBCount, 1, "must not duplicate an item once the backend snapshot contains it");
  assert.equal(mergedAfter.length, 2, "still exactly two distinct photos after backend catches up");

  // --- Items NOT pending are owned by the snapshot (deletes must propagate) ---
  // A locally-present item that is NOT in the pending set and is absent from the
  // snapshot represents a real backend delete and must be dropped (no resurrection).
  const mergedNoPending = domain.mergeAlbumItemsFromSnapshot(local, backendSnapshot, new Set());
  assert.equal(
    mergedNoPending.some((item) => item.id === "album-media-msg1-attB"),
    false,
    "a non-pending local-only item must be dropped (backend snapshot is authoritative for deletes)",
  );
  assert.equal(mergedNoPending.length, 1, "only the snapshot item remains when nothing is pending");

  // --- Empty/undefined snapshot album list is treated as authoritative empty --
  const mergedEmpty = domain.mergeAlbumItemsFromSnapshot(local, [], pendingPersistIds);
  assert.equal(
    mergedEmpty.some((item) => item.id === "album-media-msg1-attB"),
    true,
    "pending optimistic item survives even an empty snapshot",
  );
  assert.equal(
    mergedEmpty.some((item) => item.id === "album-media-msg1-attA"),
    false,
    "non-pending item is dropped against an empty snapshot",
  );

  console.log("album merge guard tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
