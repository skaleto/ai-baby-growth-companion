#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-album-domain-"));
const bundlePath = path.join(tempDir, "albumDomain.mjs");

const message = (overrides = {}) => ({
  id: "msg-album-test",
  role: "parent",
  text: "今天宝宝好可爱",
  createdAt: "2026-06-04T10:30:00+08:00",
  attachments: [],
  ...overrides,
});

const imageAttachment = (overrides = {}) => ({
  id: "att-baby-photo",
  name: "baby-smile.jpg",
  kind: "image",
  url: "http://local.test/baby-smile.jpg",
  publicUrl: "http://local.test/baby-smile.jpg",
  mimeType: "image/jpeg",
  width: 1200,
  height: 900,
  createdAt: "2026-06-04T10:30:00+08:00",
  ...overrides,
});

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/albumDomain.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    logLevel: "silent",
  });

  const album = await import(pathToFileURL(bundlePath).href);

  assert.equal(typeof album.decideAlbumMedia, "function", "decideAlbumMedia should be exported");
  assert.equal(typeof album.albumItemFromDecision, "function", "albumItemFromDecision should be exported");
  assert.equal(typeof album.dedupeAlbumItems, "function", "dedupeAlbumItems should be exported");
  assert.equal(typeof album.isVisibleAlbumMedia, "function", "isVisibleAlbumMedia should be exported");

  const babyPhoto = imageAttachment();
  const photoDecision = album.decideAlbumMedia(message({ attachments: [babyPhoto] }), babyPhoto);
  assert.equal(photoDecision.mode, "auto_save");
  assert.equal(photoDecision.attachmentId, "att-baby-photo");
  assert.equal(photoDecision.sourceMessageId, "msg-album-test");
  assert.equal(photoDecision.tags.includes("照片"), true);
  assert.equal(photoDecision.reason.includes("相册"), true);

  const photoItem = album.albumItemFromDecision(photoDecision, message({ attachments: [babyPhoto] }), babyPhoto);
  assert.equal(photoItem.kind, "media");
  assert.equal(photoItem.attachmentId, "att-baby-photo");
  assert.equal(photoItem.linkedType, "chatMessage");
  assert.equal(photoItem.source, "rule");
  assert.equal(photoItem.attachment.name.endsWith(".jpg"), true);
  assert.equal(album.isVisibleAlbumMedia(photoItem), true);

  const capturedPhoto = imageAttachment({
    id: "att-captured-photo",
    capturedAt: "2026-05-29T08:10:12",
    createdAt: "2026-06-04T10:30:00+08:00",
  });
  const capturedDecision = album.decideAlbumMedia(message({ attachments: [capturedPhoto] }), capturedPhoto);
  const capturedItem = album.albumItemFromDecision(capturedDecision, message({ attachments: [capturedPhoto] }), capturedPhoto);
  assert.equal(capturedItem.date, "2026-05-29", "chat album media should use photo capture date before message time");
  assert.equal(capturedItem.occurredAt, "2026-05-29T08:10:12");

  const standaloneItem = album.albumItemFromStandaloneAttachment(capturedPhoto);
  assert.equal(standaloneItem.date, "2026-05-29", "manual album upload should use photo capture date before upload time");
  assert.equal(album.albumDayLabel("2026-05-29"), "2026年5月29日");

  const screenshot = imageAttachment({
    id: "att-screenshot",
    name: "screenshot-localhost.png",
    mimeType: "image/png",
    width: 1170,
    height: 2532,
  });
  const screenshotDecision = album.decideAlbumMedia(message({ text: "看一下这张截图", attachments: [screenshot] }), screenshot);
  assert.equal(screenshotDecision.mode, "ignore");
  assert.equal(screenshotDecision.tags.includes("截图"), true);
  assert.equal(screenshotDecision.reason.includes("不会保存"), true);

  const nonMedia = imageAttachment({ id: "att-pdf", name: "checklist.pdf", kind: "file", mimeType: "application/pdf" });
  const nonMediaDecision = album.decideAlbumMedia(message({ text: "这个育儿清单帮我看下", attachments: [nonMedia] }), nonMedia);
  assert.equal(nonMediaDecision.mode, "ignore");

  const duplicate = album.albumItemFromDecision(photoDecision, message({ id: "msg-other", attachments: [babyPhoto] }), babyPhoto);
  assert.equal(album.dedupeAlbumItems([photoItem, duplicate]).length, 1);

  const hiddenScreenshotItem = {
    ...photoItem,
    id: "album-screenshot",
    attachmentId: "att-screenshot",
    title: "截图",
    attachment: screenshot,
  };
  assert.equal(album.isVisibleAlbumMedia(hiddenScreenshotItem), false);

  console.log("album domain tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
