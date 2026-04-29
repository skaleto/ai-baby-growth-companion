import {
  Baby,
  Bell,
  Brain,
  CalendarDays,
  Camera as CameraIcon,
  CheckCircle2,
  CircleHelp,
  Clock3,
  HeartPulse,
  Image as ImageIcon,
  LineChart,
  Mic,
  Milk,
  Moon,
  Music2,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Syringe,
  Users,
  Utensils,
  Video,
  X,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Camera as NativeCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { analyzeInput } from "./aiEngine";
import {
  initialCareLogs,
  initialGrowthEvents,
  initialMemories,
  initialMessages,
  initialProfile,
  initialReminders,
  makeId,
  todayISO,
} from "./data";
import { useStoredState } from "./storage";
import { Attachment, CareLog, ChatMessage, Reminder } from "./types";

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value));

const ageLabel = (birthDate: string) => {
  const start = new Date(birthDate);
  const end = new Date();
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const months = Math.floor(days / 30);
  return months > 0 ? `${months}个月${days % 30}天` : `${days}天`;
};

const mergeCareLog = (logs: CareLog[], patch: Partial<CareLog>) => {
  const date = patch.date ?? todayISO();
  const existing = logs.find((item) => item.date === date);
  if (!existing) {
    return [
      ...logs,
      {
        id: patch.id ?? makeId("care"),
        date,
        milkMl: patch.milkMl,
        milkTimes: patch.milkTimes,
        sleepHours: patch.sleepHours,
        wakes: patch.wakes,
        soothing: patch.soothing,
        solids: patch.solids ?? [],
        poop: patch.poop,
        temperature: patch.temperature,
        notes: patch.notes ?? [],
      },
    ];
  }

  return logs.map((item) =>
    item.date === date
      ? {
          ...item,
          milkMl: patch.milkMl ?? item.milkMl,
          milkTimes: patch.milkTimes ?? item.milkTimes,
          sleepHours: patch.sleepHours ?? item.sleepHours,
          wakes: patch.wakes ?? item.wakes,
          soothing: patch.soothing ?? item.soothing,
          solids: [...new Set([...(item.solids ?? []), ...(patch.solids ?? [])])],
          poop: patch.poop ?? item.poop,
          temperature: patch.temperature ?? item.temperature,
          notes: [...item.notes, ...(patch.notes ?? [])].slice(-6),
        }
      : item,
  );
};

const soothingText = {
  easy: "好哄睡",
  normal: "正常",
  hard: "偏难",
};

const platformLabel = () => {
  if (!Capacitor.isNativePlatform()) return "浏览器预览";
  return Capacitor.getPlatform() === "ios" ? "iOS App" : "Android App";
};

const nextReminderDate = (dueText: string) => {
  const now = new Date();
  const next = new Date(now.getTime() + 60 * 60 * 1000);
  const monthDay = dueText.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  const time = dueText.match(/(\d{1,2})\s*(?:点|:|：)\s*(\d{1,2})?/);

  if (monthDay) {
    next.setMonth(Number(monthDay[1]) - 1, Number(monthDay[2]));
  } else if (/后天/.test(dueText)) {
    next.setDate(now.getDate() + 2);
  } else if (/明天|下周|周[一二三四五六日天]/.test(dueText)) {
    next.setDate(now.getDate() + 1);
  }

  if (time) {
    next.setHours(Number(time[1]), Number(time[2] ?? 0), 0, 0);
  } else {
    next.setHours(9, 0, 0, 0);
  }

  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
};

const scheduleNativeReminders = async (newReminders: Reminder[]) => {
  if (!Capacitor.isNativePlatform() || newReminders.length === 0) return;

  try {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") return;

    await LocalNotifications.schedule({
      notifications: newReminders.map((reminder, index) => ({
        id: Math.floor(Date.now() % 2_000_000_000) + index,
        title: reminder.title,
        body: `${reminder.dueText} · 打开小宝成长伙伴确认是否完成`,
        schedule: { at: nextReminderDate(reminder.dueText) },
      })),
    });
  } catch {
    // Native notification permission can be declined; the in-app reminder still remains.
  }
};

function App() {
  const [profile] = useStoredState("baby-companion-profile", initialProfile);
  const [messages, setMessages] = useStoredState("baby-companion-messages", initialMessages);
  const [growthEvents, setGrowthEvents] = useStoredState("baby-companion-growth", initialGrowthEvents);
  const [careLogs, setCareLogs] = useStoredState("baby-companion-care", initialCareLogs);
  const [reminders, setReminders] = useStoredState("baby-companion-reminders", initialReminders);
  const [memories, setMemories] = useStoredState("baby-companion-memories", initialMemories);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appPlatform = platformLabel();

  const todayLog = careLogs.find((item) => item.date === todayISO()) ?? careLogs[careLogs.length - 1];
  const latestGrowth = growthEvents[growthEvents.length - 1];
  const openReminders = reminders.filter((item) => item.status === "open");
  const milkTrend = useMemo(() => {
    const recent = careLogs.slice(-3).map((item) => item.milkMl ?? 0).filter(Boolean);
    if (recent.length < 2) return "继续收集中";
    const delta = recent[recent.length - 1] - recent[0];
    return delta >= 0 ? `近3次 +${delta} ml` : `近3次 ${delta} ml`;
  }, [careLogs]);

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const next = files.map((file) => {
      const kind = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image";
      return {
        id: makeId("attachment"),
        name: file.name,
        kind,
        url: kind === "image" || kind === "video" ? URL.createObjectURL(file) : undefined,
      } satisfies Attachment;
    });
    setAttachments((current) => [...current, ...next].slice(0, 4));
    event.target.value = "";
  };

  const openMediaPicker = async () => {
    if (!Capacitor.isNativePlatform()) {
      fileInputRef.current?.click();
      return;
    }

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      const photo = await NativeCamera.getPhoto({
        quality: 82,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        promptLabelHeader: "添加成长素材",
        promptLabelPhoto: "从相册选择",
        promptLabelPicture: "拍照",
        promptLabelCancel: "取消",
      });

      if (!photo.dataUrl) return;

      const nativeAttachment: Attachment = {
        id: makeId("attachment"),
        name: `成长照片-${new Date().toLocaleTimeString("zh-CN", { hour12: false })}.jpeg`,
        kind: "image",
        url: photo.dataUrl,
      };
      setAttachments((current) => [...current, nativeAttachment].slice(0, 4));
    } catch {
      // Users can cancel the native picker; no UI recovery is needed.
    }
  };

  const startVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setInput((value) => `${value}${value ? " " : ""}今天小宝第一次自己扶着沙发站起来了`);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setInput((value) => `${value}${value ? " " : ""}${transcript}`);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text && attachments.length === 0) return;

    const parentMessage: ChatMessage = {
      id: makeId("msg"),
      role: "parent",
      text: text || "上传了新的成长素材",
      createdAt: new Date().toISOString(),
      attachments,
    };
    const result = analyzeInput(parentMessage.text, attachments, profile, careLogs, memories);
    const aiMessage: ChatMessage = {
      id: makeId("msg"),
      role: "ai",
      text: result.aiText,
      createdAt: new Date().toISOString(),
      tags: result.tags,
    };

    setMessages((current) => [...current, parentMessage, aiMessage].slice(-32));
    if (result.growthEvent) setGrowthEvents((current) => [...current, result.growthEvent!]);
    if (result.careLogPatch) setCareLogs((current) => mergeCareLog(current, result.careLogPatch!));
    if (result.reminders.length) setReminders((current) => [...result.reminders, ...current]);
    if (result.memories.length) setMemories((current) => [...result.memories, ...current].slice(0, 10));
    await scheduleNativeReminders(result.reminders);
    if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Light });
    setInput("");
    setAttachments([]);
  };

  const completeReminder = (target: Reminder) => {
    setReminders((current) =>
      current.map((item) =>
        item.id === target.id
          ? {
              ...item,
              status: "done",
              history: [`${new Intl.DateTimeFormat("zh-CN").format(new Date())} 已完成`, ...item.history],
            }
          : item,
      ),
    );
  };

  const quickFill = (text: string) => {
    setInput(text);
  };

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="今日概览">
        <div className="brand-block">
          <div className="brand-mark">
            <Baby size={24} />
          </div>
          <div>
            <p className="eyebrow">AI宝宝成长伙伴</p>
            <h1>{profile.nickname}</h1>
          </div>
        </div>
        <div className="topbar-metrics">
          <div className="metric">
            <CalendarDays size={18} />
            <span>{ageLabel(profile.birthDate)}</span>
          </div>
          <div className="metric">
            <Users size={18} />
            <span>{profile.caregivers.join(" / ")}</span>
          </div>
          <div className="metric status">
            <Sparkles size={18} />
            <span>今日已整理 {messages.filter((item) => item.role === "parent").length} 条</span>
          </div>
          <div className="metric">
            <Smartphone size={18} />
            <span>{appPlatform}</span>
          </div>
        </div>
      </section>

      <div className="workspace">
        <aside className="left-rail">
          <section className="profile-panel">
            <div className="baby-photo">
              <div className="photo-sky" />
              <div className="photo-baby">
                <Baby size={54} />
              </div>
            </div>
            <div className="profile-copy">
              <h2>{profile.nickname}</h2>
              <p>{profile.region} · {profile.feeding}</p>
            </div>
            <div className="profile-grid">
              <div>
                <span>出生</span>
                <strong>{formatDate(profile.birthDate)}</strong>
              </div>
              <div>
                <span>预产</span>
                <strong>{formatDate(profile.expectedDate)}</strong>
              </div>
              <div>
                <span>过敏</span>
                <strong>{profile.allergies.join("、")}</strong>
              </div>
              <div>
                <span>提醒</span>
                <strong>{openReminders.length} 个</strong>
              </div>
            </div>
          </section>

          <section className="memory-panel">
            <div className="section-title">
              <Brain size={18} />
              <h2>AI记忆</h2>
            </div>
            <div className="memory-list">
              {memories.slice(0, 4).map((memory) => (
                <article className="memory-item" key={memory.id}>
                  <p>{memory.text}</p>
                  <span>{Math.round(memory.confidence * 100)}%</span>
                </article>
              ))}
            </div>
          </section>
        </aside>

        <section className="chat-panel" aria-label="每日聊天记录">
          <div className="chat-head">
            <div>
              <p className="eyebrow">5分钟记录</p>
              <h2>今天和小宝发生了什么</h2>
            </div>
            <div className="head-actions">
              <button type="button" className="icon-button" title="照片" onClick={openMediaPicker}>
                <CameraIcon size={18} />
              </button>
              <button type="button" className={`icon-button ${isListening ? "active" : ""}`} title="语音" onClick={startVoice}>
                <Mic size={18} />
              </button>
            </div>
          </div>

          <div className="quick-row">
            <button type="button" onClick={() => quickFill("今天喝奶 5 次，每次大概 120ml，晚上醒了 3 次")}>
              <Milk size={16} />
              喂奶
            </button>
            <button type="button" onClick={() => quickFill("晚上 8 点提醒我给小宝洗澡")}>
              <Bell size={16} />
              提醒
            </button>
            <button type="button" onClick={() => quickFill("今天小宝第一次自己扶着沙发站起来了")}>
              <Sparkles size={16} />
              里程碑
            </button>
            <button type="button" onClick={() => quickFill("为什么这两天小宝更难哄睡？")}>
              <CircleHelp size={16} />
              问问AI
            </button>
          </div>

          <div className="message-list">
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="message-meta">
                  <span>{message.role === "ai" ? "AI" : profile.nickname + "家"}</span>
                  <time>{formatTime(message.createdAt)}</time>
                </div>
                <p>{message.text}</p>
                {message.attachments?.length ? (
                  <div className="attachment-strip">
                    {message.attachments.map((item) => (
                      <div className="attachment-thumb" key={item.id}>
                        {item.kind === "image" && item.url ? <img src={item.url} alt={item.name} /> : null}
                        {item.kind === "video" && item.url ? <video src={item.url} muted /> : null}
                        {!item.url ? <ImageIcon size={18} /> : null}
                        <span>{item.kind === "video" ? "视频" : item.kind === "audio" ? "语音" : "照片"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {message.tags?.length ? (
                  <div className="tag-row">
                    {message.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            {attachments.length ? (
              <div className="pending-attachments">
                {attachments.map((item) => (
                  <div className="pending-item" key={item.id}>
                    {item.kind === "image" && item.url ? <img src={item.url} alt={item.name} /> : <Video size={18} />}
                    <span>{item.name}</span>
                    <button
                      type="button"
                      title="移除"
                      onClick={() => setAttachments((current) => current.filter((attachment) => attachment.id !== item.id))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="composer-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                multiple
                hidden
                onChange={handleFiles}
              />
              <button type="button" className="tool-button" title="上传照片或视频" onClick={openMediaPicker}>
                <CameraIcon size={19} />
              </button>
              <button type="button" className={`tool-button ${isListening ? "active" : ""}`} title="语音输入" onClick={startVoice}>
                <Mic size={19} />
              </button>
              <textarea
                value={input}
                rows={1}
                onChange={(event) => setInput(event.target.value)}
                placeholder="今天小宝第一次翻身了，喝奶 5 次，每次 120ml"
              />
              <button className="send-button" type="submit" title="发送">
                <Send size={19} />
              </button>
            </div>
          </form>
        </section>

        <aside className="right-rail">
          <section className="insight-panel">
            <div className="section-title">
              <LineChart size={18} />
              <h2>今日照护</h2>
            </div>
            <div className="care-grid">
              <div className="care-tile milk">
                <Milk size={19} />
                <span>奶量</span>
                <strong>{todayLog?.milkMl ? `${todayLog.milkMl} ml` : "待记录"}</strong>
                <small>{milkTrend}</small>
              </div>
              <div className="care-tile sleep">
                <Moon size={19} />
                <span>睡眠</span>
                <strong>{todayLog?.sleepHours ? `${todayLog.sleepHours} h` : "待记录"}</strong>
                <small>{todayLog?.wakes ? `夜醒 ${todayLog.wakes} 次` : "夜醒待记录"}</small>
              </div>
              <div className="care-tile soothe">
                <HeartPulse size={19} />
                <span>哄睡</span>
                <strong>{todayLog?.soothing ? soothingText[todayLog.soothing] : "待观察"}</strong>
                <small>{todayLog?.temperature ? `体温 ${todayLog.temperature}` : "无异常标记"}</small>
              </div>
              <div className="care-tile food">
                <Utensils size={19} />
                <span>辅食</span>
                <strong>{todayLog?.solids?.[0] ?? "未添加"}</strong>
                <small>{profile.allergies.join("、")}</small>
              </div>
            </div>
          </section>

          <section className="timeline-panel">
            <div className="section-title">
              <Sparkles size={18} />
              <h2>成长时间线</h2>
            </div>
            <div className="timeline">
              {[...growthEvents].reverse().slice(0, 5).map((event) => (
                <article className="timeline-item" key={event.id}>
                  <time>{formatDate(event.date)}</time>
                  <div>
                    <h3>{event.title}</h3>
                    <p>{event.summary}</p>
                    <div className="tag-row">
                      {event.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      {event.mediaKind ? <span>{event.mediaKind === "video" ? "视频" : "照片"}</span> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="reminder-panel">
            <div className="section-title">
              <Bell size={18} />
              <h2>提醒追踪</h2>
            </div>
            <div className="reminder-list">
              {openReminders.slice(0, 5).map((reminder) => (
                <article className={`reminder-item ${reminder.category}`} key={reminder.id}>
                  <div className="reminder-icon">
                    {reminder.category === "vaccine" ? <Syringe size={18} /> : <Clock3 size={18} />}
                  </div>
                  <div>
                    <h3>{reminder.title}</h3>
                    <p>{reminder.dueText}</p>
                  </div>
                  <button type="button" title="标记完成" onClick={() => completeReminder(reminder)}>
                    <CheckCircle2 size={18} />
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="assistant-panel">
            <div className="assistant-card">
              <ShieldAlert size={20} />
              <p>健康、疫苗、用药相关内容只做记录和提醒，异常情况以医生和社区医院安排为准。</p>
            </div>
            <div className="assistant-card native-card">
              <Smartphone size={20} />
              <p>已按移动 App 架构准备：手机端使用原生相机/相册和本地通知，浏览器端保留预览能力。</p>
            </div>
            <div className="assistant-actions">
              <button type="button" onClick={() => quickFill("下周二提醒我带小宝去社区医院打疫苗")}>
                <Syringe size={16} />
                疫苗
              </button>
              <button type="button" onClick={() => quickFill("小宝最近喜欢白噪音和轻拍，10 点左右容易闹觉")}>
                <Music2 size={16} />
                哄睡
              </button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default App;
