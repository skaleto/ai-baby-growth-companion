export type AttachmentKind = "image" | "video" | "audio";

export interface Attachment {
  id: string;
  name: string;
  kind: AttachmentKind;
  url?: string;
  dataUrl?: string;
  mimeType?: string;
  filePath?: string;
  publicUrl?: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  createdAt?: string;
}

export type AlbumItemCategory = "growth" | "feeding" | "sleep" | "health" | "reminder" | "daily";

export interface AlbumItem {
  id: string;
  kind: "media" | "keyEvent";
  title: string;
  date: string;
  occurredAt?: string;
  category: AlbumItemCategory;
  tags: string[];
  attachmentId?: string;
  attachment?: Attachment;
  linkedType?: "chatMessage" | "careLogEvent" | "growthEvent" | "reminder";
  linkedId?: string;
  source: "agent" | "rule" | "manual";
}

export interface AlbumPrompt {
  id: string;
  attachmentId: string;
  sourceMessageId: string;
  title: string;
  category: AlbumItemCategory;
  reason: string;
  tags: string[];
  status: "pending" | "saved" | "ignored";
  createdAt: string;
}

export type ExpenseCategory =
  | "formula"
  | "diaper"
  | "food"
  | "clothing"
  | "toy"
  | "health"
  | "vaccine"
  | "daily"
  | "education"
  | "other";

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  currency: "CNY" | string;
  category: ExpenseCategory;
  date: string;
  quantity?: number;
  unitPrice?: number;
  merchant?: string;
  note?: string;
  barcode?: string;
  brand?: string;
  spec?: string;
  productImageUrl?: string;
  attachmentIds: string[];
  source: "manual" | "barcode" | "agent" | "web";
  createdAt: string;
  updatedAt: string;
}

export type AgentModelId =
  | "deepseek-v4-pro"
  | "deepseek-v4-flash"
  | "doubao-seed-2.0-pro"
  | "doubao-seed-2.0-lite";

export interface AgentModelOption {
  id: AgentModelId;
  label: string;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
  supportsLowLatency: boolean;
}

export interface BabyProfile {
  nickname: string;
  stage: "pregnancy" | "born";
  expectedDate: string;
  birthDate: string;
  region: string;
  feeding: string;
  allergies: string[];
  caregivers: string[];
}

export interface ChatMessage {
  id: string;
  role: "parent" | "ai";
  text: string;
  createdAt: string;
  attachments?: Attachment[];
  tags?: string[];
  reasoning?: string;
  isStreaming?: boolean;
  toolActivities?: ToolActivity[];
  sources?: AgentSource[];
  safetyAlerts?: SafetyAlert[];
  effectDecisions?: EffectDecision[];
  albumPrompts?: AlbumPrompt[];
}

export interface ToolActivity {
  id: string;
  toolId: string;
  name: string;
  status: "running" | "completed" | "failed";
  message: string;
  query?: string;
}

export interface GrowthEvent {
  id: string;
  type: string;
  title: string;
  date: string;
  summary: string;
  firstTime: boolean;
  mediaKind?: AttachmentKind;
  tags: string[];
}

export type CareLogEventType = "milk" | "sleep" | "wake" | "poop" | "solid" | "temperature" | "soothing" | "note";

export interface CareLogEvent {
  id: string;
  type: CareLogEventType;
  date: string;
  time?: string;
  title?: string;
  amountMl?: number;
  durationHours?: number;
  temperature?: number;
  note?: string;
  tags?: string[];
}

export interface CareLog {
  id: string;
  date: string;
  milkMl?: number;
  milkTimes?: number;
  sleepHours?: number;
  wakes?: number;
  soothing?: "easy" | "normal" | "hard";
  solids: string[];
  poop?: string;
  temperature?: number;
  notes: string[];
  events: CareLogEvent[];
}

export type ReminderKind = "schedule" | "alarm";

export type ReminderSoundId = "soft_chime" | "soft_bell";

export type ReminderScheduleMode = "once" | "interval";

export type ReminderAlertMode = "notification" | "ringing";

export interface ReminderRepeatRule {
  mode: "fixedInterval";
  intervalMinutes: number;
  anchorType: "now" | "careEvent";
  careEventType?: "milk" | string;
}

export interface Reminder {
  id: string;
  title: string;
  reminderKind?: ReminderKind;
  scheduleMode?: ReminderScheduleMode;
  alertMode?: ReminderAlertMode;
  dueText: string;
  dueAt?: string;
  timeSourceText?: string;
  timezone?: string;
  notificationId?: number;
  notificationStatus?: "pending" | "scheduled" | "scheduled_inexact" | "permission_denied" | "failed" | "in_app_only" | "cancelled";
  notificationError?: string;
  category: "vaccine" | "routine" | "care" | "custom";
  recurrence?: string;
  repeatRule?: ReminderRepeatRule;
  soundId?: ReminderSoundId;
  lastAnchorEventId?: string;
  lastAnchorAt?: string;
  status: "open" | "done" | "missed";
  createdAt: string;
  history: string[];
}

export interface MemoryItem {
  id: string;
  text: string;
  category: "routine" | "preference" | "health" | "caregiver" | "concern";
  confidence: number;
  updatedAt: string;
}

export interface ConversationSummary {
  id?: string;
  text: string;
  coveredThroughMessageId?: string;
  coveredThroughCreatedAt?: string;
  sourceMessageCount: number;
  updatedAt: string;
}

export interface SafetyAlert {
  level: "notice" | "urgent";
  category: "fever" | "vaccine" | "medicine" | "allergy" | "injury" | "breathing" | "general";
  message: string;
  recommendedAction: string;
}

export interface PendingEffect {
  id: string;
  messageId: string;
  createdAt: string;
  status: "pending";
  tags: string[];
  growthEvent?: GrowthEvent;
  careLogPatch?: Partial<CareLog>;
  reminders: Reminder[];
  memories: MemoryItem[];
  expenses?: ExpenseItem[];
  safetyAlerts: SafetyAlert[];
}

export interface AppStateSnapshot {
  profile: BabyProfile;
  messages: ChatMessage[];
  growthEvents: GrowthEvent[];
  careLogs: CareLog[];
  reminders: Reminder[];
  memories: MemoryItem[];
  pendingEffects: PendingEffect[];
  albumItems: AlbumItem[];
  expenses: ExpenseItem[];
  conversationSummary?: ConversationSummary | null;
  thinkingEnabled?: boolean;
  selectedModel?: AgentModelId;
}

export interface AnalysisResult {
  aiText: string;
  tags: string[];
  growthEvent?: GrowthEvent;
  careLogPatch?: Partial<CareLog>;
  reminders: Reminder[];
  memories: MemoryItem[];
}

export interface AgentBabyProfileContext extends BabyProfile {
  ageDays?: number;
  ageWeeks?: number;
  ageMonths?: number;
  ageLabel?: string;
  fullMonth?: boolean;
  daysUntilFullMonth?: number;
}

export interface AgentChatRequest {
  message: string;
  model: AgentModelId;
  babyProfile: AgentBabyProfileContext;
  recentMessages: ChatMessage[];
  careLogs: CareLog[];
  memories: MemoryItem[];
  attachments: Attachment[];
  pageContext?: AgentPageContext;
  thinkingEnabled: boolean;
  lowLatencyEnabled?: boolean;
}

export interface AgentPageContext {
  activeTab: string;
  selectedDate: string;
  selectedCareLog?: CareLog;
  selectedEvents: Array<{
    id: string;
    date: string;
    timeLabel: string;
    type: string;
    kind: string;
    title: string;
    body: string;
    tags: string[];
  }>;
  todayCareLog?: CareLog;
  recentCareLogs: CareLog[];
  openReminders: Reminder[];
  pendingEffectSummaries: Array<{
    id: string;
    createdAt: string;
    tags: string[];
    summary: string[];
  }>;
  recentExpenses?: ExpenseItem[];
}

export interface AgentChatResponse {
  aiText: string;
  tags?: string[] | null;
  growthEvent?: Partial<GrowthEvent> | null;
  careLogPatch?: Partial<CareLog> | null;
  reminders?: Array<Partial<Reminder>> | null;
  memories?: Array<Partial<MemoryItem>> | null;
  sources?: AgentSource[] | null;
  safetyAlerts?: SafetyAlert[] | null;
  effectDecisions?: EffectDecision[] | null;
  usedSkills?: string[] | null;
  traceId?: string | null;
  model?: string | null;
  requestId?: string | null;
}

export interface EffectDecision {
  id: string;
  mode: "auto" | "pending" | "ask" | "ignore";
  type: "careLog" | "reminder" | "growthEvent" | "memory" | "albumItem" | "expenseItem";
  payload?: unknown;
  confidence?: number;
  reason?: string;
  source?: "model" | "rule" | "model+rule";
}

export interface AgentSource {
  title: string;
  url: string;
  snippet?: string | null;
}
