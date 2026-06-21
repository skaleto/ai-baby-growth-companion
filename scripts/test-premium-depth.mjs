#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../frontend/src/styles/premium-depth.css", import.meta.url), "utf8");
const styles = readFileSync(new URL("../frontend/src/styles.css", import.meta.url), "utf8");

// 1) 必需 token 都定义了
for (const t of ["--r-chip","--r-card","--r-hero","--elev-list","--elev-card","--elev-hero","--elev-btn","--edge-light","--surface-card","--surface-hero","--glow","--btn-primary-bg","--btn-primary-edge"]) {
  assert.ok(css.includes(t + ":"), `premium-depth.css 应定义 ${t}`);
}

// 2) 5 张门面卡各自设了品类 --glow(Task 4 满足;此处先放宽到"至少 feeding 定义",Task 4 收紧)
assert.ok(/\.feeding-alarm-card[^{]*\{[^}]*--glow\s*:/.test(css), ".feeding-alarm-card 应设置自己的 --glow");

// 3) premium-depth.css 必须是最后一个 @import(覆盖一切)
const imports = [...styles.matchAll(/@import\s+["']([^"']+)["']/g)].map((m) => m[1]);
assert.equal(imports[imports.length - 1], "./styles/premium-depth.css", "premium-depth.css 必须是 styles.css 最后一个 @import");

console.log("premium-depth tokens tests passed");
