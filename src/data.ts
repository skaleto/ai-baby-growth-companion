import { BabyProfile, CareLog, ChatMessage, GrowthEvent, MemoryItem, Reminder } from "./types";

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const initialProfile: BabyProfile = {
  nickname: "小宝",
  stage: "born",
  expectedDate: "2026-01-26",
  birthDate: "2026-01-18",
  region: "上海",
  feeding: "混合喂养",
  allergies: ["暂未发现"],
  caregivers: ["妈妈", "爸爸"],
};

export const initialMessages: ChatMessage[] = [
  {
    id: "msg-seed-1",
    role: "ai",
    text: "早上好，我已经整理好小宝最近的作息。今天可以继续从照片、语音或一句话开始记录。",
    createdAt: new Date().toISOString(),
    tags: ["今日记录"],
  },
  {
    id: "msg-seed-2",
    role: "parent",
    text: "昨晚 10 点有点闹觉，抱睡 20 分钟后睡着，夜里醒了 2 次。",
    createdAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    tags: ["睡眠", "闹觉"],
  },
  {
    id: "msg-seed-3",
    role: "ai",
    text: "已记录夜醒 2 次和哄睡偏难。我会把 22:00 易闹觉作为近期记忆，后面看趋势再提醒你调整白天小睡。",
    createdAt: new Date(Date.now() - 1000 * 60 * 27).toISOString(),
    tags: ["记忆", "睡眠"],
  },
];

export const initialGrowthEvents: GrowthEvent[] = [
  {
    id: "growth-seed-1",
    type: "first_smile",
    title: "第一次笑出声",
    date: "2026-03-12",
    summary: "换尿布时被妈妈逗笑，连续笑了好几声。",
    firstTime: true,
    mediaKind: "image",
    tags: ["里程碑", "情绪"],
  },
  {
    id: "growth-seed-2",
    type: "tummy_time",
    title: "趴练抬头更稳",
    date: "2026-04-18",
    summary: "趴练 6 分钟，能稳定抬头看玩具。",
    firstTime: false,
    tags: ["运动", "训练"],
  },
];

export const initialCareLogs: CareLog[] = [
  {
    id: "care-seed-1",
    date: "2026-04-27",
    milkMl: 610,
    milkTimes: 6,
    sleepHours: 13.5,
    wakes: 2,
    soothing: "normal",
    solids: [],
    notes: ["白天精神不错"],
  },
  {
    id: "care-seed-2",
    date: "2026-04-28",
    milkMl: 580,
    milkTimes: 5,
    sleepHours: 12.8,
    wakes: 3,
    soothing: "hard",
    solids: [],
    notes: ["22:00 左右闹觉"],
  },
];

export const initialReminders: Reminder[] = [
  {
    id: "reminder-seed-1",
    title: "晚间洗澡",
    dueText: "每天 20:00",
    category: "routine",
    recurrence: "daily",
    status: "open",
    createdAt: new Date().toISOString(),
    history: [],
  },
  {
    id: "reminder-seed-2",
    title: "社区医院疫苗咨询",
    dueText: "2026-05-08 上午",
    category: "vaccine",
    status: "open",
    createdAt: new Date().toISOString(),
    history: ["按上海社区安排核对"],
  },
];

export const initialMemories: MemoryItem[] = [
  {
    id: "memory-seed-1",
    text: "小宝最近 22:00 左右容易闹觉，抱睡约 20 分钟能缓下来。",
    category: "routine",
    confidence: 0.82,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "memory-seed-2",
    text: "主要由妈妈记录，爸爸晚上会一起完成洗澡和哄睡。",
    category: "caregiver",
    confidence: 0.76,
    updatedAt: new Date().toISOString(),
  },
];
