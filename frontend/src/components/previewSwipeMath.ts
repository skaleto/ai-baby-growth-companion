// 大图预览左右滑动的手势数学(纯函数,可单测)。
// 从 App.tsx 抽出:接管基准判定 / 拖动位移合成 / 松手结果判定。
// 模拟手势回归测试见 scripts/test-preview-swipe-math.mjs。

/**
 * 按下时的拖动基准(iOS「随时抓住正在动的画面」)。
 * residual = 画面实时渲染偏移(0 = 当前图居中,±viewport = 已完全翻到邻图)。
 * 只有「动画进行中」(残余在屏宽 2%~98% 之间)才接管为基准;
 * 残余≈0(静止)或 ≈±一整屏(翻页已完成、等待 React 复位窗口)都必须返回 0——
 * 后者若被当成基准,会让后续短划看似不动、松手判定整屏漂移(2026-06-10 线上事故)。
 */
export function captureBaseOffset(residualPx: number, viewportWidth: number): number {
  const abs = Math.abs(residualPx);
  if (!Number.isFinite(residualPx) || viewportWidth <= 0) return 0;
  if (abs < Math.max(2, viewportWidth * 0.02)) return 0;
  if (abs > viewportWidth * 0.98) return 0;
  return residualPx;
}

/** 拖动中的合成位移:接管基准 + 手指位移。 */
export function composeSwipeDelta(baseOffset: number, rawDeltaX: number): number {
  return baseOffset + rawDeltaX;
}

export type SwipeOutcome =
  | { action: "page"; direction: 1 | -1 }
  | { action: "snap" };

/**
 * 松手结果判定(与线上行为等价):
 * - flick:速度 >0.35px/ms 且手指实际位移 >24px 且方向一致 → 翻页;
 * - 慢拖:合成位移超过 max(64px, 18% 屏宽) 且横向意图明确(>1.18×纵向)→ 翻页;
 * - 其余回弹。direction: 1=去下一张(向左划),-1=上一张。
 */
export function resolveSwipeOutcome(input: {
  baseOffset: number;
  fingerDeltaX: number;
  fingerDeltaY: number;
  velocityX: number;
  viewportWidth: number;
  hasAdjacent: (direction: 1 | -1) => boolean;
}): SwipeOutcome {
  const { baseOffset, fingerDeltaX, fingerDeltaY, velocityX, viewportWidth, hasAdjacent } = input;
  const deltaX = composeSwipeDelta(baseOffset, fingerDeltaX);
  const leadingX = Math.abs(deltaX) > 18 ? deltaX : velocityX;
  const direction: 1 | -1 = leadingX < 0 ? 1 : -1;
  const isFlick =
    Math.abs(velocityX) > 0.35 &&
    Math.abs(fingerDeltaX) > 24 &&
    Math.sign(velocityX) === Math.sign(leadingX || deltaX);
  const hasHorizontalIntent = Math.abs(deltaX) > Math.abs(fingerDeltaY) * 1.18 || isFlick;
  const hasEnoughTravel = Math.abs(deltaX) > Math.max(64, viewportWidth * 0.18) || isFlick;
  if (!hasAdjacent(direction) || !hasHorizontalIntent || !hasEnoughTravel) {
    return { action: "snap" };
  }
  return { action: "page", direction };
}
