export type AttachmentKind = "image" | "video" | "audio";

export interface Attachment {
  id: string;
  name: string;
  kind: AttachmentKind;
  url?: string;
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
}

export interface Reminder {
  id: string;
  title: string;
  dueText: string;
  category: "vaccine" | "routine" | "care" | "custom";
  recurrence?: string;
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

export interface AnalysisResult {
  aiText: string;
  tags: string[];
  growthEvent?: GrowthEvent;
  careLogPatch?: Partial<CareLog>;
  reminders: Reminder[];
  memories: MemoryItem[];
}

export interface AgentChatRequest {
  message: string;
  babyProfile: BabyProfile;
  recentMessages: ChatMessage[];
  careLogs: CareLog[];
  memories: MemoryItem[];
  attachments: Attachment[];
}

export interface AgentChatResponse {
  aiText: string;
  tags?: string[] | null;
  growthEvent?: Partial<GrowthEvent> | null;
  careLogPatch?: Partial<CareLog> | null;
  reminders?: Array<Partial<Reminder>> | null;
  memories?: Array<Partial<MemoryItem>> | null;
  usedSkills?: string[] | null;
  traceId?: string | null;
  model?: string | null;
  requestId?: string | null;
}
