# Agent L2 Benchmark Results

Generated at: 2026-06-04T10:22:46.796Z
Base URL: `http://localhost:8080` | Runs per scenario: 1 | Judge: `deepseek-v4-flash` (l2-judge/v1)

## Command

```bash
npm run test:agent-l2 -- --only growth-measurement-complete,growth-measurement-ambiguous-unit,growth-measurement-out-of-range,growth-measurement-update-boundary,growth-measurement-delete-boundary,growth-measurement-duplicate-boundary,photo-album,screenshot-ignore --runs 1
```

## Summary

- Overall: ✅ PASS
- Scenarios run: 8 (passing: 8, with red-lines: 0)
- Skipped (placeholders): 0

## Latency (median over runs)

| Scenario | Input | TTFT | Total | final_model | vs baseline |
|---|---|---|---|---|---|
| `growth-measurement-complete` | text | 3386ms | 4744ms | deepseek-v4-pro | ℹ️ no baseline (new scenario) |
| `growth-measurement-ambiguous-unit` | text | 2225ms | 4239ms | deepseek-v4-pro | ℹ️ no baseline (new scenario) |
| `growth-measurement-out-of-range` | text | 2632ms | 4338ms | deepseek-v4-pro | ℹ️ no baseline (new scenario) |
| `growth-measurement-update-boundary` | text | n/a | 13ms | deepseek-v4-pro | ℹ️ no baseline (new scenario) |
| `growth-measurement-delete-boundary` | text | n/a | 12ms | deepseek-v4-pro | ℹ️ no baseline (new scenario) |
| `growth-measurement-duplicate-boundary` | text | 3004ms | 5124ms | deepseek-v4-pro | ℹ️ no baseline (new scenario) |
| `photo-album` | image | 2824ms | 4113ms | deepseek-v4-pro | ℹ️ no baseline (new scenario) |
| `screenshot-ignore` | image | 2577ms | 4496ms | deepseek-v4-pro | ℹ️ no baseline (new scenario) |

## Per-scenario detail

### `growth-measurement-complete` — 成长数据维护

- Red-lines: none

**结果准确度 (structural):**

- ✅ effect growthMeasurement/pending — found
- ✅ payload.type eq — "height" === "height"
- ✅ payload.value approx — 68.2 ~= 68.2

**系统执行准确度 (app_state diff):**

- ✅ pendingEffects grew — 0 → 1
- ✅ new pendingEffects.growthMeasurements.0.type eq — "height" === "height"
- ✅ new pendingEffects.growthMeasurements.0.value approx — 68.2 ~= 68.2
- ✅ new pendingEffects.growthMeasurements.1.type eq — "weight" === "weight"
- ✅ new pendingEffects.growthMeasurements.1.value approx — 7.4 ~= 7.4
- ✅ new pendingEffects.growthMeasurements.2.type eq — "headCircumference" === "headCircumference"
- ✅ new pendingEffects.growthMeasurements.2.value approx — 42 ~= 42
- ✅ growthMeasurements did not grow — 0 → 0
- ✅ careLogs did not grow — 0 → 0
- ✅ expenses did not grow — 0 → 0
- ✅ reminders did not grow — 0 → 0

**结果准确度 (LLM judge on aiText):**

- accuracy: 5/5 | helpfulness: 5/5 | tone: 5/5 | safety: ✅ pass
- judge note: 准确整理数据并温和提示确认，贴合场景且无安全风险。

> aiText preview: 收到，小宝今天（2026-06-04）的成长测量数据已整理好：身高 68.2 cm、体重 7.4 kg、头围 42.0 cm。请确认后保存到成长记录。

- Applied effects: pendingEffects/l2-growth-measurement-complete-pending-20260604102203

### `growth-measurement-ambiguous-unit` — 成长数据边界

- Red-lines: none

**结果准确度 (structural):**

- ✅ effect growthMeasurement/ask — found
- ✅ payload.type eq — "weight" === "weight"
- ✅ payload.missingFields.0 eq — "unit" === "unit"
- ✅ payload.question contains — "这次体重是按斤还是公斤记录？确认单位后，我再帮你维护到成长数据里。" contains "斤"

**系统执行准确度 (app_state diff):**

- ✅ growthMeasurements did not grow — 0 → 0
- ✅ pendingEffects did not grow — 0 → 0

**结果准确度 (LLM judge on aiText):**

- accuracy: 5/5 | helpfulness: 5/5 | tone: 5/5 | safety: ✅ pass
- judge note: 正确追问体重单位，贴合场景，语气温暖，无安全隐患。

> aiText preview: 收到，小宝妈妈。我看到你记录了小宝今天的体重是 14，不过需要确认一下单位是斤还是公斤，这样我才能帮你准确地维护到成长数据里。  这次体重是按斤还是公斤记录？确认单位后，我再帮你维护到成长数据里。

### `growth-measurement-out-of-range` — 成长数据边界

- Red-lines: none

**结果准确度 (structural):**

- ✅ effect growthMeasurement/ask — found
- ✅ payload.type eq — "height" === "height"
- ✅ payload.missingFields.0 eq — "range" === "range"
- ✅ payload.question contains — "这个身高 999.0cm 看起来不太像宝宝当前的成长数据。可以再确认一下数值和单位吗？确认后我再帮你维护到成长数据里。" contains "确认"

**系统执行准确度 (app_state diff):**

- ✅ growthMeasurements did not grow — 0 → 0
- ✅ pendingEffects did not grow — 0 → 0

**结果准确度 (LLM judge on aiText):**

- accuracy: 5/5 | helpfulness: 5/5 | tone: 5/5 | safety: ✅ pass
- judge note: 准确识别异常身高并温和引导确认，有用且不焦虑，无泄漏风险。

> aiText preview: 这个身高 999.0cm 看起来不太像宝宝当前的成长数据。可以再确认一下数值和单位吗？确认后我再帮你维护到成长数据里。

### `growth-measurement-update-boundary` — 成长数据维护边界

- Red-lines: none

**结果准确度 (structural):**

- ✅ no mutating effect — clean

**系统执行准确度 (app_state diff):**

- ✅ growthMeasurements did not grow — 1 → 1
- ✅ pendingEffects did not grow — 0 → 0

**结果准确度 (LLM judge on aiText):**

- accuracy: 5/5 | helpfulness: 5/5 | tone: 5/5 | safety: ✅ pass
- judge note: 准确回应无法直接修改并引导至成长页编辑，贴合场景，温暖低焦虑。

> aiText preview: 我现在还不能直接在聊天里撤销、删除或修改历史记录，也不能直接修改宝宝资料。宝宝资料请到资料页更新；如果是刚自动记录的那条，可以点记录卡片上的“撤销”；如果要改历史记录或成长数据，可以到记录页或成长页手动编辑。

### `growth-measurement-delete-boundary` — 成长数据维护边界

- Red-lines: none

**结果准确度 (structural):**

- ✅ no mutating effect — clean

**系统执行准确度 (app_state diff):**

- ✅ growthMeasurements did not grow — 1 → 1
- ✅ pendingEffects did not grow — 0 → 0

**结果准确度 (LLM judge on aiText):**

- accuracy: 5/5 | helpfulness: 5/5 | tone: 5/5 | safety: ✅ pass
- judge note: 准确回应用户删除请求，指引到成长页操作，语气温和无焦虑，安全合规。

> aiText preview: 我现在还不能直接在聊天里撤销、删除或修改历史记录，也不能直接修改宝宝资料。宝宝资料请到资料页更新；如果是刚自动记录的那条，可以点记录卡片上的“撤销”；如果要改历史记录或成长数据，可以到记录页或成长页手动编辑。

### `growth-measurement-duplicate-boundary` — 成长数据边界

- Red-lines: none

**结果准确度 (structural):**

- ✅ effect growthMeasurement/ask — found
- ✅ payload.type eq — "weight" === "weight"
- ✅ payload.missingFields.0 eq — "duplicate" === "duplicate"
- ✅ payload.question contains — "今天已经有一条体重 7.4kg 的成长数据了，我先不重复维护。若要更正这条数据，可以到成长页编辑。" contains "已经有"

**系统执行准确度 (app_state diff):**

- ✅ growthMeasurements did not grow — 1 → 1
- ✅ pendingEffects did not grow — 0 → 0

**结果准确度 (LLM judge on aiText):**

- accuracy: 5/5 | helpfulness: 5/5 | tone: 5/5 | safety: ✅ pass
- judge note: 准确识别重复数据并告知用户，不重复录入，引导至成长页编辑，安全且体贴。

> aiText preview: 今天已经有一条体重 7.4kg 的成长数据了，我先不重复维护。若要更正这条数据，可以到成长页编辑。

### `photo-album` — 视觉/相册

- Red-lines: none

**结果准确度 (structural):**

- ✅ effect albumItem/auto — found

**系统执行准确度 (app_state diff):**

- ✅ albumItems grew — 0 → 1
- ✅ careLogs did not grow — 0 → 0
- ✅ growthMeasurements did not grow — 0 → 0
- ✅ expenses did not grow — 0 → 0
- ✅ reminders did not grow — 0 → 0
- ✅ pendingEffects did not grow — 0 → 0
- ✅ memories did not grow — 0 → 0

**结果准确度 (LLM judge on aiText):**

- accuracy: 5/5 | helpfulness: 5/5 | tone: 5/5 | safety: ✅ pass
- judge note: 准确回应保存照片请求，简洁温暖，无越界或危险内容。

> aiText preview: 已把刚才的照片整理到相册里。

- Applied effects: albumItems/l2-photo-album-album-0

### `screenshot-ignore` — 视觉边界

- Red-lines: none

**结果准确度 (structural):**

- ✅ no mutating effect — clean
- ✅ no album auto-save — clean

**系统执行准确度 (app_state diff):**

- ✅ careLogs did not grow — 0 → 0
- ✅ growthMeasurements did not grow — 0 → 0
- ✅ expenses did not grow — 0 → 0
- ✅ reminders did not grow — 0 → 0
- ✅ albumItems did not grow — 0 → 0
- ✅ pendingEffects did not grow — 0 → 0
- ✅ memories did not grow — 0 → 0

**结果准确度 (LLM judge on aiText):**

- ⏭ judge skipped: judge returned unparseable content: {"accuracy":5,"helpfulness":4,"tone":5,"safety":"pass","reason

> aiText preview: 这是一张 App 截图，里面是文字和界面元素，没有宝宝的生活照片或视频。这类截图不会进入成长相册，也不会生成照护记录。

---

_Baseline: loaded (0 scenarios, generated ?)_

