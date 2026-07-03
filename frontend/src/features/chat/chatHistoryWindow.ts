// 聊天列表窗口化(评审 P8)。长会话下 ChatScreen 原本 `messages.map` 全量渲染每条消息的重型子树
// (工具活动 / 安全提示 / 来源 / 附件 / 待生效草稿卡),几百条时首屏与每次流式增量都要重排整棵树。
// 这里做保守窗口化:默认只渲染最近 WINDOW 条,更早的折叠成一个「查看更早」入口,一次性展开全部。
// 纯函数、无 React 依赖:可被 esbuild 逻辑测试打包,窗口边界(WINDOW vs WINDOW+1)单测钉死。
//
// 为什么不引三方虚拟列表:消息子树高度不定、含流式增量与展开态,真·虚拟化(测高/占位)复杂且易抖动;
// 窗口化用极小代价覆盖了绝大多数「历史很长」的性能场景(KISS),需要时再演进为分页/虚拟列表。

export const CHAT_HISTORY_WINDOW = 80;

export type ChatHistoryWindow<T> = {
  /** 实际参与渲染的消息:展开时为全部,否则为最近 WINDOW 条(始终含最新一条,保证流式增量/自动滚动到底不受影响)。 */
  visible: T[];
  /** 被折叠的更早消息数;>0 时列表顶部显示「查看更早的 N 条」入口。 */
  hiddenEarlierCount: number;
};

export const chatHistoryWindow = <T>(
  messages: T[],
  expanded: boolean,
  windowSize: number = CHAT_HISTORY_WINDOW,
): ChatHistoryWindow<T> => {
  const hiddenEarlierCount = expanded ? 0 : Math.max(0, messages.length - windowSize);
  const visible = hiddenEarlierCount > 0 ? messages.slice(-windowSize) : messages;
  return { visible, hiddenEarlierCount };
};
