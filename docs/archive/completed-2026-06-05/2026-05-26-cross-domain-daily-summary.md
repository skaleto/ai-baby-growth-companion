# Cross-Domain Daily Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade existing `DailySummaryService` from deterministic string concatenation to AI-driven cross-domain "今日发现" findings, with full backward compatibility and model-failure fallback.

**Architecture:** Backend keeps existing deterministic `buildSummary()` as fallback. New code path collects today's data + 7-day aggregate + similar-expense history, calls DeepSeek V4 Pro standalone (not via AgentRuntime), parses 6 typed findings from JSON, validates against hallucination + banned medical terms, appends to existing `DailySummaryDto`. Frontend renders a new `DailySummaryView` component mounted in the existing 「记录」 Tab today page, with deterministic-only render path when findings are empty.

**Tech Stack:** Java 17 + Spring Boot 3 (backend), React 18 + TypeScript (frontend), DeepSeek V4 Pro API, SQLite + MyBatis-Plus, Capacitor for mobile OTA.

**Reference Spec:** `docs/superpowers/specs/2026-05-26-cross-domain-daily-summary-design.md`

---

## File Structure

### Backend (Java)

| Path | Status | Responsibility |
|---|---|---|
| `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingDto.java` | NEW | Record: a single AI finding |
| `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingRelated.java` | NEW | Record: id collections per domain |
| `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingAction.java` | NEW | Record: optional click action |
| `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/DailySummaryDto.java` | MODIFY | Add `List<FindingDto> findings` field |
| `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryPrompts.java` | NEW | System prompt + 6 finding type descriptions + JSON schema instructions |
| `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryAiClient.java` | NEW | `@FunctionalInterface` wrapping DeepSeek call (testable mock injection) |
| `backend/src/main/java/com/xiaobao/babycompanion/service/DefaultDailySummaryAiClient.java` | NEW | Production impl using DeepSeek REST + JSON output mode |
| `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryFindingValidator.java` | NEW | Pure-function validator: banned words, id existence, schema shape |
| `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryService.java` | MODIFY | Split `buildSummary()`, add AI-augmented path with fallback |
| `backend/src/main/java/com/xiaobao/babycompanion/service/ProTrialService.java` | MODIFY | `isPro(familyId)` returns `true` |
| `backend/src/main/java/com/xiaobao/babycompanion/persistence/service/CareLogRecordService.java` | MODIFY | Add `getRecentDaysAggregate(familyId, days)` |
| `backend/src/main/java/com/xiaobao/babycompanion/persistence/service/ExpenseItemRecordService.java` | MODIFY | Add `getRecentSimilarExpenses(familyId, productName, months)` |

### Backend Tests (Java)

| Path | Status | Responsibility |
|---|---|---|
| `backend/src/test/java/com/xiaobao/babycompanion/service/DailySummaryFindingValidatorTests.java` | NEW | Validator pure-function unit tests |
| `backend/src/test/java/com/xiaobao/babycompanion/service/DailySummaryServiceAiTests.java` | NEW | Integration tests with mocked `DailySummaryAiClient` |
| `backend/src/test/java/com/xiaobao/babycompanion/service/CareLogAggregateTests.java` | NEW | Sliding average SQL behavior |
| `backend/src/test/java/com/xiaobao/babycompanion/service/ExpenseSimilarityTests.java` | NEW | Fuzzy match SQL behavior |
| `backend/src/test/java/com/xiaobao/babycompanion/agent/AgentBenchmarkTests.java` | MODIFY | Add 2 cases: AI summary happy path + fallback on model failure |

### Frontend (TypeScript / React)

| Path | Status | Responsibility |
|---|---|---|
| `frontend/src/types.ts` | MODIFY | Add `Finding`, `FindingRelated`, `FindingAction` types + extend `DailySummary` |
| `frontend/src/utils/dailySummary.ts` | NEW | `parseActionTarget()`, `resolveFindingThumbnail()`, finding-type style map |
| `frontend/src/views/DailySummaryView.tsx` | NEW | 4-module render + 6 finding type renderers + action click dispatch |
| `frontend/src/App.tsx` | MODIFY | Mount `<DailySummaryView />` in 记录 Tab today page; hide Pro 申请 entry |
| `frontend/src/appStateApi.ts` | MODIFY | Normalize incoming `findings` array (default to `[]`) |
| `frontend/src/styles/daily-summary.css` | NEW | Styles for `DailySummaryView` |

### Frontend Tests

| Path | Status | Responsibility |
|---|---|---|
| `scripts/frontend-smoke.mjs` | MODIFY | Inject sample `findings` into mock app state for visual regression |

---

## Task 1: Backend Finding DTO Records

**Files:**
- Create: `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingDto.java`
- Create: `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingRelated.java`
- Create: `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingAction.java`

- [ ] **Step 1: Create FindingAction record**

Write `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingAction.java`:

```java
package com.xiaobao.babycompanion.dto.pro;

public record FindingAction(
        String label,
        String target
) {
}
```

- [ ] **Step 2: Create FindingRelated record**

Write `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingRelated.java`:

```java
package com.xiaobao.babycompanion.dto.pro;

import java.util.List;

public record FindingRelated(
        List<String> careLogEventIds,
        List<String> growthEventIds,
        List<String> albumItemIds,
        List<String> expenseIds,
        List<String> reminderIds,
        List<String> memberIds,
        List<String> memoryIds,
        List<String> comparedTo
) {
    public static FindingRelated empty() {
        return new FindingRelated(
                List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of()
        );
    }
}
```

- [ ] **Step 3: Create FindingDto record**

Write `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingDto.java`:

```java
package com.xiaobao.babycompanion.dto.pro;

public record FindingDto(
        String type,
        String text,
        FindingRelated related,
        FindingAction action
) {
}
```

- [ ] **Step 4: Verify compile**

Run: `cd backend && mvn -q -DskipTests compile`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingDto.java backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingRelated.java backend/src/main/java/com/xiaobao/babycompanion/dto/pro/FindingAction.java
git commit -m "feat: add Finding DTO records for daily summary AI findings"
```

---

## Task 2: Extend DailySummaryDto

**Files:**
- Modify: `backend/src/main/java/com/xiaobao/babycompanion/dto/pro/DailySummaryDto.java`

- [ ] **Step 1: Add findings field**

Replace the existing record definition in `DailySummaryDto.java`:

```java
package com.xiaobao.babycompanion.dto.pro;

import java.util.List;

public record DailySummaryDto(
        String id,
        String date,
        String text,
        List<String> facts,
        List<String> observations,
        List<MissingItemDto> missingItems,
        List<MissingItemDto> accountMissingItems,
        List<FindingDto> findings,
        String generatedAt,
        String generatedByUserId,
        String sourceFingerprint,
        boolean stale
) {
    public DailySummaryDto {
        if (findings == null) findings = List.of();
    }
}
```

The compact constructor normalizes null `findings` to empty list — guarantees backward compat for old payloads deserialized from `daily_summary.payload_json`.

- [ ] **Step 2: Fix all DailySummaryDto constructors in existing code**

Run: `cd backend && grep -rn "new DailySummaryDto(" src/main src/test --include="*.java"`

For each call site found, add `List.of()` as the 8th argument (between `accountMissingItems` and `generatedAt`). Expected sites:
- `DailySummaryService.java` (existing `buildSummary` return)
- `DailySummaryService.java` (existing `read` return reconstruction)
- Any test file constructing this DTO

- [ ] **Step 3: Verify compile**

Run: `cd backend && mvn -q -DskipTests compile`
Expected: BUILD SUCCESS

- [ ] **Step 4: Verify existing tests still pass**

Run: `cd backend && mvn -q -Dtest='*DailySummary*,*ProTrial*' test`
Expected: existing tests pass (findings defaults to empty list, no behavior change)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/xiaobao/babycompanion/dto/pro/DailySummaryDto.java backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryService.java
git commit -m "feat: add findings field to DailySummaryDto with backward-compat default"
```

---

## Task 3: DailySummaryPrompts

**Files:**
- Create: `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryPrompts.java`

- [ ] **Step 1: Create prompts class**

Write `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryPrompts.java`:

```java
package com.xiaobao.babycompanion.service;

public final class DailySummaryPrompts {

    private DailySummaryPrompts() {}

    public static final String SYSTEM_PROMPT = """
            你是"小宝记"App 的家庭育儿信息助手。你的任务是从家庭今天产生的所有结构化数据中，挖掘出主用户可能没注意到的跨域关联、变化和细节。
            
            严格规则：
            1. 只输出 6 类发现（finding type），不允许自由发挥：
               - family_action_continuity：一个家庭成员做了什么、另一个成员接力做了什么
               - cross_domain_link：账本与照护记录的关联（例如"今天买的奶粉今天就用了"）
               - expense_price_compare：账本同类商品的最近价格对比
               - trend_anomaly：7 天滑动均值的异常（奶量、睡眠、夜醒）
               - media_milestone_candidate：相册照片可能对应里程碑（仅基于已有 tag 推测）
               - memory_recall：长期记忆里的偏好/过敏被今天的事触发
            2. 每条 finding 的 text 必须用中文，简洁、事实导向、不超过 50 字
            3. 不允许做医疗诊断或下决定式建议。禁词："应该 / 建议 / 可能是病 / 异常 / 需要去医院"
            4. trend_anomaly 类只能用观察性表达："比上周低 25%"、"比平均多 2 次"，不写"应该减少 / 增加"
            5. 用真实角色名（妈妈/爸爸/爷爷/外婆等），不要用"另一位家长"等含糊词
            6. text 中引用的所有 id / 数字 / 名字必须能在输入数据中找到，禁止编造
            7. 某类没东西可说就跳过，宁缺勿滥；没有任何发现时输出 {"findings": []}
            8. 严格输出 JSON，无前后缀文本，无 markdown 围栏
            
            输出 JSON schema：
            {
              "findings": [
                {
                  "type": "family_action_continuity" | "cross_domain_link" | "expense_price_compare" | "trend_anomaly" | "media_milestone_candidate" | "memory_recall",
                  "text": "中文描述，≤ 50 字",
                  "related": {
                    "careLogEventIds": [],
                    "growthEventIds": [],
                    "albumItemIds": [],
                    "expenseIds": [],
                    "reminderIds": [],
                    "memberIds": [],
                    "memoryIds": [],
                    "comparedTo": []
                  },
                  "action": null | { "label": "中文按钮文案", "target": "<domain>:<id>" }
                }
              ]
            }
            
            action.target 的 domain 只能是：ledger（账本明细）、album（相册项）、milestone（里程碑）、reminder（提醒）。
            """;

    /**
     * Builds the user message containing all today's structured data.
     * The input is a single JSON object that the model parses to produce findings.
     */
    public static String userPrompt(String contextJson) {
        return "以下是今天该家庭的所有结构化数据，请按系统规则输出 JSON findings：\n\n" + contextJson;
    }
}
```

- [ ] **Step 2: Verify compile**

Run: `cd backend && mvn -q -DskipTests compile`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryPrompts.java
git commit -m "feat: add DailySummaryPrompts with 6 finding type definitions and JSON schema"
```

---

## Task 4: DailySummaryFindingValidator (TDD)

**Files:**
- Create: `backend/src/test/java/com/xiaobao/babycompanion/service/DailySummaryFindingValidatorTests.java`
- Create: `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryFindingValidator.java`

- [ ] **Step 1: Write failing tests**

Write `backend/src/test/java/com/xiaobao/babycompanion/service/DailySummaryFindingValidatorTests.java`:

```java
package com.xiaobao.babycompanion.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Set;

import com.xiaobao.babycompanion.dto.pro.FindingAction;
import com.xiaobao.babycompanion.dto.pro.FindingDto;
import com.xiaobao.babycompanion.dto.pro.FindingRelated;
import org.junit.jupiter.api.Test;

class DailySummaryFindingValidatorTests {

    private final DailySummaryFindingValidator validator = new DailySummaryFindingValidator();

    @Test
    void acceptsValidFinding() {
        FindingDto valid = new FindingDto(
                "family_action_continuity",
                "妈妈用白噪音哄睡了 25 分钟",
                new FindingRelated(
                        List.of("evt-1"), List.of(), List.of(), List.of(),
                        List.of(), List.of("member-mom"), List.of(), List.of()
                ),
                null
        );
        List<FindingDto> result = validator.validate(
                List.of(valid),
                knownIds(Set.of("evt-1"), Set.of(), Set.of(), Set.of(), Set.of(), Set.of("member-mom"), Set.of())
        );
        assertEquals(1, result.size());
    }

    @Test
    void rejectsUnknownType() {
        FindingDto invalid = new FindingDto(
                "totally_made_up",
                "some text",
                FindingRelated.empty(),
                null
        );
        List<FindingDto> result = validator.validate(List.of(invalid), DailySummaryFindingValidator.KnownIds.empty());
        assertTrue(result.isEmpty());
    }

    @Test
    void rejectsFindingWithBannedWord() {
        FindingDto banned = new FindingDto(
                "trend_anomaly",
                "宝宝奶量异常，建议去医院",
                FindingRelated.empty(),
                null
        );
        List<FindingDto> result = validator.validate(List.of(banned), DailySummaryFindingValidator.KnownIds.empty());
        assertTrue(result.isEmpty());
    }

    @Test
    void rejectsFindingReferencingUnknownIds() {
        FindingDto hallucinated = new FindingDto(
                "cross_domain_link",
                "今天买的奶粉今天就用了",
                new FindingRelated(
                        List.of(), List.of(), List.of(), List.of("expense-fake-99"),
                        List.of(), List.of(), List.of(), List.of()
                ),
                null
        );
        List<FindingDto> result = validator.validate(
                List.of(hallucinated),
                knownIds(Set.of(), Set.of(), Set.of(), Set.of("expense-1"), Set.of(), Set.of(), Set.of())
        );
        assertTrue(result.isEmpty());
    }

    @Test
    void rejectsActionWithInvalidTargetFormat() {
        FindingDto badAction = new FindingDto(
                "media_milestone_candidate",
                "可能是第一次站立",
                new FindingRelated(
                        List.of(), List.of(), List.of("alb-1"), List.of(),
                        List.of(), List.of(), List.of(), List.of()
                ),
                new FindingAction("标记里程碑", "not-a-valid-target")
        );
        List<FindingDto> result = validator.validate(
                List.of(badAction),
                knownIds(Set.of(), Set.of(), Set.of("alb-1"), Set.of(), Set.of(), Set.of(), Set.of())
        );
        assertEquals(1, result.size());
        assertNull(result.get(0).action(), "invalid action should be stripped, finding kept");
    }

    @Test
    void rejectsTextTooLong() {
        String longText = "今天".repeat(40);
        FindingDto tooLong = new FindingDto("trend_anomaly", longText, FindingRelated.empty(), null);
        List<FindingDto> result = validator.validate(List.of(tooLong), DailySummaryFindingValidator.KnownIds.empty());
        assertTrue(result.isEmpty());
    }

    @Test
    void normalizesNullRelatedToEmpty() {
        FindingDto withNull = new FindingDto("family_action_continuity", "妈妈给宝宝换了尿布", null, null);
        List<FindingDto> result = validator.validate(List.of(withNull), DailySummaryFindingValidator.KnownIds.empty());
        assertEquals(1, result.size());
        assertNotNull(result.get(0).related());
    }

    private DailySummaryFindingValidator.KnownIds knownIds(
            Set<String> careLog, Set<String> growth, Set<String> album,
            Set<String> expense, Set<String> reminder, Set<String> member, Set<String> memory
    ) {
        return new DailySummaryFindingValidator.KnownIds(careLog, growth, album, expense, reminder, member, memory);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && mvn -q -Dtest=DailySummaryFindingValidatorTests test`
Expected: FAIL — `DailySummaryFindingValidator` does not exist.

- [ ] **Step 3: Implement validator**

Write `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryFindingValidator.java`:

```java
package com.xiaobao.babycompanion.service;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import com.xiaobao.babycompanion.dto.pro.FindingAction;
import com.xiaobao.babycompanion.dto.pro.FindingDto;
import com.xiaobao.babycompanion.dto.pro.FindingRelated;
import org.springframework.stereotype.Component;

@Component
public class DailySummaryFindingValidator {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "family_action_continuity",
            "cross_domain_link",
            "expense_price_compare",
            "trend_anomaly",
            "media_milestone_candidate",
            "memory_recall"
    );

    private static final List<String> BANNED_PHRASES = List.of(
            "应该", "建议", "可能是病", "异常", "需要去医院", "需要就医",
            "推荐", "诊断", "处方", "治疗"
    );

    private static final Pattern ACTION_TARGET_PATTERN =
            Pattern.compile("^(ledger|album|milestone|reminder):[A-Za-z0-9_\\-]+$");

    private static final int MAX_TEXT_LENGTH = 60;

    public List<FindingDto> validate(List<FindingDto> findings, KnownIds knownIds) {
        if (findings == null) return List.of();
        return findings.stream()
                .map(finding -> sanitize(finding, knownIds))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private FindingDto sanitize(FindingDto finding, KnownIds knownIds) {
        if (finding == null) return null;
        if (finding.type() == null || !ALLOWED_TYPES.contains(finding.type())) return null;
        if (finding.text() == null || finding.text().isBlank()) return null;
        if (finding.text().length() > MAX_TEXT_LENGTH) return null;
        if (containsBannedPhrase(finding.text())) return null;

        FindingRelated related = finding.related() == null ? FindingRelated.empty() : finding.related();
        if (!idsAreKnown(related, knownIds)) return null;

        FindingAction action = sanitizeAction(finding.action());
        return new FindingDto(finding.type(), finding.text(), related, action);
    }

    private boolean containsBannedPhrase(String text) {
        for (String phrase : BANNED_PHRASES) {
            if (text.contains(phrase)) return true;
        }
        return false;
    }

    private boolean idsAreKnown(FindingRelated related, KnownIds known) {
        return known.contains(related.careLogEventIds(), known.careLogEventIds())
                && known.contains(related.growthEventIds(), known.growthEventIds())
                && known.contains(related.albumItemIds(), known.albumItemIds())
                && known.contains(related.expenseIds(), known.expenseIds())
                && known.contains(related.reminderIds(), known.reminderIds())
                && known.contains(related.memberIds(), known.memberIds())
                && known.contains(related.memoryIds(), known.memoryIds());
    }

    private FindingAction sanitizeAction(FindingAction action) {
        if (action == null) return null;
        if (action.target() == null) return null;
        if (!ACTION_TARGET_PATTERN.matcher(action.target()).matches()) return null;
        if (action.label() == null || action.label().isBlank()) return null;
        return action;
    }

    public record KnownIds(
            Set<String> careLogEventIds,
            Set<String> growthEventIds,
            Set<String> albumItemIds,
            Set<String> expenseIds,
            Set<String> reminderIds,
            Set<String> memberIds,
            Set<String> memoryIds
    ) {
        public static KnownIds empty() {
            return new KnownIds(Set.of(), Set.of(), Set.of(), Set.of(), Set.of(), Set.of(), Set.of());
        }

        public boolean contains(List<String> requested, Set<String> known) {
            if (requested == null || requested.isEmpty()) return true;
            return known.containsAll(requested);
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && mvn -q -Dtest=DailySummaryFindingValidatorTests test`
Expected: BUILD SUCCESS, 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryFindingValidator.java backend/src/test/java/com/xiaobao/babycompanion/service/DailySummaryFindingValidatorTests.java
git commit -m "feat: add DailySummaryFindingValidator with banned-word and id-existence checks"
```

---

## Task 5: CareLogRecordService.getRecentDaysAggregate (TDD)

**Files:**
- Create: `backend/src/test/java/com/xiaobao/babycompanion/service/CareLogAggregateTests.java`
- Modify: `backend/src/main/java/com/xiaobao/babycompanion/persistence/service/CareLogRecordService.java`

- [ ] **Step 1: Inspect existing CareLogRecordService**

Run: `cd backend && grep -n "class CareLogRecordService\|extends" src/main/java/com/xiaobao/babycompanion/persistence/service/CareLogRecordService.java`

Confirm it extends `ServiceImpl<CareLogRecordMapper, CareLogRecord>`. The aggregate method will be added as a public method.

- [ ] **Step 2: Define aggregate result type**

Add this record at the top of `CareLogRecordService.java` (after the package declaration, as a nested public static record OR a separate file). Use a nested record for simplicity:

```java
public record DaysAggregate(
        int days,
        double avgMilkMl,
        double avgMilkTimes,
        double avgSleepHours,
        double avgNightWakeTimes,
        int recordedDays
) {
    public static DaysAggregate empty(int days) {
        return new DaysAggregate(days, 0, 0, 0, 0, 0);
    }
}
```

- [ ] **Step 3: Write failing test**

Write `backend/src/test/java/com/xiaobao/babycompanion/service/CareLogAggregateTests.java`:

```java
package com.xiaobao.babycompanion.service;

import static org.junit.jupiter.api.Assertions.*;

import com.xiaobao.babycompanion.persistence.service.CareLogRecordService;
import com.xiaobao.babycompanion.persistence.service.CareLogRecordService.DaysAggregate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class CareLogAggregateTests {

    @Autowired
    CareLogRecordService careLogService;

    @Test
    void returnsEmptyWhenFamilyHasNoLogs() {
        DaysAggregate result = careLogService.getRecentDaysAggregate("family-empty", 7);
        assertEquals(7, result.days());
        assertEquals(0, result.recordedDays());
        assertEquals(0.0, result.avgMilkMl());
    }

    @Test
    void avgIsOverRecordedDaysNotCalendarDays() {
        // Seed 2 days of records for family-seed-aggregate, query window = 7 days
        // Expected: recordedDays = 2, avg = sum / 2 (not sum / 7)
        String familyId = "family-seed-aggregate-" + System.currentTimeMillis();
        seedCareLog(familyId, daysAgo(1), 600, 5, 12.0, 1);
        seedCareLog(familyId, daysAgo(2), 400, 4, 10.0, 2);

        DaysAggregate result = careLogService.getRecentDaysAggregate(familyId, 7);

        assertEquals(2, result.recordedDays());
        assertEquals(500.0, result.avgMilkMl(), 0.01);
        assertEquals(4.5, result.avgMilkTimes(), 0.01);
        assertEquals(11.0, result.avgSleepHours(), 0.01);
        assertEquals(1.5, result.avgNightWakeTimes(), 0.01);
    }

    @Test
    void ignoresLogsOlderThanWindow() {
        String familyId = "family-window-" + System.currentTimeMillis();
        seedCareLog(familyId, daysAgo(1), 500, 5, 12.0, 1);
        seedCareLog(familyId, daysAgo(30), 999, 99, 99.0, 99);

        DaysAggregate result = careLogService.getRecentDaysAggregate(familyId, 7);

        assertEquals(1, result.recordedDays());
        assertEquals(500.0, result.avgMilkMl(), 0.01);
    }

    private String daysAgo(int days) {
        return java.time.LocalDate.now().minusDays(days).toString();
    }

    private void seedCareLog(String familyId, String date, int milkMl, int milkTimes, double sleepHours, int nightWakes) {
        com.xiaobao.babycompanion.persistence.entity.CareLogRecord rec =
                new com.xiaobao.babycompanion.persistence.entity.CareLogRecord();
        rec.setId("seed-care-" + familyId + "-" + date);
        rec.setFamilyId(familyId);
        rec.setSortKey(date);
        rec.setPayloadJson(String.format(java.util.Locale.US,
                "{\"id\":\"%s\",\"date\":\"%s\",\"milkMl\":%d,\"milkTimes\":%d,\"sleepHours\":%.1f,\"nightWakeTimes\":%d,\"events\":[]}",
                rec.getId(), date, milkMl, milkTimes, sleepHours, nightWakes));
        careLogService.save(rec);
    }
}
```

> **Note for engineer:** Each test method uses a unique `familyId` (timestamp suffix) so no `@DirtiesContext` is needed. If the project's test DB cleans between methods, this still works because the seed records are scoped to the family id.

- [ ] **Step 4: Run test to verify failure**

Run: `cd backend && mvn -q -Dtest=CareLogAggregateTests test`
Expected: FAIL — `getRecentDaysAggregate` method does not exist.

- [ ] **Step 5: Implement getRecentDaysAggregate**

Modify `backend/src/main/java/com/xiaobao/babycompanion/persistence/service/CareLogRecordService.java`. Add (after existing methods):

```java
public DaysAggregate getRecentDaysAggregate(String familyId, int days) {
    if (days <= 0) return DaysAggregate.empty(days);

    java.time.LocalDate today = java.time.LocalDate.now();
    java.time.LocalDate windowStart = today.minusDays(days - 1);

    List<CareLogRecord> recent = list(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<CareLogRecord>()
            .eq("family_id", familyId)
            .ge("sort_key", windowStart.toString())
            .le("sort_key", today.toString()));

    if (recent.isEmpty()) return DaysAggregate.empty(days);

    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
    int recordedDays = 0;
    long sumMilkMl = 0;
    int sumMilkTimes = 0;
    double sumSleepHours = 0;
    int sumNightWakes = 0;

    for (CareLogRecord rec : recent) {
        try {
            com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(rec.getPayloadJson());
            sumMilkMl += node.path("milkMl").asInt(0);
            sumMilkTimes += node.path("milkTimes").asInt(0);
            sumSleepHours += node.path("sleepHours").asDouble(0);
            sumNightWakes += node.path("nightWakeTimes").asInt(0);
            recordedDays++;
        } catch (Exception ignore) {
            // skip malformed records
        }
    }

    if (recordedDays == 0) return DaysAggregate.empty(days);

    return new DaysAggregate(
            days,
            (double) sumMilkMl / recordedDays,
            (double) sumMilkTimes / recordedDays,
            sumSleepHours / recordedDays,
            (double) sumNightWakes / recordedDays,
            recordedDays
    );
}
```

> **Refactor note:** the inline ObjectMapper instantiation is intentional for simplicity. If a project-wide ObjectMapper bean is already injected into this service, use that instead.

- [ ] **Step 6: Run tests to verify pass**

Run: `cd backend && mvn -q -Dtest=CareLogAggregateTests test`
Expected: BUILD SUCCESS, 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/xiaobao/babycompanion/persistence/service/CareLogRecordService.java backend/src/test/java/com/xiaobao/babycompanion/service/CareLogAggregateTests.java
git commit -m "feat: add CareLogRecordService.getRecentDaysAggregate for sliding average"
```

---

## Task 6: ExpenseItemRecordService.getRecentSimilarExpenses (TDD)

**Files:**
- Create: `backend/src/test/java/com/xiaobao/babycompanion/service/ExpenseSimilarityTests.java`
- Modify: `backend/src/main/java/com/xiaobao/babycompanion/persistence/service/ExpenseItemRecordService.java`

- [ ] **Step 1: Define return type**

In `ExpenseItemRecordService.java`, add nested record:

```java
public record SimilarExpense(
        String id,
        String title,
        double amount,
        String date
) {}
```

- [ ] **Step 2: Write failing test**

Write `backend/src/test/java/com/xiaobao/babycompanion/service/ExpenseSimilarityTests.java`:

```java
package com.xiaobao.babycompanion.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

import com.xiaobao.babycompanion.persistence.service.ExpenseItemRecordService;
import com.xiaobao.babycompanion.persistence.service.ExpenseItemRecordService.SimilarExpense;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class ExpenseSimilarityTests {

    @Autowired
    ExpenseItemRecordService expenseService;

    @Test
    void returnsEmptyWhenNoMatch() {
        List<SimilarExpense> result = expenseService.getRecentSimilarExpenses(
                "family-empty", "完全不存在的商品名", 3);
        assertTrue(result.isEmpty());
    }

    @Test
    void matchesPartialProductName() {
        String familyId = "family-sim-" + System.currentTimeMillis();
        seedExpense(familyId, daysAgo(40), "飞鹤1段奶粉", 268.0);
        seedExpense(familyId, daysAgo(20), "飞鹤1段奶粉 6罐装", 280.0);
        seedExpense(familyId, daysAgo(10), "好奇尿不湿 L 码", 158.0);

        List<SimilarExpense> result = expenseService.getRecentSimilarExpenses(
                familyId, "飞鹤1段", 3);
        assertEquals(2, result.size());
        // newest first
        assertTrue(result.get(0).date().compareTo(result.get(1).date()) >= 0);
    }

    @Test
    void respectsMonthWindow() {
        String familyId = "family-window-exp-" + System.currentTimeMillis();
        seedExpense(familyId, daysAgo(100), "飞鹤1段奶粉", 240.0);
        seedExpense(familyId, daysAgo(50), "飞鹤1段奶粉", 268.0);
        seedExpense(familyId, daysAgo(10), "飞鹤1段奶粉", 280.0);

        // 3 months ≈ 90 days window: oldest one (100 days) excluded
        List<SimilarExpense> result = expenseService.getRecentSimilarExpenses(
                familyId, "飞鹤", 3);
        assertEquals(2, result.size());
    }

    private String daysAgo(int days) {
        return java.time.LocalDate.now().minusDays(days).toString();
    }

    private void seedExpense(String familyId, String date, String title, double amount) {
        com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord rec =
                new com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord();
        String id = "seed-exp-" + familyId + "-" + System.nanoTime();
        rec.setId(id);
        rec.setFamilyId(familyId);
        rec.setSortKey(date);
        rec.setPayloadJson(String.format(java.util.Locale.US,
                "{\"id\":\"%s\",\"date\":\"%s\",\"title\":\"%s\",\"amount\":%.2f,\"category\":\"formula\"}",
                id, date, title.replace("\"", "\\\""), amount));
        expenseService.save(rec);
    }
}
```

- [ ] **Step 3: Verify failure**

Run: `cd backend && mvn -q -Dtest=ExpenseSimilarityTests test`
Expected: FAIL — method does not exist.

- [ ] **Step 4: Implement getRecentSimilarExpenses**

Add to `ExpenseItemRecordService.java`:

```java
public List<SimilarExpense> getRecentSimilarExpenses(String familyId, String productName, int months) {
    if (productName == null || productName.isBlank() || months <= 0) return List.of();

    java.time.LocalDate today = java.time.LocalDate.now();
    java.time.LocalDate windowStart = today.minusDays(months * 30L);

    List<ExpenseItemRecord> all = list(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<ExpenseItemRecord>()
            .eq("family_id", familyId)
            .ge("sort_key", windowStart.toString())
            .le("sort_key", today.toString()));

    if (all.isEmpty()) return List.of();

    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
    String needle = normalize(productName);
    List<SimilarExpense> matches = new java.util.ArrayList<>();

    for (ExpenseItemRecord rec : all) {
        try {
            com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(rec.getPayloadJson());
            String title = node.path("title").asText("");
            if (title.isBlank()) continue;
            String haystack = normalize(title);
            if (!haystack.contains(needle) && !needle.contains(haystack)) continue;
            matches.add(new SimilarExpense(
                    node.path("id").asText(""),
                    title,
                    node.path("amount").asDouble(0),
                    node.path("date").asText("")
            ));
        } catch (Exception ignore) {
            // skip malformed
        }
    }

    matches.sort((a, b) -> b.date().compareTo(a.date()));
    return matches;
}

private static String normalize(String s) {
    return s.replaceAll("\\s+", "").toLowerCase();
}
```

- [ ] **Step 5: Verify pass**

Run: `cd backend && mvn -q -Dtest=ExpenseSimilarityTests test`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/xiaobao/babycompanion/persistence/service/ExpenseItemRecordService.java backend/src/test/java/com/xiaobao/babycompanion/service/ExpenseSimilarityTests.java
git commit -m "feat: add ExpenseItemRecordService.getRecentSimilarExpenses for price-compare findings"
```

---

## Task 7: DailySummaryAiClient interface + DefaultDailySummaryAiClient

**Files:**
- Create: `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryAiClient.java`
- Create: `backend/src/main/java/com/xiaobao/babycompanion/service/DefaultDailySummaryAiClient.java`

- [ ] **Step 1: Define functional interface**

Write `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryAiClient.java`:

```java
package com.xiaobao.babycompanion.service;

import java.util.List;

import com.xiaobao.babycompanion.dto.pro.FindingDto;

@FunctionalInterface
public interface DailySummaryAiClient {
    /**
     * Calls the configured model with the given JSON context and returns parsed findings.
     * Implementations MUST throw on timeout, network failure, or unparseable JSON —
     * the caller relies on exception → fallback path.
     */
    List<FindingDto> call(String contextJson) throws DailySummaryAiException;

    final class DailySummaryAiException extends Exception {
        public DailySummaryAiException(String message) { super(message); }
        public DailySummaryAiException(String message, Throwable cause) { super(message, cause); }
    }
}
```

- [ ] **Step 2: Implement default client**

Write `backend/src/main/java/com/xiaobao/babycompanion/service/DefaultDailySummaryAiClient.java`:

```java
package com.xiaobao.babycompanion.service;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.dto.pro.FindingAction;
import com.xiaobao.babycompanion.dto.pro.FindingDto;
import com.xiaobao.babycompanion.dto.pro.FindingRelated;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatResponse;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class DefaultDailySummaryAiClient implements DailySummaryAiClient {

    private static final Duration HARD_TIMEOUT = Duration.ofSeconds(30);

    private final DeepSeekProperties properties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public DefaultDailySummaryAiClient(DeepSeekProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(properties.getConnectTimeout()).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(HARD_TIMEOUT);
        this.restClient = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public List<FindingDto> call(String contextJson) throws DailySummaryAiException {
        String apiKey = properties.getResolvedApiKey();
        if (!StringUtils.hasText(apiKey)) {
            throw new DailySummaryAiException("DeepSeek API key not configured");
        }

        DeepSeekChatRequest request = new DeepSeekChatRequest(
                properties.getModel(),
                List.of(
                        new DeepSeekMessage("system", DailySummaryPrompts.SYSTEM_PROMPT),
                        new DeepSeekMessage("user", DailySummaryPrompts.userPrompt(contextJson))
                ),
                false,
                2048,
                0.3,
                null
        );

        try {
            DeepSeekChatResponse response = restClient.post()
                    .uri(properties.getChatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(request)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new DailySummaryAiException("model returned empty response");
            }

            String reply = response.choices().get(0).message().contentAsText();
            if (!StringUtils.hasText(reply)) throw new DailySummaryAiException("model returned empty content");

            return parseFindings(reply);
        } catch (DailySummaryAiException e) {
            throw e;
        } catch (Exception e) {
            throw new DailySummaryAiException("model call failed: " + e.getMessage(), e);
        }
    }

    private List<FindingDto> parseFindings(String reply) throws DailySummaryAiException {
        try {
            String cleaned = stripMarkdownFences(reply);
            JsonNode root = objectMapper.readTree(cleaned);
            JsonNode findingsNode = root.path("findings");
            if (!findingsNode.isArray()) return List.of();

            List<FindingDto> result = new java.util.ArrayList<>();
            for (JsonNode node : findingsNode) {
                FindingDto dto = parseFinding(node);
                if (dto != null) result.add(dto);
            }
            return result;
        } catch (Exception e) {
            throw new DailySummaryAiException("failed to parse model JSON: " + e.getMessage(), e);
        }
    }

    private FindingDto parseFinding(JsonNode node) {
        if (node == null || node.isNull()) return null;
        String type = node.path("type").asText("");
        String text = node.path("text").asText("");
        if (type.isBlank() || text.isBlank()) return null;

        JsonNode relNode = node.path("related");
        FindingRelated related = relNode.isObject() ? parseRelated(relNode) : FindingRelated.empty();

        FindingAction action = null;
        JsonNode actNode = node.path("action");
        if (actNode.isObject()) {
            String label = actNode.path("label").asText("");
            String target = actNode.path("target").asText("");
            if (!label.isBlank() && !target.isBlank()) {
                action = new FindingAction(label, target);
            }
        }
        return new FindingDto(type, text, related, action);
    }

    private FindingRelated parseRelated(JsonNode node) {
        return new FindingRelated(
                stringList(node.path("careLogEventIds")),
                stringList(node.path("growthEventIds")),
                stringList(node.path("albumItemIds")),
                stringList(node.path("expenseIds")),
                stringList(node.path("reminderIds")),
                stringList(node.path("memberIds")),
                stringList(node.path("memoryIds")),
                stringList(node.path("comparedTo"))
        );
    }

    private List<String> stringList(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> list = new java.util.ArrayList<>();
        node.forEach(item -> { if (item.isTextual()) list.add(item.asText()); });
        return list;
    }

    private String stripMarkdownFences(String text) {
        String trimmed = text.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline > 0) trimmed = trimmed.substring(firstNewline + 1);
            if (trimmed.endsWith("```")) trimmed = trimmed.substring(0, trimmed.length() - 3);
        }
        return trimmed.trim();
    }
}
```

- [ ] **Step 3: Verify compile**

Run: `cd backend && mvn -q -DskipTests compile`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryAiClient.java backend/src/main/java/com/xiaobao/babycompanion/service/DefaultDailySummaryAiClient.java
git commit -m "feat: add DailySummaryAiClient interface + DeepSeek-backed default impl"
```

---

## Task 8: Integrate AI into DailySummaryService (TDD)

**Files:**
- Create: `backend/src/test/java/com/xiaobao/babycompanion/service/DailySummaryServiceAiTests.java`
- Modify: `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryService.java`

- [ ] **Step 1: Write integration test for AI happy path**

Write `backend/src/test/java/com/xiaobao/babycompanion/service/DailySummaryServiceAiTests.java`:

```java
package com.xiaobao.babycompanion.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

import com.xiaobao.babycompanion.dto.pro.DailySummaryDto;
import com.xiaobao.babycompanion.dto.pro.FindingDto;
import com.xiaobao.babycompanion.dto.pro.FindingRelated;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
class DailySummaryServiceAiTests {

    @Autowired
    DailySummaryService service;

    @MockBean
    DailySummaryAiClient aiClient;

    @Test
    void appendsAiFindingsToSummary() throws Exception {
        String familyId = "family-ai-happy-" + System.currentTimeMillis();
        seedFixture(familyId);  // seed careLog + expense + album for today

        FindingDto fake = new FindingDto(
                "family_action_continuity",
                "妈妈下午用白噪音哄睡了 25 分钟",
                FindingRelated.empty(),
                null
        );
        when(aiClient.call(anyString())).thenReturn(List.of(fake));

        DailySummaryDto result = service.read(familyId, "user-1", today());

        assertNotNull(result);
        assertEquals(1, result.findings().size());
        assertEquals("family_action_continuity", result.findings().get(0).type());
        assertFalse(result.facts().isEmpty(), "deterministic facts must remain");
    }

    @Test
    void emptyFindingsWhenAiThrows() throws Exception {
        String familyId = "family-ai-fail-" + System.currentTimeMillis();
        seedFixture(familyId);

        when(aiClient.call(anyString())).thenThrow(
                new DailySummaryAiClient.DailySummaryAiException("simulated timeout"));

        DailySummaryDto result = service.read(familyId, "user-1", today());

        assertNotNull(result);
        assertTrue(result.findings().isEmpty(), "fallback should produce empty findings list");
        assertNotNull(result.text(), "deterministic text must still be produced");
    }

    @Test
    void skipsAiWhenDataTooSparse() throws Exception {
        String familyId = "family-ai-sparse-" + System.currentTimeMillis();
        // Do NOT seed any data; data count < 3 threshold

        DailySummaryDto result = service.read(familyId, "user-1", today());

        assertNotNull(result);
        assertTrue(result.findings().isEmpty(), "sparse data should skip AI call entirely");
    }

    private String today() {
        return java.time.LocalDate.now().toString();
    }

    @Autowired com.xiaobao.babycompanion.persistence.service.CareLogRecordService careLogService;
    @Autowired com.xiaobao.babycompanion.persistence.service.ExpenseItemRecordService expenseService;
    @Autowired com.xiaobao.babycompanion.persistence.service.AlbumItemRecordService albumService;

    private void seedFixture(String familyId) {
        String date = today();
        // CareLog
        com.xiaobao.babycompanion.persistence.entity.CareLogRecord care =
                new com.xiaobao.babycompanion.persistence.entity.CareLogRecord();
        care.setId("seed-care-" + familyId);
        care.setFamilyId(familyId);
        care.setSortKey(date);
        care.setPayloadJson(String.format(
                "{\"id\":\"%s\",\"date\":\"%s\",\"milkMl\":580,\"milkTimes\":5,\"sleepHours\":14.0,\"events\":[]}",
                care.getId(), date));
        careLogService.save(care);

        // Expense
        com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord exp =
                new com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord();
        exp.setId("seed-exp-" + familyId);
        exp.setFamilyId(familyId);
        exp.setSortKey(date);
        exp.setPayloadJson(String.format(
                "{\"id\":\"%s\",\"date\":\"%s\",\"title\":\"飞鹤1段奶粉\",\"amount\":268.0,\"category\":\"formula\"}",
                exp.getId(), date));
        expenseService.save(exp);

        // Album
        com.xiaobao.babycompanion.persistence.entity.AlbumItemRecord alb =
                new com.xiaobao.babycompanion.persistence.entity.AlbumItemRecord();
        alb.setId("seed-alb-" + familyId);
        alb.setFamilyId(familyId);
        alb.setSortKey(date);
        alb.setPayloadJson(String.format(
                "{\"id\":\"%s\",\"date\":\"%s\",\"category\":\"growth\",\"title\":\"宝宝抓拍\"}",
                alb.getId(), date));
        albumService.save(alb);
    }
}
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd backend && mvn -q -Dtest=DailySummaryServiceAiTests test`
Expected: FAIL — AI client not wired into service.

- [ ] **Step 3: Modify DailySummaryService**

In `DailySummaryService.java`:

Add fields and constructor params:

```java
private final DailySummaryAiClient aiClient;
private final DailySummaryFindingValidator findingValidator;
```

Update the constructor to accept these two as the last two parameters (preserves existing order for other deps).

In `buildSummary(...)`, after computing the existing deterministic `facts` / `observations` / `missingItems` and just before constructing the return DTO, add:

```java
List<FindingDto> findings = generateFindings(
        familyId, userId, date, profile, careLog, growthEvents, albumItems, expenses);
```

Then update the DTO construction to include `findings`:

```java
return new DailySummaryDto(
        "daily-summary-" + familyId + "-" + date,
        date,
        text,
        facts,
        observations,
        missingItems,
        accountMissingItems(familyId, userId, date),
        findings,
        generatedAt,
        userId,
        fingerprint,
        false
);
```

Add the new private method:

```java
private List<FindingDto> generateFindings(
        String familyId,
        String userId,
        String date,
        JsonNode profile,
        JsonNode careLog,
        List<JsonNode> growthEvents,
        List<JsonNode> albumItems,
        List<JsonNode> expenses
) {
    // Sparse-data guard: skip AI when total records < 3
    int totalRecords = (careLog == null || careLog.isNull() ? 0 : 1)
            + growthEvents.size() + albumItems.size() + expenses.size();
    if (totalRecords < 3) return List.of();

    try {
        String contextJson = buildAiContext(familyId, userId, date, profile, careLog,
                growthEvents, albumItems, expenses);
        List<FindingDto> raw = aiClient.call(contextJson);
        DailySummaryFindingValidator.KnownIds known = collectKnownIds(
                careLog, growthEvents, albumItems, expenses, familyId);
        List<FindingDto> validated = findingValidator.validate(raw, known);

        // Log usage for cost tracking. The exact AiUsageLogService method signature
        // already exists in the codebase — find it via:
        //   grep -n "public.*logUsage\|public.*record" backend/src/main/java/com/xiaobao/babycompanion/service/AiUsageLogService.java
        // and adapt this call to match. Required tags: feature="daily_summary_ai", family=familyId.
        // If the method takes a different shape, mirror how DailySummaryService already calls it
        // for the deterministic "daily_summary" label (existing call should be near the read() method).
        aiUsageLogService.logUsage(
                familyId, userId, "daily_summary_ai", "deepseek-v4-pro",
                /* inputTokens approx */ contextJson.length() / 4,
                /* outputTokens approx */ validated.size() * 50);

        return validated;
    } catch (Exception e) {
        // ANY failure -> empty findings, deterministic summary unaffected
        return List.of();
    }
}

private String buildAiContext(
        String familyId,
        String userId,
        String date,
        JsonNode profile,
        JsonNode careLog,
        List<JsonNode> growthEvents,
        List<JsonNode> albumItems,
        List<JsonNode> expenses
) throws JsonProcessingException {
    // Pull cross-week aggregate (7 days) and similar-expense history (3 months)
    var weekAgg = careLogService.getRecentDaysAggregate(familyId, 7);
    var similarExpenses = new java.util.ArrayList<java.util.Map<String, Object>>();
    for (JsonNode expense : expenses) {
        String title = expense.path("title").asText("");
        if (title.isBlank()) continue;
        var matches = expenseItemService.getRecentSimilarExpenses(familyId, title, 3);
        for (var m : matches) {
            similarExpenses.add(java.util.Map.of(
                    "id", m.id(), "title", m.title(),
                    "amount", m.amount(), "date", m.date()));
        }
    }

    // Reminders + memory + members are read via existing services
    List<JsonNode> reminders = recordsForDate(reminderService, familyId, date);  // family-shared reminders done today
    List<JsonNode> memory = listFamilyMemory(familyId);                          // helper to read family memory entries

    java.util.Map<String, Object> ctx = new java.util.LinkedHashMap<>();
    ctx.put("date", date);
    ctx.put("profile", profile);
    ctx.put("today", java.util.Map.of(
            "careLog", careLog,
            "growthEvents", growthEvents,
            "albumItems", albumItems,
            "expenses", expenses,
            "reminders", reminders
    ));
    ctx.put("weekAggregate", weekAgg);
    ctx.put("similarExpenses", similarExpenses);
    ctx.put("memory", memory);
    return objectMapper.writeValueAsString(ctx);
}

private DailySummaryFindingValidator.KnownIds collectKnownIds(
        JsonNode careLog,
        List<JsonNode> growthEvents,
        List<JsonNode> albumItems,
        List<JsonNode> expenses,
        String familyId
) {
    java.util.Set<String> careIds = new java.util.HashSet<>();
    if (careLog != null && careLog.has("events")) {
        careLog.path("events").forEach(e -> careIds.add(e.path("id").asText("")));
    }
    return new DailySummaryFindingValidator.KnownIds(
            careIds,
            growthEvents.stream().map(n -> n.path("id").asText("")).collect(java.util.stream.Collectors.toSet()),
            albumItems.stream().map(n -> n.path("id").asText("")).collect(java.util.stream.Collectors.toSet()),
            expenses.stream().map(n -> n.path("id").asText("")).collect(java.util.stream.Collectors.toSet()),
            java.util.Set.of(),  // reminders: family-shared reminder ids collected separately if needed
            familyMemberIds(familyId),
            familyMemoryIds(familyId)
    );
}

private java.util.Set<String> familyMemberIds(String familyId) {
    // Implementation depends on existing FamilyMemberService; for first pass return empty
    // (member references in findings will be matched by name in text, not id)
    return java.util.Set.of();
}

private java.util.Set<String> familyMemoryIds(String familyId) {
    return java.util.Set.of();
}

private List<JsonNode> listFamilyMemory(String familyId) {
    // First pass: return empty list; can be wired to MemoryRecordService later
    return List.of();
}
```

> **Engineer note:** the placeholder helpers (`familyMemberIds`, `familyMemoryIds`, `listFamilyMemory`) return empty in the first pass — this is intentional. They are wire-points for follow-up work but should not block this task. Findings referencing member/memory ids will be filtered by the validator until these are wired; finding text that just mentions "妈妈" by name still works because validator only checks id references.

- [ ] **Step 4: Verify all 3 tests pass**

Run: `cd backend && mvn -q -Dtest=DailySummaryServiceAiTests test`
Expected: BUILD SUCCESS, 3 tests pass.

- [ ] **Step 5: Verify existing tests still pass**

Run: `cd backend && mvn -q test`
Expected: BUILD SUCCESS, all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryService.java backend/src/test/java/com/xiaobao/babycompanion/service/DailySummaryServiceAiTests.java
git commit -m "feat: wire DailySummaryAiClient into DailySummaryService with fallback to deterministic"
```

---

## Task 9: Pro Trial bypass switch

**Files:**
- Modify: `backend/src/main/java/com/xiaobao/babycompanion/service/ProTrialService.java`

- [ ] **Step 1: Inspect current isPro logic**

Run: `cd backend && grep -n "isPro\b" src/main/java/com/xiaobao/babycompanion/service/ProTrialService.java`

Identify the existing `isPro(familyId)` method.

- [ ] **Step 2: Replace method body**

Replace the body of `isPro(familyId)` with:

```java
public boolean isPro(String familyId) {
    // Validation phase: all families have Pro access by default.
    // To re-enable Pro gating, restore the original entitlement lookup logic.
    // See spec docs/superpowers/specs/2026-05-26-cross-domain-daily-summary-design.md §4.2
    return true;
}
```

Keep the original method body in a private method `isProByEntitlement(String familyId)` as dead code with `@SuppressWarnings("unused")` so future restoration is a one-line change.

- [ ] **Step 3: Update existing ProTrialControllerTests**

Run: `cd backend && grep -n "isPro\|entitlement" src/test/java/com/xiaobao/babycompanion/controller/ProTrialControllerTests.java`

For any test that asserts non-Pro families are denied, **change the assertion** to verify the new behavior (all families now have access). Tests that explicitly test the Pro gating mechanism should be updated to comment-out or marked with `@Disabled("Pro gating bypassed during validation phase")`.

- [ ] **Step 4: Verify all tests pass**

Run: `cd backend && mvn -q -Dtest='*ProTrial*' test`
Expected: BUILD SUCCESS, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/xiaobao/babycompanion/service/ProTrialService.java backend/src/test/java/com/xiaobao/babycompanion/controller/ProTrialControllerTests.java
git commit -m "feat: bypass Pro entitlement check during validation phase (all families Pro)"
```

---

## Task 10: Agent benchmark cases

**Files:**
- Modify: `backend/src/test/java/com/xiaobao/babycompanion/agent/AgentBenchmarkTests.java`

- [ ] **Step 1: Add benchmark case for AI summary happy path**

Open `AgentBenchmarkTests.java`. Find the existing test method pattern (likely `@Test` annotated methods named `benchmarkXxx`). Add:

```java
@Test
void benchmarkDailySummaryAiHappyPath() throws Exception {
    // Seed fixture: family with cross-domain today data
    String familyId = "bench-summary-happy-" + System.currentTimeMillis();
    seedDailySummaryFixture(familyId);

    // Mock the AI client to return one finding of each of the 6 types
    List<FindingDto> mocked = List.of(
            new FindingDto("family_action_continuity", "妈妈用白噪音哄睡了 25 分钟", FindingRelated.empty(), null),
            new FindingDto("cross_domain_link", "今天买的奶粉今天就用了", FindingRelated.empty(), null),
            new FindingDto("expense_price_compare", "飞鹤 1 段单价比上月贵了 ¥12", FindingRelated.empty(), null),
            new FindingDto("trend_anomaly", "本周奶量平均比上周低 25%", FindingRelated.empty(), null),
            new FindingDto("media_milestone_candidate", "可能是第一次扶站", FindingRelated.empty(), null),
            new FindingDto("memory_recall", "记忆里你说过先观察鸡蛋过敏", FindingRelated.empty(), null)
    );
    when(dailySummaryAiClient.call(anyString())).thenReturn(mocked);

    DailySummaryDto summary = dailySummaryService.read(familyId, "bench-user", today());

    assertEquals(6, summary.findings().size(), "all 6 finding types should pass through");
    Set<String> seenTypes = summary.findings().stream()
            .map(FindingDto::type)
            .collect(java.util.stream.Collectors.toSet());
    assertEquals(6, seenTypes.size(), "no duplicate types");
}

@Test
void benchmarkDailySummaryFallsBackOnModelFailure() throws Exception {
    String familyId = "bench-summary-fail-" + System.currentTimeMillis();
    seedDailySummaryFixture(familyId);

    when(dailySummaryAiClient.call(anyString()))
            .thenThrow(new DailySummaryAiClient.DailySummaryAiException("simulated"));

    DailySummaryDto summary = dailySummaryService.read(familyId, "bench-user", today());

    assertTrue(summary.findings().isEmpty(), "model failure must not surface to user");
    assertNotNull(summary.text(), "deterministic summary still served");
    assertFalse(summary.facts().isEmpty(), "facts still populated from deterministic path");
}
```

Add fields/mocks at the top of the test class (follow existing `@MockBean` pattern):

```java
@MockBean
private DailySummaryAiClient dailySummaryAiClient;

@Autowired
private DailySummaryService dailySummaryService;
```

Add the `seedDailySummaryFixture` helper that creates careLog + 2 expenses + 1 album item for today.

- [ ] **Step 2: Run benchmark tests**

Run: `cd backend && mvn -q -Dtest=AgentBenchmarkTests test`
Expected: BUILD SUCCESS, 2 new tests pass, existing tests continue passing.

- [ ] **Step 3: Verify benchmark wrapper script**

Run: `npm run test:agent-benchmark`
Expected: full benchmark passes, results file `docs/agent-benchmark-results.md` updated.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/java/com/xiaobao/babycompanion/agent/AgentBenchmarkTests.java docs/agent-benchmark-results.md
git commit -m "test: add agent benchmark cases for daily summary AI happy path and fallback"
```

---

## Task 11: Frontend types

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Add Finding types**

Open `frontend/src/types.ts`. Search for existing `DailySummary` type definition (or `DailySummaryDto` if mirrored from backend). Add above it:

```typescript
export type FindingType =
  | "family_action_continuity"
  | "cross_domain_link"
  | "expense_price_compare"
  | "trend_anomaly"
  | "media_milestone_candidate"
  | "memory_recall";

export type FindingRelated = {
  careLogEventIds: string[];
  growthEventIds: string[];
  albumItemIds: string[];
  expenseIds: string[];
  reminderIds: string[];
  memberIds: string[];
  memoryIds: string[];
  comparedTo: string[];
};

export type FindingAction = {
  label: string;
  target: string;  // format: "ledger:<id>" | "album:<id>" | "milestone:<id>" | "reminder:<id>"
};

export type Finding = {
  type: FindingType;
  text: string;
  related: FindingRelated;
  action: FindingAction | null;
};
```

- [ ] **Step 2: Extend DailySummary type**

Find existing `DailySummary` type. Add `findings: Finding[]` field. If the type was a JSON pass-through, update it explicitly.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: TypeScript compile succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat(types): add Finding, FindingRelated, FindingAction types"
```

---

## Task 12: Frontend dailySummary util

**Files:**
- Create: `frontend/src/utils/dailySummary.ts`

- [ ] **Step 1: Write util module**

Write `frontend/src/utils/dailySummary.ts`:

```typescript
import type { Finding, FindingType } from "../types";

export type ActionDomain = "ledger" | "album" | "milestone" | "reminder";

export type ParsedActionTarget = {
  domain: ActionDomain;
  id: string;
} | null;

const VALID_DOMAINS: readonly ActionDomain[] = ["ledger", "album", "milestone", "reminder"];

export function parseActionTarget(target: string): ParsedActionTarget {
  if (!target) return null;
  const sep = target.indexOf(":");
  if (sep <= 0) return null;
  const domain = target.slice(0, sep);
  const id = target.slice(sep + 1);
  if (!id) return null;
  if (!(VALID_DOMAINS as readonly string[]).includes(domain)) return null;
  return { domain: domain as ActionDomain, id };
}

export const FINDING_TYPE_LABEL: Record<FindingType, string> = {
  family_action_continuity: "家庭接力",
  cross_domain_link: "跨域关联",
  expense_price_compare: "价格对比",
  trend_anomaly: "趋势观察",
  media_milestone_candidate: "里程碑候选",
  memory_recall: "记忆触发",
};

export const FINDING_TYPE_COLOR: Record<FindingType, string> = {
  family_action_continuity: "#7eafd8",
  cross_domain_link: "#e8a45e",
  expense_price_compare: "#b08868",
  trend_anomaly: "#d88276",
  media_milestone_candidate: "#b894d4",
  memory_recall: "#8ac4a8",
};

export function findingsByType(findings: Finding[]): Map<FindingType, Finding[]> {
  const map = new Map<FindingType, Finding[]>();
  for (const f of findings) {
    if (!map.has(f.type)) map.set(f.type, []);
    map.get(f.type)!.push(f);
  }
  return map;
}
```

- [ ] **Step 2: Add quick smoke test**

Add to the bottom of an existing smoke / unit test file (or create `frontend/src/utils/dailySummary.test.ts` if the project has a test runner; otherwise verify manually below):

```typescript
// Manual verification snippet — paste into browser console after dev server start:
//
//   import { parseActionTarget } from "/src/utils/dailySummary";
//   console.assert(parseActionTarget("ledger:exp-1")?.domain === "ledger");
//   console.assert(parseActionTarget("invalid:x") === null);
//   console.assert(parseActionTarget("ledger:") === null);
//   console.assert(parseActionTarget("") === null);
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/dailySummary.ts
git commit -m "feat(util): add daily summary action target parser and type label maps"
```

---

## Task 13: Frontend DailySummaryView component

**Files:**
- Create: `frontend/src/views/DailySummaryView.tsx`
- Create: `frontend/src/styles/daily-summary.css`
- Modify: `frontend/src/styles.css` (import the new stylesheet)

- [ ] **Step 1: Create stylesheet**

Write `frontend/src/styles/daily-summary.css`:

```css
.daily-summary {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.daily-summary__section {
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.daily-summary__section h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #888;
  font-weight: 500;
}

.daily-summary__facts {
  font-size: 15px;
  line-height: 1.6;
  color: #333;
}

.daily-summary__finding {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.daily-summary__finding:last-child {
  border-bottom: none;
}

.daily-summary__finding-tag {
  flex-shrink: 0;
  font-size: 11px;
  color: #fff;
  padding: 2px 8px;
  border-radius: 10px;
  margin-top: 2px;
}

.daily-summary__finding-body {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
}

.daily-summary__finding-action {
  display: inline-block;
  margin-top: 6px;
  padding: 4px 10px;
  font-size: 12px;
  background: #f5f5f5;
  border-radius: 12px;
  color: #333;
  cursor: pointer;
}

.daily-summary__missing {
  font-size: 13px;
  color: #888;
}

.daily-summary__missing-item {
  padding: 4px 0;
}
```

- [ ] **Step 2: Import in styles.css**

Modify `frontend/src/styles.css`. Add this import line near other `@import` statements at the top:

```css
@import "./styles/daily-summary.css";
```

- [ ] **Step 3: Create the view component**

Write `frontend/src/views/DailySummaryView.tsx`:

```tsx
import type { DailySummary, Finding } from "../types";
import {
  FINDING_TYPE_COLOR,
  FINDING_TYPE_LABEL,
  parseActionTarget,
} from "../utils/dailySummary";

export type DailySummaryViewProps = {
  summary: DailySummary | null;
  onActionClick: (domain: string, id: string) => void;
};

export function DailySummaryView({ summary, onActionClick }: DailySummaryViewProps) {
  if (!summary) return null;

  const hasFindings = summary.findings && summary.findings.length > 0;
  const hasMissing = summary.missingItems && summary.missingItems.length > 0;
  const hasObservations = summary.observations && summary.observations.length > 0;

  return (
    <section className="daily-summary" aria-label="今日发现">
      {summary.facts && summary.facts.length > 0 && (
        <div className="daily-summary__section">
          <h3>宝宝今天</h3>
          <p className="daily-summary__facts">{summary.facts.join("；")}</p>
        </div>
      )}

      {hasFindings && (
        <div className="daily-summary__section">
          <h3>你可能没注意到</h3>
          {summary.findings.map((finding, idx) => (
            <FindingRow
              key={`${finding.type}-${idx}`}
              finding={finding}
              onActionClick={onActionClick}
            />
          ))}
        </div>
      )}

      {hasObservations && (
        <div className="daily-summary__section">
          <h3>需要你看一眼</h3>
          {summary.observations.map((text, idx) => (
            <div key={idx} className="daily-summary__missing-item">{text}</div>
          ))}
        </div>
      )}

      {hasMissing && (
        <div className="daily-summary__section">
          <h3>漏掉了吗</h3>
          {summary.missingItems.map((item) => (
            <div key={item.id} className="daily-summary__missing-item">
              {item.message}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type FindingRowProps = {
  finding: Finding;
  onActionClick: (domain: string, id: string) => void;
};

function FindingRow({ finding, onActionClick }: FindingRowProps) {
  const parsed = finding.action ? parseActionTarget(finding.action.target) : null;
  const tagColor = FINDING_TYPE_COLOR[finding.type] ?? "#aaa";
  const tagLabel = FINDING_TYPE_LABEL[finding.type] ?? finding.type;

  return (
    <div className="daily-summary__finding">
      <span
        className="daily-summary__finding-tag"
        style={{ backgroundColor: tagColor }}
        aria-label={tagLabel}
      >
        {tagLabel}
      </span>
      <div className="daily-summary__finding-body">
        <span>{finding.text}</span>
        {finding.action && parsed && (
          <button
            type="button"
            className="daily-summary__finding-action"
            onClick={() => onActionClick(parsed.domain, parsed.id)}
          >
            {finding.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: TypeScript compile succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/DailySummaryView.tsx frontend/src/styles/daily-summary.css frontend/src/styles.css
git commit -m "feat(view): add DailySummaryView with 4-module render and finding click dispatch"
```

---

## Task 14: Wire DailySummaryView into App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Locate 记录 Tab today page render**

Run: `grep -n "activeMobileTab.*records\|records.*today\|RecordView\|record-tabs" frontend/src/App.tsx | head -20`

Find where the "records" tab renders the "today" view (RecordView === "today" branch).

- [ ] **Step 2: Import DailySummaryView**

At the top of `App.tsx`, add:

```tsx
import { DailySummaryView } from "./views/DailySummaryView";
```

- [ ] **Step 3: Add action click handler near other handlers**

Add this handler (placement: with other tab-switch handlers like `switchMobileTab`):

```tsx
const handleFindingActionClick = (domain: string, id: string) => {
  switch (domain) {
    case "ledger":
      setActiveMobileTab("ledger");
      // Optional: also set selected expense id if a "details" view supports it
      break;
    case "album":
      setActiveMobileTab("album");
      break;
    case "milestone":
      setShowMilestones(true);  // or whatever existing state opens MilestonesView
      break;
    case "reminder":
      setActiveMobileTab("reminders");
      break;
  }
};
```

> **Engineer note:** the exact state setter names (`setShowMilestones`, etc.) depend on existing App.tsx structure. Find the corresponding setter by searching for where MilestonesView is currently opened.

- [ ] **Step 4: Mount component in today view**

Inside the records-tab + today-view JSX block, find the existing children layout. Insert the DailySummaryView near the top (above the existing 今日 stats / careLog timeline):

```tsx
<DailySummaryView
  summary={currentDailySummary}
  onActionClick={handleFindingActionClick}
/>
```

Where `currentDailySummary` is the existing state holding the loaded daily summary. If the state isn't already loaded for the today view, ensure the existing daily summary load effect runs when this tab/view is active.

- [ ] **Step 5: Hide Pro Trial entry points**

Run: `grep -n "申请.*Pro\|Pro.*申请\|ProTrialApply\|trialApplication" frontend/src/App.tsx`

For each Pro 申请 button / banner UI, wrap it in `{false && (...)}` or remove it. Add a code comment:

```tsx
{/* Pro trial entry hidden during validation phase — see docs/superpowers/specs/2026-05-26-cross-domain-daily-summary-design.md §4.2 */}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(app): mount DailySummaryView in records-today view; hide Pro trial entry"
```

---

## Task 15: Frontend smoke fixture for findings

**Files:**
- Modify: `scripts/frontend-smoke.mjs`

- [ ] **Step 1: Locate existing daily summary mock**

Run: `grep -n "dailySummary\|daily_summary" scripts/frontend-smoke.mjs`

- [ ] **Step 2: Add sample findings to the mock**

Locate the mock `/api/pro/daily-summary/current` (or equivalent) response. Add a `findings` array with at least 3 different finding types so the visual smoke screenshot exercises the new view:

```javascript
findings: [
  {
    type: "family_action_continuity",
    text: "下午 3 点你出门后，妈妈用白噪音哄睡了 25 分钟",
    related: { careLogEventIds: [], growthEventIds: [], albumItemIds: [], expenseIds: [], reminderIds: [], memberIds: [], memoryIds: [], comparedTo: [] },
    action: null
  },
  {
    type: "expense_price_compare",
    text: "今天买的飞鹤 1 段，比上月单价贵了 ¥12",
    related: { careLogEventIds: [], growthEventIds: [], albumItemIds: [], expenseIds: ["exp-sample-1"], reminderIds: [], memberIds: [], memoryIds: [], comparedTo: ["exp-sample-2"] },
    action: { label: "去账本", target: "ledger:exp-sample-1" }
  },
  {
    type: "media_milestone_candidate",
    text: "妈妈发的这张照片里，他可能第一次扶站",
    related: { careLogEventIds: [], growthEventIds: [], albumItemIds: ["alb-sample-1"], expenseIds: [], reminderIds: [], memberIds: [], memoryIds: [], comparedTo: [] },
    action: { label: "标记里程碑", target: "milestone:first_stand" }
  }
]
```

- [ ] **Step 3: Run verify:frontend**

Run: `npm run verify:frontend`
Expected: full smoke passes across desktop and 6 mobile viewports; no horizontal overflow; daily summary findings render visible in the screenshots.

- [ ] **Step 4: Commit**

```bash
git add scripts/frontend-smoke.mjs
git commit -m "test: extend frontend smoke fixture with daily summary findings"
```

---

## Task 16: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Backend full test**

Run: `cd backend && mvn -q test`
Expected: ALL tests pass (existing + 4 new test files).

- [ ] **Step 2: Agent benchmark**

Run: `npm run test:agent-benchmark`
Expected: PASS with new daily-summary cases included; `docs/agent-benchmark-results.md` updated.

- [ ] **Step 3: Frontend verify**

Run: `npm run verify:frontend`
Expected: PASS across all viewports.

- [ ] **Step 4: Git diff check**

Run: `git diff --check`
Expected: clean (no whitespace errors).

- [ ] **Step 5: Harness init**

Run: `bash harness/init.sh`
Expected: smoke gate passes.

- [ ] **Step 6: Manual verification (real family data)**

With a real account (use existing test account on Aliyun or local DB seeded from production snapshot if available):

1. Open the App, navigate to 记录 Tab today page
2. Click "生成今日小结" (or whatever the existing trigger is)
3. Inspect the rendered DailySummaryView:
   - Does the deterministic "facts" block render?
   - Do AI findings render with correct type tags and colors?
   - Do action buttons (if any) appear with click handlers?
4. Stop the backend, click "生成" again → confirm graceful fallback (deterministic-only summary, no error dialog)

Record findings in `docs/superpowers/specs/2026-05-26-cross-domain-daily-summary-design.md` Section 10 (验收标准) checklist.

- [ ] **Step 7: No commit needed (verification step)**

---

## Task 17: OTA release + Aliyun deploy

**Files:** none (release only)

- [ ] **Step 1: Build mobile update**

Run:
```bash
MOBILE_UPDATE_MESSAGE='跨域AI今日发现' \
  MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 \
  VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 \
  npm run build:mobile:update
```
Expected: bundle generated under `backend/data/mobile-updates/`.

- [ ] **Step 2: Upload to OSS**

Run:
```bash
MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun \
  SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun \
  scripts/upload-mobile-update-oss.sh
```
Expected: OTA zip uploaded; manifest rewritten with `ossObjectKey`.

- [ ] **Step 3: Deploy code + OTA manifest to Aliyun**

Run:
```bash
SYNC_DATA=0 \
  SYNC_MOBILE_UPDATES=1 \
  SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 \
  ECS_HOST=120.55.188.242 \
  SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun \
  npm run deploy:aliyun
```
Expected: backend redeployed; OTA manifest synced; production data untouched.

- [ ] **Step 4: Cloud verification**

```bash
curl -fsS http://120.55.188.242:8300/api/health
```
Expected: `ok`.

Then probe the OTA manifest:
```bash
curl -fsS -X POST http://120.55.188.242:8300/api/mobile-updates/check \
  -H 'Content-Type: application/json' \
  -d '{"platform":"ios","currentBundleVersion":"0.1.0"}'
```
Expected: response includes the new bundle version + signed OSS URL.

- [ ] **Step 5: Update harness progress**

Edit `harness/claude-progress.md` and prepend a new session entry:

```markdown
### Session 2026-05-26 Cross-Domain Daily Summary

- Goal: 升级每日小结从 deterministic 拼接到跨域 AI 信息发现型。
- Completed:
  - 后端：新增 FindingDto、DailySummaryPrompts、DailySummaryAiClient、DailySummaryFindingValidator；CareLogRecordService 加 getRecentDaysAggregate；ExpenseItemRecordService 加 getRecentSimilarExpenses；DailySummaryService 集成 AI + fallback。
  - Pro Trial 设施保留，isPro 临时返回 true。
  - 前端：新增 DailySummaryView + utils/dailySummary + styles/daily-summary.css，挂载到「记录」Tab 今日页；隐藏 Pro 申请入口。
  - 测试：4 个新测试文件 + Agent benchmark 2 case。
- Verification run:
  - mvn test
  - npm run test:agent-benchmark
  - npm run verify:frontend
  - bash harness/init.sh
  - Aliyun deploy with SYNC_DATA=0
  - Cloud health probe
- Evidence:
  - <fill after run: backend test count, benchmark count, OTA version, bundle checksum>
- Known risks:
  - 真实 model 调用质量未在 production 验证，依靠真家庭 1 周数据手动 review。
  - familyMemberIds / familyMemoryIds / listFamilyMemory 当前返回空集合，后续可补全增强 finding 召回。
```

- [ ] **Step 6: Final commit**

```bash
git add harness/claude-progress.md docs/agent-benchmark-results.md
git commit -m "chore: record cross-domain daily summary session in harness progress"
```

---

## Self-Review Notes

After completing all tasks:

- [ ] **Spec coverage check:** Every section of `docs/superpowers/specs/2026-05-26-cross-domain-daily-summary-design.md` mapped to at least one task above
- [ ] **Verification ladder:** Each implementation step has a corresponding test or verify command
- [ ] **No placeholder text:** Re-scan for TBD / TODO / "appropriate" / "etc."
- [ ] **Backward compatibility:** Existing `DailySummary` consumers (e.g. `/api/app/state` deserialization) work without changes thanks to compact constructor default

## Risks during execution

| Risk | Mitigation |
|---|---|
| Existing fixture pattern in tests differs from what these task snippets assume | Each task that seeds data has a note pointing engineer to existing test files to mirror; do not invent new fixture infra |
| DeepSeek API quota / key not configured locally | Tests use `@MockBean DailySummaryAiClient`, so do not depend on real key; only `DefaultDailySummaryAiClient` smoke testing needs it |
| App.tsx merge conflict if other work is in flight | Land this work behind a feature flag if needed, or coordinate with branch owner before mounting in App.tsx |
| OTA upload failure mid-release | Steps 1-4 of Task 17 are idempotent; failed upload can be retried without backend redeploy |
