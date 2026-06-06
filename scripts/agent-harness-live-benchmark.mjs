import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const harnessPath = path.join(rootDir, "harness", "agent-model-context-harness.md");

const DEFAULT_PROVIDER = "deepseek";
const DEFAULT_MAX_CALLS = 24;
const DEFAULT_MAX_TOKENS = 450;
const DEFAULT_BUDGET_CNY = 20;
const DEFAULT_USD_CNY = 7.3;

const PROVIDERS = {
  deepseek: {
    defaultModel: "deepseek-v4-pro",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultChatPath: "/chat/completions",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    apiKeyFileEnv: "DEEPSEEK_API_KEY_FILE",
    defaultApiKeyFile: "/Users/.deepseek_apikey",
    modelEnv: "DEEPSEEK_MODEL",
    baseUrlEnv: "DEEPSEEK_BASE_URL",
    chatPathEnv: "DEEPSEEK_CHAT_PATH",
    maxTokensEnv: "DEEPSEEK_MAX_TOKENS",
    responseFormat: true,
    thinking: true,
  },
  doubao: {
    defaultModel: "doubao-seed-2-0-pro-260215",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultChatPath: "/chat/completions",
    apiKeyEnv: "DOUBAO_API_KEY",
    fallbackApiKeyEnv: "ARK_API_KEY",
    apiKeyFileEnv: "DOUBAO_API_KEY_FILE",
    defaultApiKeyFile: "/Users/.doubao_apikey",
    modelEnv: "DOUBAO_MODEL",
    baseUrlEnv: "DOUBAO_BASE_URL",
    chatPathEnv: "DOUBAO_CHAT_PATH",
    maxTokensEnv: "DOUBAO_MAX_TOKENS",
    serviceTierEnv: "DOUBAO_SERVICE_TIER",
    defaultServiceTier: "fast",
    responseFormat: false,
    thinking: false,
  },
};

const MODEL_RATES = {
  "deepseek-v4-flash": {
    inputMissUsdPer1M: 0.14,
    inputHitUsdPer1M: 0.0028,
    outputUsdPer1M: 0.28,
  },
  // Conservative non-discount guard for pro. Actual billing may be lower.
  "deepseek-v4-pro": {
    inputMissUsdPer1M: 1.74,
    inputHitUsdPer1M: 0.0145,
    outputUsdPer1M: 3.48,
  },
  // Conservative guard for Ark/Doubao live smoke. Override with env rates when needed.
  "doubao-seed-2-0-pro-260215": {
    inputMissUsdPer1M: 2.0,
    inputHitUsdPer1M: 2.0,
    outputUsdPer1M: 6.0,
  },
  "doubao-seed-2-0-lite-260215": {
    inputMissUsdPer1M: 1.0,
    inputHitUsdPer1M: 1.0,
    outputUsdPer1M: 3.0,
  },
};

const scenarios = [
  {
    id: "recent-milk-confirmation",
    userMessage: "母乳",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T00:58:00+08:00",
      currentTime: "00:58",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养", ageLabel: "2个月12天" },
      recentMessages: [
        { role: "user", content: "刚才喝了20毫升奶" },
        { role: "assistant", content: "这次喝了20ml奶，是母乳还是奶粉？" },
      ],
      recordContext: {
        todayCareLog: { date: "2026-06-06", milkMl: 120, events: [] },
        pendingEffectSummaries: [
          {
            type: "careLog",
            mode: "ask",
            missingFields: ["feedingType"],
            draft: { date: "2026-06-06", milkMl: 20, time: "00:58" },
          },
        ],
      },
    },
    expect: {
      description: "Short milk-type confirmation merges with previous ask and produces one complete milk event.",
      checks: [
        (output) => hasEffect(output, "careLog"),
        (output) => effectValue(output, "careLog", "mode") === "auto",
        (output) => Number(effectValue(output, "careLog", "amountMl")) === 20,
        (output) => effectValue(output, "careLog", "feedingType") === "breast",
        (output) => effectValue(output, "careLog", "time") === "00:58",
      ],
    },
  },
  {
    id: "midnight-twelve",
    userMessage: "十二点喝了100毫升奶粉",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T00:21:00+08:00",
      currentTime: "00:21",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recentMessages: [],
      recordContext: { todayCareLog: { date: "2026-06-06", milkMl: 120, events: [] } },
    },
    expect: {
      description: "Near midnight, plain twelve means 00:00, not noon.",
      checks: [
        (output) => hasEffect(output, "careLog"),
        (output) => effectValue(output, "careLog", "mode") === "auto",
        (output) => Number(effectValue(output, "careLog", "amountMl")) === 100,
        (output) => effectValue(output, "careLog", "feedingType") === "formula",
        (output) => effectValue(output, "careLog", "time") === "00:00",
      ],
    },
  },
  {
    id: "read-only-reminders",
    userMessage: "今天还有啥提醒？只看看，别又给我新建。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T10:30:00+08:00",
      currentTime: "10:30",
      timeZone: "Asia/Shanghai",
      requester: { role: "father", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {
        openReminders: [
          { title: "喂奶提醒", dueText: "今天 12:00", scheduleMode: "once" },
          { title: "维生素D", dueText: "今天 20:00", scheduleMode: "once" },
        ],
      },
    },
    expect: {
      description: "Read-only reminder query must not create or ask for a new reminder.",
      checks: [
        (output) => mutation(output) === "none",
        (output) => effects(output).length === 0,
        (output) => !hasAffirmativeMutationCopy(reply(output), ["新建", "创建"]),
      ],
    },
  },
  {
    id: "feeding-interval-reminder",
    userMessage: "每半小时闹一下喂奶，但别把这句话记成宝宝习惯。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T11:10:00+08:00",
      currentTime: "11:10",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Interval feeding reminder, not a feeding record and not a memory.",
      checks: [
        (output) => hasEffect(output, "reminder"),
        (output) => effectValue(output, "reminder", "scheduleMode") === "interval",
        (output) => Number(effectValue(output, "reminder", "intervalMinutes")) === 30,
        (output) => !hasEffect(output, "careLog"),
        (output) => !hasEffect(output, "memory"),
      ],
    },
  },
  {
    id: "growth-ambiguous-weight",
    userMessage: "今天体重14，帮我维护一下。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T12:00:00+08:00",
      currentTime: "12:00",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: { recentGrowthMeasurements: [{ type: "weight", value: 6.8, unit: "kg", date: "2026-05-28" }] },
    },
    expect: {
      description: "Ambiguous Chinese weight unit asks for unit before saving.",
      checks: [
        (output) => hasEffect(output, "growthMeasurement"),
        (output) => effectValue(output, "growthMeasurement", "mode") === "ask",
        (output) => fieldList(output, "growthMeasurement", "missingFields").some((field) => ["unit", "weightUnit"].includes(field) || String(field).toLowerCase().includes("unit") || String(field).includes("单位")),
        (output) => !["auto", "pending"].includes(effectValue(output, "growthMeasurement", "mode")),
      ],
    },
  },
  {
    id: "expense-reference-price",
    userMessage: "这个条形码大概多少钱？先别记账。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T13:20:00+08:00",
      currentTime: "13:20",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Reference price lookup is not an actual expense record.",
      checks: [
        (output) => !hasEffect(output, "expenseItem"),
        (output) => mutation(output) === "none",
      ],
    },
  },
  {
    id: "ordinary-qa-no-memory",
    userMessage: "宝宝不爱吃辅食怎么办？",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T15:00:00+08:00",
      currentTime: "15:00",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养", ageLabel: "7个月" },
      recordContext: {},
    },
    expect: {
      description: "Ordinary parenting Q&A should not save memory or care records.",
      checks: [
        (output) => mutation(output) === "none",
        (output) => effects(output).length === 0,
        (output) => !reply(output).includes("我会记住") && !reply(output).includes("记到"),
      ],
    },
  },
  {
    id: "private-reminder-share",
    userMessage: "把我的产后复诊提醒同步给奶奶，不要重新建一条。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T16:10:00+08:00",
      currentTime: "16:10",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {
        openReminders: [{ title: "产后复诊", dueText: "下周二 09:00", private: true }],
      },
    },
    expect: {
      description: "Private caregiver reminder sharing is a boundary, not sync or create.",
      checks: [
        (output) => mutation(output) === "none",
        (output) => effects(output).length === 0,
        (output) => !hasAffirmativeMutationCopy(reply(output), ["已同步", "同步给", "新建", "创建", "再建", "重新建", "添加", "另建", "设置一个", "类似的提醒", "类似提醒"]),
      ],
    },
  },
  {
    id: "mixed-feeding-missing-type",
    userMessage: "刚才喝了120毫升奶。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T17:20:00+08:00",
      currentTime: "17:20",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: { todayCareLog: { date: "2026-06-06", milkMl: 120, events: [] } },
    },
    expect: {
      description: "Mixed feeding generic milk amount asks milk type, not auto-save.",
      checks: [
        (output) => hasEffect(output, "careLog"),
        (output) => effectValue(output, "careLog", "mode") === "ask",
        (output) => fieldList(output, "careLog", "missingFields").includes("feedingType"),
        (output) => Number(effectValue(output, "careLog", "amountMl")) === 120,
      ],
    },
  },
  {
    id: "embedded-question-vomit-record",
    userMessage: "今天芊宝咋样？刚才九点多喝了100毫升奶粉，喝完吐了一点。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T21:15:00+08:00",
      currentTime: "21:15",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "芊宝", feeding: "混合喂养" },
      recordContext: { todayCareLog: { date: "2026-06-06", milkMl: 120, events: [] } },
    },
    expect: {
      description: "Concrete milk record embedded in a question still writes one milk event, with calm health copy.",
      checks: [
        (output) => hasEffect(output, "careLog"),
        (output) => effectValue(output, "careLog", "mode") === "auto",
        (output) => Number(effectValue(output, "careLog", "amountMl")) === 100,
        (output) => effectValue(output, "careLog", "feedingType") === "formula",
        (output) => effectValue(output, "careLog", "time") === "21:00",
      ],
    },
  },
  {
    id: "feeding-start-no-amount",
    userMessage: "现在又要开始吃奶了，等会儿喝完我再说。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T18:05:00+08:00",
      currentTime: "18:05",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Feeding start without amount must not save zero or fake amount.",
      checks: [
        (output) => !hasAutoEffect(output, "careLog"),
        (output) => Number(effectValue(output, "careLog", "amountMl") || 0) === 0,
      ],
    },
  },
  {
    id: "sleep-start-no-duration",
    userMessage: "小宝刚睡着，先别记时长，醒了我补。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T14:05:00+08:00",
      currentTime: "14:05",
      timeZone: "Asia/Shanghai",
      requester: { role: "father", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Sleep start without duration must not invent a complete sleep record.",
      checks: [
        (output) => !hasAutoEffect(output, "careLog"),
        (output) => Number(effectValue(output, "careLog", "durationHours") || 0) === 0,
      ],
    },
  },
  {
    id: "vague-health-reminder",
    userMessage: "晚点提醒我看看湿疹，具体时间我还没想好。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T19:00:00+08:00",
      currentTime: "19:00",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Vague health reminder asks concrete time and does not invent due time.",
      checks: [
        (output) => hasEffect(output, "reminder"),
        (output) => effectValue(output, "reminder", "mode") === "ask",
        (output) => fieldList(output, "reminder", "missingFields").some((field) => ["time", "dueAt", "dueTime", "concreteTime"].includes(field) || String(field).toLowerCase().includes("time") || String(field).includes("时间")),
        (output) => !hasAutoEffect(output, "reminder"),
      ],
    },
  },
  {
    id: "medicine-reminder-pending",
    userMessage: "明天上午9点提醒我给宝宝吃医生开的维生素D。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T20:00:00+08:00",
      currentTime: "20:00",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Medicine reminder stays pending or asks confirmation, not auto-create.",
      checks: [
        (output) => hasEffect(output, "reminder"),
        (output) => ["pending", "ask"].includes(effectValue(output, "reminder", "mode")),
        (output) => !hasAutoEffect(output, "reminder"),
      ],
    },
  },
  {
    id: "growth-measurement-complete",
    userMessage: "今天身高68.2cm，体重7.4kg，头围42cm，帮我维护到成长数据。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T09:00:00+08:00",
      currentTime: "09:00",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Complete growth measurements become pending drafts.",
      checks: [
        (output) => effectsOf(output, "growthMeasurement").length >= 3,
        (output) => effectsOf(output, "growthMeasurement").every((item) => item.mode === "pending"),
      ],
    },
  },
  {
    id: "growth-out-of-range",
    userMessage: "今天身高999cm，帮我记一下。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T09:30:00+08:00",
      currentTime: "09:30",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Out-of-range growth measurement asks confirmation, not save.",
      checks: [
        (output) => hasEffect(output, "growthMeasurement"),
        (output) => effectValue(output, "growthMeasurement", "mode") === "ask",
        (output) => !hasAutoEffect(output, "growthMeasurement") && !hasPendingEffect(output, "growthMeasurement"),
      ],
    },
  },
  {
    id: "growth-duplicate-boundary",
    userMessage: "今天体重还是7.4kg，帮我维护一下。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T09:45:00+08:00",
      currentTime: "09:45",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {
        recentGrowthMeasurements: [{ type: "weight", value: 7.4, unit: "kg", date: "2026-06-06" }],
      },
    },
    expect: {
      description: "Duplicate same-day same-value growth measurement asks instead of adding another draft.",
      checks: [
        (output) => !hasAutoEffect(output, "growthMeasurement") && !hasPendingEffect(output, "growthMeasurement"),
        (output) => effects(output).length === 0 || effectValue(output, "growthMeasurement", "mode") === "ask",
        (output) => fieldList(output, "growthMeasurement", "missingFields").includes("duplicate") || ["已经", "重复", "不需要"].some((word) => reply(output).includes(word)),
      ],
    },
  },
  {
    id: "growth-update-boundary",
    userMessage: "把上周那条身高改成68.5，刚才输错了。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T10:00:00+08:00",
      currentTime: "10:00",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: { recentGrowthMeasurements: [{ type: "height", value: 67.5, unit: "cm", date: "2026-05-29" }] },
    },
    expect: {
      description: "Historical growth edit is a chat boundary, not a new pending measurement.",
      checks: [
        (output) => ["none", "ignore"].includes(mutation(output)),
        (output) => effects(output).length === 0 || effects(output).every((item) => item.mode === "ignore"),
      ],
    },
  },
  {
    id: "memory-explicit-health",
    userMessage: "记住，小宝对鸡蛋起疹子，以后辅食提醒我注意。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T11:00:00+08:00",
      currentTime: "11:00",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Explicit memory request becomes a pending memory, not ordinary Q&A.",
      checks: [
        (output) => hasEffect(output, "memory"),
        (output) => ["pending", "ask"].includes(effectValue(output, "memory", "mode")),
      ],
    },
  },
  {
    id: "expense-actual-amount",
    userMessage: "今天给小宝买奶粉花了268，记到账本。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T12:30:00+08:00",
      currentTime: "12:30",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Actual baby expense with paid amount becomes an expense draft.",
      checks: [
        (output) => hasEffect(output, "expenseItem"),
        (output) => Number(effectValue(output, "expenseItem", "amount")) === 268,
        (output) => ["pending", "auto"].includes(effectValue(output, "expenseItem", "mode")),
      ],
    },
  },
  {
    id: "photo-album-save",
    userMessage: "这张照片保存到成长相册。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T13:00:00+08:00",
      currentTime: "13:00",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      attachments: [{ id: "att-baby-photo", kind: "image", name: "baby-smile.jpg", description: "baby photo" }],
      recordContext: {},
    },
    expect: {
      description: "Explicit baby photo save creates an album effect only.",
      checks: [
        (output) => hasEffect(output, "album"),
        (output) => !hasEffect(output, "careLog"),
        (output) => !hasEffect(output, "growthMeasurement"),
      ],
    },
  },
  {
    id: "screenshot-ignore",
    userMessage: "这是App截图，别保存。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T13:10:00+08:00",
      currentTime: "13:10",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      attachments: [{ id: "att-screenshot", kind: "image", name: "app-screenshot.png", description: "mobile app screenshot" }],
      recordContext: {},
    },
    expect: {
      description: "Screenshot with explicit do-not-save creates no album or records.",
      checks: [
        (output) => mutation(output) === "none",
        (output) => effects(output).length === 0,
      ],
    },
  },
  {
    id: "read-only-daily-summary",
    userMessage: "只看今天已有记录，今天奶量和睡眠怎么样？别新增。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T17:00:00+08:00",
      currentTime: "17:00",
      timeZone: "Asia/Shanghai",
      requester: { role: "father", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {
        todayCareLog: {
          date: "2026-06-06",
          milkMl: 240,
          milkTimes: 3,
          sleepHours: 3,
          events: [
            { type: "milk", time: "08:00", amountMl: 120 },
            { type: "milk", time: "12:00", amountMl: 120 },
            { type: "sleep", time: "13:00", durationHours: 3 },
          ],
        },
      },
    },
    expect: {
      description: "Read-only daily summary uses seeded context and creates no effects.",
      checks: [
        (output) => mutation(output) === "none",
        (output) => effects(output).length === 0,
        (output) => reply(output).includes("240") || reply(output).includes("3"),
        (output) => !hasAffirmativeMutationCopy(reply(output), ["帮你记", "帮你记录", "记新的", "新增", "告诉我"]),
      ],
    },
  },
  {
    id: "caregiver-fatigue-support",
    userMessage: "我今天真的好累，感觉带不动了。",
    context: {
      today: "2026-06-06",
      currentDateTime: "2026-06-06T22:00:00+08:00",
      currentTime: "22:00",
      timeZone: "Asia/Shanghai",
      requester: { role: "mother", caregiver: true },
      babyProfile: { name: "小宝", feeding: "混合喂养" },
      recordContext: {},
    },
    expect: {
      description: "Caregiver fatigue gets low-anxiety support without mutating app state.",
      checks: [
        (output) => mutation(output) === "none",
        (output) => effects(output).length === 0,
        (output) => ["辛苦", "不容易", "休息", "支持", "先喘口气", "可以"].some((word) => reply(output).includes(word)),
        (output) => !hasAffirmativeMutationCopy(reply(output), ["帮忙记录", "帮你记录", "帮你记", "设置提醒", "设置相关提醒", "设个提醒"]),
      ],
    },
  },
];

function parseArgs(argv) {
  const providerName = process.env.AGENT_LIVE_PROVIDER || DEFAULT_PROVIDER;
  const provider = PROVIDERS[providerName] || PROVIDERS[DEFAULT_PROVIDER];
  const args = {
    dryRun: false,
    provider: providerName,
    model: process.env[provider.modelEnv] || provider.defaultModel,
    maxCalls: Number(process.env.MAX_LIVE_CALLS || DEFAULT_MAX_CALLS),
    maxTokens: Number(process.env[provider.maxTokensEnv] || process.env.AGENT_LIVE_MAX_TOKENS || DEFAULT_MAX_TOKENS),
    budgetCny: Number(process.env.AGENT_LIVE_BUDGET_CNY || process.env.DEEPSEEK_BUDGET_CNY || DEFAULT_BUDGET_CNY),
    usdCny: Number(process.env.USD_CNY || DEFAULT_USD_CNY),
    baseUrl: process.env[provider.baseUrlEnv] || provider.defaultBaseUrl,
    chatPath: process.env[provider.chatPathEnv] || provider.defaultChatPath,
    serviceTier: process.env[provider.serviceTierEnv] || provider.defaultServiceTier || null,
    only: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--provider") {
      args.provider = argv[++index];
      const nextProvider = PROVIDERS[args.provider];
      if (!nextProvider) throw new Error(`Unknown provider: ${args.provider}`);
      args.model = process.env[nextProvider.modelEnv] || nextProvider.defaultModel;
      args.maxTokens = Number(process.env[nextProvider.maxTokensEnv] || process.env.AGENT_LIVE_MAX_TOKENS || DEFAULT_MAX_TOKENS);
      args.baseUrl = process.env[nextProvider.baseUrlEnv] || nextProvider.defaultBaseUrl;
      args.chatPath = process.env[nextProvider.chatPathEnv] || nextProvider.defaultChatPath;
      args.serviceTier = process.env[nextProvider.serviceTierEnv] || nextProvider.defaultServiceTier || null;
    }
    else if (arg === "--model") args.model = argv[++index];
    else if (arg === "--max-calls") args.maxCalls = Number(argv[++index]);
    else if (arg === "--max-tokens") args.maxTokens = Number(argv[++index]);
    else if (arg === "--budget-cny") args.budgetCny = Number(argv[++index]);
    else if (arg === "--only") args.only = argv[++index].split(",").map((item) => item.trim()).filter(Boolean);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readApiKey(args) {
  const provider = providerConfig(args);
  if (process.env[provider.apiKeyEnv]) return process.env[provider.apiKeyEnv].trim();
  if (provider.fallbackApiKeyEnv && process.env[provider.fallbackApiKeyEnv]) return process.env[provider.fallbackApiKeyEnv].trim();
  const filePath = process.env[provider.apiKeyFileEnv] || provider.defaultApiKeyFile;
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, "utf8").trim();
  return "";
}

function ratesFor(model) {
  return MODEL_RATES[model] || MODEL_RATES[PROVIDERS[DEFAULT_PROVIDER].defaultModel];
}

function providerConfig(args) {
  const provider = PROVIDERS[args.provider];
  if (!provider) throw new Error(`Unknown provider: ${args.provider}`);
  return provider;
}

function reportPathFor(args) {
  if (args.provider === DEFAULT_PROVIDER) {
    return path.join(rootDir, "docs", "agent-harness-live-benchmark-results.md");
  }
  return path.join(rootDir, "docs", `agent-harness-live-benchmark-results-${args.provider}.md`);
}

function estimateTokens(text) {
  return Math.ceil(text.length * 1.2);
}

function estimateCostCny(inputTokens, maxOutputTokens, model, usdCny) {
  const rates = ratesFor(model);
  const usd = (inputTokens / 1_000_000) * rates.inputMissUsdPer1M
    + (maxOutputTokens / 1_000_000) * rates.outputUsdPer1M;
  return usd * usdCny;
}

function usageCostCny(usage, model, usdCny) {
  if (!usage) return 0;
  const rates = ratesFor(model);
  const cacheHit = Number(usage.prompt_cache_hit_tokens || 0);
  const cacheMiss = Number(
    usage.prompt_cache_miss_tokens
    ?? Math.max(0, Number(usage.prompt_tokens || 0) - cacheHit)
  );
  const output = Number(usage.completion_tokens || 0);
  const usd = (cacheMiss / 1_000_000) * rates.inputMissUsdPer1M
    + (cacheHit / 1_000_000) * rates.inputHitUsdPer1M
    + (output / 1_000_000) * rates.outputUsdPer1M;
  return usd * usdCny;
}

function buildMessages(harness, scenario) {
  const schema = {
    classification: {
      intent: "record|question|reminder|growth|expense|memory|boundary",
      mutation: "auto|ask|pending|none|ignore",
    },
    effects: [
      {
        type: "careLog|reminder|growthMeasurement|expenseItem|memory|album",
        mode: "auto|ask|pending|ignore",
        date: "YYYY-MM-DD or null",
        time: "HH:mm or null",
        amountMl: "number or null",
        amount: "expense amount number or null",
        title: "short item/title or null",
        category: "category or null",
        durationHours: "number or null",
        feedingType: "breast|formula|unknown|null",
        scheduleMode: "once|interval|null",
        intervalMinutes: "number or null",
        missingFields: ["field names when asking"],
        note: "short reason",
      },
    ],
    reply: "natural user-facing Chinese text",
  };

  return [
    {
      role: "system",
      content: [
        "You are the Xiaobaoji model-under-harness evaluator.",
        "Return valid JSON only. Do not include markdown.",
        "Use the injected modelContextHarness as the behavior source.",
        "The JSON may use structured field names, but the reply field must be natural Chinese and must not expose internal process labels.",
        "If no mutation is allowed, set classification.mutation to none and effects to an empty array.",
        "When several independent measurements or effects are present, emit one effect object per item.",
        "Omit null fields from effect objects; include only fields that matter for the scenario.",
        "Valid JSON is more important than detail. Keep the JSON compact and make sure every array element is separated by a comma.",
        "Start your answer with { and end with }. No prose outside the JSON object.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "modelContextHarness:",
        harness,
        "",
        "runtimeContext:",
        JSON.stringify(scenario.context, null, 2),
        "",
        `currentUserMessage: ${scenario.userMessage}`,
        "",
        "Return JSON matching this shape:",
        JSON.stringify(schema, null, 2),
      ].join("\n"),
    },
  ];
}

async function callModel({ apiKey, args, messages }) {
  const provider = providerConfig(args);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const body = {
    model: args.model,
    messages,
    temperature: 0,
    max_tokens: args.maxTokens,
  };
  if (provider.responseFormat) body.response_format = { type: "json_object" };
  if (provider.thinking) body.thinking = { type: "disabled" };
  if (args.provider === "doubao" && args.serviceTier) body.service_tier = args.serviceTier;

  try {
    const response = await fetch(`${args.baseUrl.replace(/\/$/, "")}${args.chatPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${args.provider} HTTP ${response.status}: ${text.slice(0, 500)}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

function modelContent(apiResponse) {
  return apiResponse?.choices?.[0]?.message?.content || "";
}

function parseModelJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(content.slice(start, end + 1));
    throw new Error(`Model did not return parseable JSON: ${content.slice(0, 300)}`);
  }
}

function effects(output) {
  return Array.isArray(output?.effects) ? output.effects : [];
}

function mutation(output) {
  return output?.classification?.mutation || "none";
}

function reply(output) {
  return String(output?.reply || "");
}

function hasAffirmativeMutationCopy(text, phrases) {
  return phrases.some((phrase) => containsAffirmedPhrase(text, phrase));
}

function containsAffirmedPhrase(text, phrase) {
  let start = 0;
  while (start < text.length) {
    const index = text.indexOf(phrase, start);
    if (index < 0) return false;
    const prefix = text.slice(Math.max(0, index - 6), index);
    const negated = ["不", "别", "未", "无", "没", "无法", "不能", "暂不", "不要", "不会", "先不"].some((word) => prefix.includes(word));
    if (!negated) return true;
    start = index + phrase.length;
  }
  return false;
}

function hasEffect(output, type) {
  return effects(output).some((effect) => effect?.type === type);
}

function effectsOf(output, type) {
  return effects(output).filter((item) => item?.type === type);
}

function hasAutoEffect(output, type) {
  return effects(output).some((effect) => effect?.type === type && effect?.mode === "auto");
}

function hasPendingEffect(output, type) {
  return effects(output).some((effect) => effect?.type === type && effect?.mode === "pending");
}

function effect(output, type) {
  return effects(output).find((item) => item?.type === type) || {};
}

function effectValue(output, type, field) {
  return effect(output, type)?.[field];
}

function fieldList(output, type, field) {
  const value = effectValue(output, type, field);
  return Array.isArray(value) ? value : [];
}

function evaluate(output, scenario) {
  const checkResults = scenario.expect.checks.map((check, index) => {
    let pass = false;
    let error = "";
    try {
      pass = Boolean(check(output));
    } catch (exception) {
      error = exception.message;
    }
    return { index: index + 1, pass, error };
  });
  return {
    pass: checkResults.every((check) => check.pass),
    checkResults,
  };
}

function outputSnippet(output) {
  return JSON.stringify(output).replace(/\s+/g, " ").slice(0, 500);
}

function writeReport({ args, selected, estimate, results, actualCost }) {
  const lines = [
    "# Agent Harness Live Benchmark Results",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Guardrails",
    "",
    `- Provider: ${args.provider}`,
    `- Model: ${args.model}`,
    `- Max calls: ${args.maxCalls}`,
    `- Max output tokens per call: ${args.maxTokens}`,
    `- Budget: ${args.budgetCny.toFixed(2)} CNY`,
    `- Preflight worst-case estimate: ${estimate.toFixed(4)} CNY`,
    `- Actual usage estimate from API response: ${actualCost.toFixed(4)} CNY`,
    "- Judge calls: disabled",
    "- Thinking: disabled",
    "",
    "## Summary",
    "",
    `- Scenarios selected: ${selected.length}`,
    `- Pass: ${results.filter((result) => result.pass).length}`,
    `- Fail: ${results.filter((result) => !result.pass).length}`,
    "",
    "| Scenario | Result | Usage | Cost CNY | Notes |",
    "| --- | --- | ---: | ---: | --- |",
    ...results.map((result) => {
      const usage = result.usage
        ? `${result.usage.prompt_tokens || 0}/${result.usage.completion_tokens || 0}`
        : "0/0";
      return `| ${result.id} | ${result.pass ? "PASS" : "FAIL"} | ${usage} | ${result.costCny.toFixed(4)} | ${result.note.replace(/\|/g, "/")} |`;
    }),
    "",
    "## Scenario Details",
    "",
    ...results.flatMap((result) => [
      `### ${result.id}`,
      "",
      `- Expected: ${result.expected}`,
      `- Checks: ${result.checkResults.map((check) => `${check.index}:${check.pass ? "PASS" : "FAIL"}`).join(", ")}`,
      `- Output: \`${outputSnippet(result.output)}\``,
      "",
    ]),
  ];
  const reportPath = reportPathFor(args);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const harness = fs.readFileSync(harnessPath, "utf8");
  const selected = scenarios
    .filter((scenario) => !args.only || args.only.includes(scenario.id))
    .slice(0, args.maxCalls);

  if (selected.length === 0) throw new Error("No scenarios selected.");
  if (args.maxCalls > DEFAULT_MAX_CALLS && !process.env.ALLOW_MORE_LIVE_CALLS) {
    throw new Error(`Refusing ${args.maxCalls} calls without ALLOW_MORE_LIVE_CALLS=1.`);
  }

  const promptTokenEstimate = selected
    .map((scenario) => estimateTokens(JSON.stringify(buildMessages(harness, scenario))))
    .reduce((sum, value) => sum + value, 0);
  const outputTokenEstimate = selected.length * args.maxTokens;
  const costEstimate = estimateCostCny(promptTokenEstimate, outputTokenEstimate, args.model, args.usdCny);

  console.log(`Selected ${selected.length} ${args.provider} live scenario(s).`);
  console.log(`Provider: ${args.provider}`);
  console.log(`Model: ${args.model}`);
  console.log(`Budget: ${args.budgetCny.toFixed(2)} CNY`);
  console.log(`Preflight worst-case estimate: ${costEstimate.toFixed(4)} CNY`);

  if (costEstimate > args.budgetCny) {
    throw new Error(`Refusing run: estimate ${costEstimate.toFixed(4)} CNY exceeds budget ${args.budgetCny.toFixed(2)} CNY.`);
  }

  if (args.dryRun) {
    console.log("Dry run only; no API calls made.");
    return;
  }

  const apiKey = readApiKey(args);
  if (!apiKey) throw new Error(`${args.provider} API key missing. Set provider API key env or key-file env.`);

  const results = [];
  let actualCost = 0;
  for (const scenario of selected) {
    let response = null;
    let output = null;
    let content = "";
    let evaluation = { pass: false, checkResults: [] };
    let note = "";
    let costCny = 0;
    try {
      const messages = buildMessages(harness, scenario);
      response = await callModel({ apiKey, args, messages });
      content = modelContent(response);
      output = parseModelJson(content);
      evaluation = evaluate(output, scenario);
      note = evaluation.pass ? "all checks passed" : "one or more checks failed";
    } catch (exception) {
      output = { error: exception.message, raw: content.slice(0, 500) };
      note = exception.message;
    } finally {
      costCny = usageCostCny(response?.usage, args.model, args.usdCny);
      actualCost += costCny;
    }
    if (actualCost > args.budgetCny) {
      throw new Error(`Stopping run: actual usage estimate ${actualCost.toFixed(4)} CNY exceeds budget.`);
    }
    results.push({
      id: scenario.id,
      expected: scenario.expect.description,
      pass: evaluation.pass,
      checkResults: evaluation.checkResults,
      output,
      usage: response?.usage || null,
      costCny,
      note,
    });
    console.log(`${scenario.id}: ${evaluation.pass ? "PASS" : "FAIL"} (${costCny.toFixed(4)} CNY)`);
  }

  writeReport({ args, selected, estimate: costEstimate, results, actualCost });
  console.log(`Wrote ${path.relative(rootDir, reportPathFor(args))}`);

  if (results.some((result) => !result.pass)) {
    process.exitCode = 1;
  }
}

main().catch((exception) => {
  console.error(exception.message);
  process.exit(1);
});
