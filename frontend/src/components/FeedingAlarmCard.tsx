// 喂奶闹钟卡片(从记录页顶部挂载)。memo:函数 props 由 App 经 ref 稳定。
// 派生值屏内算(每 30s tick),不向上触发 App 重渲染。视觉后续由 codex 出图打磨(#37)。
import { memo, useEffect, useState } from "react";
import { BellRing, Clock3 } from "lucide-react";
import { computeFeedingAlarmView, formatDurationCompact } from "../feedingAlarmView";

const QUICK_AMOUNTS = [90, 120, 150, 180];

export type FeedingAlarmCardProps = {
  canCaregive: boolean;
  dueAtMs: number | null;
  intervalMinutes: number | null;
  lastMilkAtMs: number | null;
  onFed: (amountMl: number | null) => void; // null = 亲喂不记量
  onPickOther: () => void; // 自定义奶量(App 侧 appPrompt)
  onSetup: () => void;
};

export const FeedingAlarmCard = memo(function FeedingAlarmCard({
  canCaregive,
  dueAtMs,
  intervalMinutes,
  lastMilkAtMs,
  onFed,
  onPickOther,
  onSetup,
}: FeedingAlarmCardProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const view = computeFeedingAlarmView({ dueAtMs, intervalMinutes, lastMilkAtMs, nowMs });

  if (!view.hasAlarm) {
    return (
      <section className="feeding-alarm-card is-empty" aria-label="喂奶闹钟">
        <span className="fa-orb" aria-hidden="true">
          <Clock3 size={20} />
        </span>
        <div className="fa-body">
          <p className="fa-label">喂奶闹钟</p>
          <p className="fa-sub">设置喂奶间隔,到点提醒、卡片倒计时</p>
        </div>
        {canCaregive ? (
          <button type="button" className="fa-setup" onClick={onSetup}>
            设置
          </button>
        ) : null}
      </section>
    );
  }

  const overdue = view.overdue;
  const untilText = view.untilNextMs != null ? formatDurationCompact(Math.abs(view.untilNextMs)) : "";
  const sinceText = view.sinceLastMs != null ? `距上次 ${formatDurationCompact(view.sinceLastMs)}` : "还没有喂奶记录";
  const intervalText = view.intervalMinutes ? `每 ${formatDurationCompact(view.intervalMinutes * 60000)}` : "";
  const pick = (amount: number | null) => {
    setSheetOpen(false);
    onFed(amount);
  };

  return (
    <section className={`feeding-alarm-card${overdue ? " is-due" : ""}`} aria-label="喂奶闹钟">
      <span className="fa-orb" aria-hidden="true">
        {overdue ? <BellRing size={20} /> : <Clock3 size={20} />}
      </span>
      <div className="fa-body">
        <p className="fa-label">{overdue ? "该喂奶啦" : "下次喂奶"}</p>
        <p className="fa-count">{overdue ? `已超 ${untilText}` : `还有 ${untilText}`}</p>
        <p className="fa-sub">
          {sinceText}
          {intervalText ? ` · ${intervalText}` : ""}
        </p>
      </div>
      {canCaregive ? (
        <button type="button" className="fa-fed" onClick={() => setSheetOpen(true)}>
          已喂
        </button>
      ) : null}

      {sheetOpen ? (
        <div className="fa-sheet-scrim" onClick={() => setSheetOpen(false)}>
          <div className="fa-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="记一次喂奶">
            <p className="fa-sheet-title">记一次喂奶 · 现在</p>
            <div className="fa-chips">
              {QUICK_AMOUNTS.map((amt) => (
                <button type="button" className="fa-chip" key={amt} onClick={() => pick(amt)}>
                  {amt} ml
                </button>
              ))}
              <button type="button" className="fa-chip alt" onClick={() => pick(null)}>
                亲喂 · 不记量
              </button>
              <button
                type="button"
                className="fa-chip more"
                onClick={() => {
                  setSheetOpen(false);
                  onPickOther();
                }}
              >
                其他…
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
});
