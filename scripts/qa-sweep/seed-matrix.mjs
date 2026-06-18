// 4 个验收种子:富/空/只读/配额用尽。appState 喂 /api/app/state,authMe 喂 /api/auth/me。
// expect 是给断言层的期望摘要(此处仅声明,断言逻辑在 assertions.mjs)。
const baseProfile = {
  nickname: "小宝", stage: "born", gender: "girl", expectedDate: "", birthDate: "2026-02-01",
  region: "上海", feeding: "混合喂养", allergies: ["暂未发现"], caregivers: ["妈妈", "爸爸"],
};
const richState = {
  profile: { ...baseProfile },
  messages: [{ id: "m1", role: "ai", text: "今天宝宝状态不错。", createdAt: "2026-06-01T08:00:00.000Z", tags: [] }],
  growthEvents: [{ id: "g1", type: "first_smile", title: "第一次笑出声", date: "2026-05-12", summary: "宝宝第一次笑出声了", firstTime: true, tags: ["里程碑"] }],
  growthMeasurements: [{ id: "gm1", type: "height", value: 66.5, date: "2026-05-12", note: "体检", recordedBy: { label: "妈妈", roleName: "妈妈" } }],
  careLogs: [{ id: "c1", date: "2026-06-01", milkMl: 600, milkTimes: 6, sleepHours: 13, wakes: 2, soothing: "normal", solids: [], notes: [], events: [{ id: "e1", type: "milk", date: "2026-06-01", time: "08:10", title: "喝奶", amountMl: 110, tags: ["喝奶"], recordedBy: { label: "妈妈", roleName: "妈妈" } }], recordedBy: { label: "妈妈", roleName: "妈妈" } }],
  reminders: [{ id: "r1", title: "晚间洗澡", dueText: "每天 20:00", category: "routine", recurrence: "daily", status: "open", createdAt: "2026-06-01T00:00:00.000Z", history: [] }],
  memories: [], pendingEffects: [],
  albumItems: [{ id: "a1", kind: "media", title: "宝宝的成长视频", date: "2026-06-01", occurredAt: "2026-06-01T08:20:00.000Z", category: "growth", tags: [], attachmentId: "att1", attachment: { id: "att1", name: "v.mp4", kind: "video", url: "/api/uploads/att1", mimeType: "video/mp4", createdAt: "2026-06-01T08:20:00.000Z" }, source: "manual", recordedBy: { label: "爸爸", roleName: "爸爸" } }],
  expenses: [{ id: "x1", title: "奶粉", amount: 268, currency: "CNY", category: "formula", date: "2026-06-01", attachmentIds: [], attachments: [], source: "manual", createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z", recordedBy: { label: "妈妈", roleName: "妈妈" } }],
  conversationSummary: null, thinkingEnabled: false, selectedModel: "auto",
  proTrial: { enabled: false, entitlement: { enabled: false }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: 8 },
};
const emptyState = {
  ...richState,
  messages: [], growthEvents: [], growthMeasurements: [], careLogs: [], reminders: [], albumItems: [], expenses: [],
};
const caregiverMe = { roleName: "妈妈", caregiver: true };
const viewerMe = { roleName: "家人", caregiver: false };
const authMe = (member) => ({
  user: { id: "u1", phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" },
  family: { id: "f1", name: "小宝家" }, member, authenticated: true, onboardingRequired: false,
});

export const SEEDS = [
  { label: "caregiver-rich", appState: clone(richState), authMe: authMe(caregiverMe), expect: { dataVisible: true, canWrite: true } },
  { label: "caregiver-empty", appState: clone(emptyState), authMe: authMe(caregiverMe), expect: { emptyStates: true, canWrite: true } },
  { label: "viewer-readonly", appState: clone(richState), authMe: authMe(viewerMe), expect: { canWrite: false, chatHidden: true } },
  { label: "free-quota-exhausted", appState: { ...clone(richState), proTrial: { enabled: false, entitlement: { enabled: false }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: 0 } }, authMe: authMe(caregiverMe), expect: { quotaExhausted: true } },
];

function clone(x) { return JSON.parse(JSON.stringify(x)); }
