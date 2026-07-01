// 聊天/Agent 一族被「hook 内」与「仍留在 App 的渲染/页面上下文」双方共用的纯判定函数。
//
// 背景:抽 useChatState(架构债 D1)时,submitComposerMessage / normalizeAgentResponse 一族搬进
// hook,但其中两个纯判定函数同时被 App 仍保留的代码引用——
//  - isAgentProgressActivity:hook 里的 submitComposerMessage 用,又作为 prop 传给 <ChatScreen/>(App 渲染);
//  - hasCareLogContent:hook 里的 normalizeAgentResponse 用,又被 App 仍保留的 pendingEffectSummary 用。
// 为避免「hook 反向 import App」成环、也不破坏 chat 外的使用点,把这两个纯函数下沉到本共享 util,
// App.tsx 与 features/chat/useChatState.ts 各自从这里 import。纯函数、无副作用、不依赖任何组件状态。
import type { CareLog, ToolActivity } from "../types";

// Agent 流式进度活动(toolId === "agent-progress")。提交流里用于决定标签文案,
// 渲染端(ChatScreen)用于区分「处理中 / 查询中」的工具气泡。
export const isAgentProgressActivity = (activity: ToolActivity) => activity.toolId === "agent-progress";

// careLogPatch / pendingEffect.careLogPatch 是否含有实质照护内容(任一字段非空)。
export const hasCareLogContent = (patch: Partial<CareLog>) =>
  Boolean(
    patch.milkMl ||
      patch.milkTimes ||
      patch.sleepHours ||
      patch.wakes ||
      patch.soothing ||
      patch.solids?.length ||
      patch.poop ||
      patch.temperature ||
      patch.events?.length ||
      patch.notes?.length,
  );
