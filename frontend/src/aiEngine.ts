import {
  AnalysisResult,
  Attachment,
  BabyProfile,
  CareLog,
  GrowthEvent,
  MemoryItem,
  Reminder,
} from "./types";
import { makeId, todayISO } from "./data";

const numberFrom = (match: RegExpMatchArray | null, index = 1) =>
  match?.[index] ? Number.parseFloat(match[index]) : undefined;

const pickFirstNumber = (...values: Array<number | undefined>) =>
  values.find((value) => typeof value === "number" && !Number.isNaN(value));

const summarizeAttachments = (attachments: Attachment[]) => {
  const hasImage = attachments.some((item) => item.kind === "image");
  const hasVideo = attachments.some((item) => item.kind === "video");
  if (hasImage && hasVideo) return "照片和视频";
  if (hasImage) return "照片";
  if (hasVideo) return "视频";
  return attachments.length ? "素材" : "";
};

const milestoneCatalog = [
  { type: "first_kick", title: "第一次胎动", pattern: /(第一次|首次).*(胎动)/ },
  { type: "birth", title: "出生", pattern: /(出生|生啦|生了|降生)/ },
  { type: "first_smile", title: "第一次笑", pattern: /(第一次|首次).*(笑|笑出声)/ },
  { type: "first_roll", title: "第一次翻身", pattern: /(第一次|首次).*(翻身)/ },
  { type: "first_sit", title: "第一次坐起来", pattern: /(第一次|首次).*(坐|坐起来|独坐)/ },
  { type: "first_crawl", title: "第一次爬", pattern: /(第一次|首次).*(爬|爬行)/ },
  { type: "first_stand", title: "第一次站起来", pattern: /(第一次|首次).*(站|站起来|扶站)/ },
  { type: "first_word", title: "第一次说话", pattern: /(第一次|首次).*(说话|叫妈妈|叫爸爸|发音)/ },
];

function detectGrowthEvent(text: string, attachments: Attachment[], profile: BabyProfile): GrowthEvent | undefined {
  const directHit = milestoneCatalog.find((item) => item.pattern.test(text));
  const mediaKind = attachments.find((item) => item.kind === "image" || item.kind === "video")?.kind;
  const hasMilestoneSignal = /第一次|首次|会.*了|学会|站|翻身|说话|坐起来|抬头|胎动|出生/.test(text);

  if (!directHit && !hasMilestoneSignal) return undefined;

  const mediaText = summarizeAttachments(attachments);
  const title = directHit?.title ?? (/抬头/.test(text) ? "抬头更稳" : "新的成长瞬间");
  const summarySource = text.replace(/\s+/g, " ").trim();

  return {
    id: makeId("growth"),
    type: directHit?.type ?? "daily_growth",
    title,
    date: todayISO(),
    summary: `${profile.nickname}${summarySource ? `：${summarySource}` : "有了新的成长记录"}${mediaText ? `，已关联${mediaText}` : ""}。`,
    firstTime: Boolean(directHit || /第一次|首次/.test(text)),
    mediaKind,
    tags: ["成长", directHit ? "里程碑" : "日常"],
  };
}

function detectCareLog(text: string): Partial<CareLog> | undefined {
  const milkTimes = pickFirstNumber(
    numberFrom(text.match(/喝奶\s*(\d+(?:\.\d+)?)\s*次/)),
    numberFrom(text.match(/奶\s*(\d+(?:\.\d+)?)\s*次/)),
  );
  const perMilk = pickFirstNumber(
    numberFrom(text.match(/每次(?:大概|约)?\s*(\d+(?:\.\d+)?)\s*(?:ml|毫升)/i)),
    numberFrom(text.match(/一次(?:大概|约)?\s*(\d+(?:\.\d+)?)\s*(?:ml|毫升)/i)),
  );
  const totalMilk = pickFirstNumber(
    numberFrom(text.match(/(?:总共|一共|总量|奶量)(?:大概|约)?\s*(\d+(?:\.\d+)?)\s*(?:ml|毫升)/i)),
    milkTimes && perMilk ? milkTimes * perMilk : undefined,
  );
  const sleepHours = pickFirstNumber(
    numberFrom(text.match(/睡(?:了|眠)?(?:大概|约)?\s*(\d+(?:\.\d+)?)\s*(?:小时|h)/i)),
    numberFrom(text.match(/小睡(?:大概|约)?\s*(\d+(?:\.\d+)?)\s*(?:小时|h)/i)),
  );
  const wakes = pickFirstNumber(
    numberFrom(text.match(/(?:夜里|晚上|夜间)?醒(?:了)?\s*(\d+(?:\.\d+)?)\s*次/)),
    numberFrom(text.match(/夜醒\s*(\d+(?:\.\d+)?)\s*次/)),
  );
  const temperature = numberFrom(text.match(/体温\s*(\d+(?:\.\d+)?)/));
  const solidsMatch = text.match(/(?:吃了|尝试了|辅食)([^。,.，；;]*(?:米粉|南瓜|苹果|香蕉|蛋黄|胡萝卜|菜泥|肉泥|粥|泥))/);
  const poopMatch = text.match(/(便便|大便|拉了)([^。,.，；;]{0,18})/);
  const soothing = /闹觉|难哄|不好哄|哭了很久/.test(text)
    ? "hard"
    : /好哄|很快睡|自己睡/.test(text)
      ? "easy"
      : undefined;

  const hasCare =
    totalMilk ||
    milkTimes ||
    sleepHours ||
    wakes ||
    temperature ||
    solidsMatch ||
    poopMatch ||
    soothing ||
    /厌奶|吐奶|哭闹|湿疹|咳嗽|发烧|用药/.test(text);

  if (!hasCare) return undefined;

  return {
    id: makeId("care"),
    date: todayISO(),
    milkMl: totalMilk ? Math.round(totalMilk) : undefined,
    milkTimes: milkTimes ? Math.round(milkTimes) : undefined,
    sleepHours,
    wakes: wakes ? Math.round(wakes) : undefined,
    soothing,
    solids: solidsMatch ? [solidsMatch[1].trim()] : [],
    poop: poopMatch ? `${poopMatch[1]}${poopMatch[2]}`.trim() : undefined,
    temperature,
    notes: [text.trim()].filter(Boolean),
  };
}

function detectReminders(text: string): Reminder[] {
  if (!/提醒|记得|疫苗|接种|打针|每天|下周|明天|后天/.test(text)) return [];
  if (!/提醒|疫苗|接种|打针|洗澡|吃药|复查|产检|儿保/.test(text)) return [];

  const dueText =
    text.match(/每天?(?:晚上|早上|上午|下午|中午)?\s*\d{1,2}\s*[点:：](?:\s*\d{1,2})?/)?.[0] ??
    text.match(/(?:明天|后天|下周[一二三四五六日天]|周[一二三四五六日天])(?:上午|下午|晚上|早上)?/)?.[0] ??
    text.match(/\d{1,2}\s*月\s*\d{1,2}\s*日(?:上午|下午|晚上|早上)?/)?.[0] ??
    "待确认时间";
  const category = /疫苗|接种|打针/.test(text)
    ? "vaccine"
    : /洗澡|睡觉|喝奶|辅食|吃药/.test(text)
      ? "routine"
      : "custom";
  const cleaned = text
    .replace(/请|帮我|提醒我|记得|小宝|宝宝|每天|明天|后天|下周[一二三四五六日天]|周[一二三四五六日天]/g, "")
    .replace(/\d{1,2}\s*[点:：](?:\s*\d{1,2})?/g, "")
    .replace(/[，。,.]/g, "")
    .trim();

  return [
    {
      id: makeId("reminder"),
      title: cleaned || (category === "vaccine" ? "疫苗接种提醒" : "新的照护提醒"),
      dueText,
      category,
      recurrence: /每天/.test(text) ? "daily" : undefined,
      status: "open",
      createdAt: new Date().toISOString(),
      history: category === "vaccine" ? ["请以社区医院或医生安排为准"] : [],
    },
  ];
}

function detectMemories(text: string): MemoryItem[] {
  const memories: MemoryItem[] = [];
  const now = new Date().toISOString();

  if (/最近|容易|习惯|喜欢|不喜欢|偏好|固定|每天|通常|过敏/.test(text)) {
    const category: MemoryItem["category"] = /过敏|湿疹|发烧|咳嗽|用药/.test(text)
      ? "health"
      : /喜欢|不喜欢|偏好/.test(text)
        ? "preference"
        : /爸爸|妈妈|奶奶|爷爷|外婆|外公/.test(text)
          ? "caregiver"
          : /担心|焦虑|害怕/.test(text)
            ? "concern"
            : "routine";
    memories.push({
      id: makeId("memory"),
      text: text.trim(),
      category,
      confidence: 0.74,
      updatedAt: now,
    });
  }

  return memories;
}

function buildAdvice(text: string, careLogs: CareLog[], memories: MemoryItem[], profile: BabyProfile) {
  if (!/为什么|怎么办|建议|闹觉|厌奶|哭闹|不好睡|难哄/.test(text)) return "";

  const recent = careLogs.slice(-3);
  const hardSoothingCount = recent.filter((item) => item.soothing === "hard").length;
  const avgWakes =
    recent.length > 0
      ? recent.reduce((sum, item) => sum + (item.wakes ?? 0), 0) / recent.length
      : 0;
  const routineMemory = memories.find((item) => item.category === "routine")?.text;
  const signals = [
    hardSoothingCount >= 2 ? "最近几天哄睡偏难" : "",
    avgWakes >= 2 ? `近几次夜醒平均约 ${avgWakes.toFixed(1)} 次` : "",
    routineMemory ? `我记得：${routineMemory}` : "",
  ].filter(Boolean);

  const context = signals.length ? `结合记录，${signals.join("，")}。` : "我还需要继续积累几天记录。";
  return `${context}今晚可以先检查是否过度疲劳、白天小睡是否太晚、睡前刺激是否偏多，再用稳定的洗澡、喂奶、暗光、白噪音顺序收尾。若伴随发热、持续尖叫、吃奶明显减少或精神差，请优先联系医生。`;
}

export function analyzeInput(
  text: string,
  attachments: Attachment[],
  profile: BabyProfile,
  careLogs: CareLog[],
  memories: MemoryItem[],
): AnalysisResult {
  const normalized = text.trim();
  const growthEvent = detectGrowthEvent(normalized, attachments, profile);
  const careLogPatch = detectCareLog(normalized);
  const reminders = detectReminders(normalized);
  const newMemories = detectMemories(normalized);
  const advice = buildAdvice(normalized, careLogs, memories, profile);
  const attachmentText = summarizeAttachments(attachments);

  const tags = [
    growthEvent ? "成长" : "",
    growthEvent?.firstTime ? "第一次" : "",
    careLogPatch?.milkMl || careLogPatch?.milkTimes ? "喂养" : "",
    careLogPatch?.sleepHours || careLogPatch?.wakes || careLogPatch?.soothing ? "睡眠" : "",
    reminders.length ? "提醒" : "",
    newMemories.length ? "记忆" : "",
    advice ? "建议" : "",
    attachmentText || "",
  ].filter(Boolean);

  const lines: string[] = [];
  if (growthEvent) {
    lines.push(
      growthEvent.firstTime
        ? `我记录下了「${growthEvent.title}」，这会出现在成长时间线里。`
        : `我把这个成长瞬间放进今天的记录了。`,
    );
  }
  if (careLogPatch) {
    const careBits = [
      careLogPatch.milkMl ? `奶量约 ${careLogPatch.milkMl} ml` : "",
      careLogPatch.milkTimes ? `喝奶 ${careLogPatch.milkTimes} 次` : "",
      careLogPatch.sleepHours ? `睡眠 ${careLogPatch.sleepHours} 小时` : "",
      careLogPatch.wakes ? `夜醒 ${careLogPatch.wakes} 次` : "",
      careLogPatch.soothing === "hard" ? "哄睡偏难" : "",
    ].filter(Boolean);
    lines.push(`照护日志已更新${careBits.length ? `：${careBits.join("，")}` : ""}。`);
  }
  if (reminders.length) {
    lines.push(`提醒已创建：${reminders.map((item) => `${item.dueText} ${item.title}`).join("；")}。`);
  }
  if (newMemories.length) {
    lines.push("这条信息我会作为长期记忆，后面给建议时一起参考。");
  }
  if (advice) lines.push(advice);
  if (!lines.length) {
    lines.push(
      attachmentText
        ? `我已经把这次${attachmentText}和描述放进今天的成长日记。`
        : "我已经把这句话整理进今天的成长日记。",
    );
  }
  if (growthEvent?.firstTime) {
    lines.push("如果这确实是第一次发生，我会把它保留为重要里程碑。");
  }

  return {
    aiText: lines.join("\n"),
    tags,
    growthEvent,
    careLogPatch,
    reminders,
    memories: newMemories,
  };
}
