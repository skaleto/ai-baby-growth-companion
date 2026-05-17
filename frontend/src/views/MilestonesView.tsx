import { ChevronLeft, Sparkles } from "lucide-react";
import { useMemo } from "react";
import type { CSSProperties } from "react";
import {
  GROWTH_MILESTONES,
  MILESTONE_CATEGORY_COLOR,
  MILESTONE_CATEGORY_LABEL,
  milestoneIdFromTags,
  type GrowthMilestone,
} from "../data/growthMilestones";
import { ageLabel } from "../appStateDomain";
import type { BabyProfile, GrowthEvent } from "../types";
import { monthsBetween } from "../utils/babyAge";

export type MilestonesViewProps = {
  profile: BabyProfile;
  growthEvents: GrowthEvent[];
  canCaregive: boolean;
  onClose: () => void;
  onAchieve: (milestone: GrowthMilestone) => void;
};

type MilestoneStatus = "achieved" | "current" | "later" | "earlier";

type MilestoneCard = {
  milestone: GrowthMilestone;
  status: MilestoneStatus;
  achievedDate?: string;
};

const STATUS_ORDER: Record<MilestoneStatus, number> = {
  current: 0,
  earlier: 1,
  achieved: 2,
  later: 3,
};

export function MilestonesView(props: MilestonesViewProps) {
  const { profile, growthEvents, canCaregive, onClose, onAchieve } = props;
  const ageMonths = useMemo(() => monthsBetween(profile.birthDate) ?? null, [profile.birthDate]);

  const achievedById = useMemo(() => {
    const map = new Map<string, GrowthEvent>();
    for (const event of growthEvents) {
      const id = milestoneIdFromTags(event.tags);
      if (id) map.set(id, event);
    }
    return map;
  }, [growthEvents]);

  const cards = useMemo<MilestoneCard[]>(() => {
    const result: MilestoneCard[] = GROWTH_MILESTONES.map((milestone) => {
      const achieved = achievedById.get(milestone.id);
      if (achieved) {
        return { milestone, status: "achieved", achievedDate: achieved.date };
      }
      if (ageMonths === null) return { milestone, status: "current" };
      if (ageMonths < milestone.ageMonthMin) return { milestone, status: "later" };
      if (ageMonths > milestone.ageMonthMax) return { milestone, status: "earlier" };
      return { milestone, status: "current" };
    });
    result.sort((left, right) => {
      const orderDiff = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
      if (orderDiff !== 0) return orderDiff;
      return left.milestone.ageMonthMin - right.milestone.ageMonthMin;
    });
    return result;
  }, [achievedById, ageMonths]);

  const summary = useMemo(() => {
    const achieved = cards.filter((card) => card.status === "achieved").length;
    const current = cards.filter((card) => card.status === "current").length;
    const earlier = cards.filter((card) => card.status === "earlier").length;
    return { achieved, current, earlier, total: cards.length };
  }, [cards]);

  return (
    <section className="milestone-screen" aria-label="发育里程碑">
      <div className="milestone-head">
        <button type="button" className="milestone-back" onClick={onClose} aria-label="返回">
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="eyebrow">发育里程碑</p>
          <h2>{profile.nickname || "小宝"}的成长足迹</h2>
        </div>
      </div>

      <div className="milestone-summary">
        <div className="milestone-summary__age">
          <span>当前月龄</span>
          <strong>{profile.birthDate ? ageLabel(profile.birthDate) : "待设置生日"}</strong>
        </div>
        <div className="milestone-summary__stats">
          <span>已记录 <b>{summary.achieved}</b> / {summary.total}</span>
          {summary.current > 0 ? <span>现阶段可观察 <b>{summary.current}</b></span> : null}
        </div>
      </div>

      <p className="milestone-disclaimer">
        <Sparkles size={14} />
        <span>每个孩子节奏不同，时间提前或落后 1–2 个月都很正常。这里只用于日常关注，不构成医学诊断。</span>
      </p>

      <div className="milestone-list">
        {cards.map((card) => {
          const color = MILESTONE_CATEGORY_COLOR[card.milestone.category];
          const categoryLabel = MILESTONE_CATEGORY_LABEL[card.milestone.category];
          return (
            <article
              key={card.milestone.id}
              className={`milestone-card ${card.status}`}
              style={{ "--milestone-color": color } as CSSProperties}
            >
              <span className="milestone-card__bar" aria-hidden="true" />
              <div className="milestone-card__main">
                <div className="milestone-card__head">
                  <span className="milestone-card__category">{categoryLabel}</span>
                  <span className="milestone-card__age">
                    {card.milestone.ageMonthMin}-{card.milestone.ageMonthMax} 月龄
                  </span>
                </div>
                <h3 className="milestone-card__title">{card.milestone.title}</h3>
                <p className="milestone-card__hint">{card.milestone.hint}</p>
                <div className="milestone-card__footer">
                  {card.status === "achieved" ? (
                    <span className="milestone-card__status achieved">已记录 · {card.achievedDate}</span>
                  ) : card.status === "later" ? (
                    <span className="milestone-card__status later">之后可能达成</span>
                  ) : card.status === "earlier" ? (
                    <span className="milestone-card__status earlier">前一阶段</span>
                  ) : (
                    <span className="milestone-card__status current">现阶段可观察</span>
                  )}
                  {card.status !== "achieved" && canCaregive ? (
                    <button
                      type="button"
                      className="milestone-card__cta"
                      onClick={() => onAchieve(card.milestone)}
                    >
                      记一笔
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
