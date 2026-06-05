import { ArrowUpRight, Sparkles } from "lucide-react";
import type { CareLog, DailySummary, Finding, GrowthMeasurement } from "../types";
import { Skeleton } from "../components/Skeleton";
import heroRecordsToday from "../assets/illustrations/hero-records-today.webp";
import {
  buildCareStats,
  buildCaregiverCompanionLine,
  buildGrowthStats,
  countTodayDataPoints,
  type DailyObservationStat,
  FINDING_TYPE_COLOR,
  FINDING_TYPE_LABEL,
  parseActionTarget,
} from "../utils/dailySummary";

export type DailySummaryViewProps = {
  summary: DailySummary | null;
  onActionClick: (domain: string, id: string) => void;
  loading?: boolean;
  careLog?: CareLog | null;
  growthMeasurements?: GrowthMeasurement[];
  date: string;
  babyNickname: string;
  canCaregive: boolean;
  onGenerate?: () => void;
  onOpenGrowth?: () => void;
};

export function DailySummaryView({
  summary,
  onActionClick,
  loading = false,
  careLog,
  growthMeasurements = [],
  date,
  babyNickname,
  canCaregive,
  onGenerate,
  onOpenGrowth,
}: DailySummaryViewProps) {
  const hasFindings = Boolean(summary?.findings?.length);
  const hasObservations = Boolean(summary?.observations?.length);
  const stats = [...buildCareStats(careLog), buildGrowthStats(growthMeasurements, date)];
  const dataPoints = countTodayDataPoints(careLog, growthMeasurements, date);
  const caregiverLine = buildCaregiverCompanionLine(careLog, growthMeasurements, date);
  const statusLabel = loading ? "整理中" : summary?.stale ? "有新记录" : summary ? "已整理" : "还没整理";
  const subtitle = buildSubtitle({ dataPoints, loading, summary });
  const generateLabel = summary ? "重新整理" : "整理今天";

  return (
    <section className="daily-summary daily-observation stagger" aria-label="小宝今日观察">
      <div className="daily-summary__section daily-observation__main fade-in-up">
        <header className="daily-observation__header">
          <div>
            <span className="daily-observation__kicker">{babyNickname}的今天</span>
            <h3>小宝今日观察</h3>
            <p>{subtitle}</p>
          </div>
          <span className={`daily-observation__status ${summary?.stale ? "stale" : ""}`}>{statusLabel}</span>
        </header>

        <img
          src={heroRecordsToday}
          alt=""
          className="daily-summary__hero"
          aria-hidden="true"
        />

        <div className="daily-observation__stats" aria-label="宝宝今天">
          {stats.map((stat) => (
            <ObservationStatCard
              key={stat.key}
              stat={stat}
              onOpenGrowth={stat.key === "growth" ? onOpenGrowth : undefined}
            />
          ))}
        </div>

        <div className="daily-observation__body">
          {loading && !summary ? (
            <DailySummarySkeleton compact />
          ) : summary ? (
            <>
              <p className="daily-observation__text">{summary.text}</p>
              {summary.stale ? <small className="daily-observation__stale-note">有新记录，可以重新整理一版。</small> : null}
            </>
          ) : (
            <p className="daily-observation__empty">
              今天还没整理。有记录会更完整，没记全也可以先整理。
            </p>
          )}
        </div>

        <div className="daily-observation__caregiver-note">
          <span>给照护人的话</span>
          <p>{caregiverLine}</p>
        </div>

        <details className="daily-observation__explain">
          <summary>这些观察怎么来的</summary>
          <p>这些观察来自你和家人今天记下的照护记录、成长记录、提醒和家庭内资料。我会尽量把它们整理清楚，但不会替代医生做诊断。你删除的记录不会再进入后续整理。</p>
        </details>

        {canCaregive && onGenerate ? (
          <button
            type="button"
            className="screen-action-button daily-observation__generate"
            onClick={onGenerate}
            disabled={loading}
          >
            <Sparkles size={16} />
            {generateLabel}
          </button>
        ) : (
          <p className="readonly-copy">当前身份仅可查看，整理今天需要照护人操作。</p>
        )}
      </div>

      {hasFindings && (
        <div className="daily-summary__section fade-in-up">
          <h3>你可能没注意到</h3>
          {summary?.findings.map((finding, idx) => (
            <FindingRow
              key={`${finding.type}-${idx}`}
              finding={finding}
              onActionClick={onActionClick}
            />
          ))}
        </div>
      )}

      {hasObservations && (
        <div className="daily-summary__section fade-in-up">
          <h3>留意一下</h3>
          {summary?.observations.map((text, idx) => (
            <div key={idx} className="daily-summary__missing-item">{text}</div>
          ))}
        </div>
      )}

    </section>
  );
}

function ObservationStatCard({ stat, onOpenGrowth }: { stat: DailyObservationStat; onOpenGrowth?: () => void }) {
  const content = (
    <>
      <span className="daily-observation__stat-label">{stat.label}</span>
      <strong>{stat.value}</strong>
      <small>{stat.detail}</small>
    </>
  );

  if (onOpenGrowth) {
    return (
      <button
        type="button"
        className={`daily-observation__stat daily-observation__stat--${stat.key} ${stat.empty ? "is-empty" : ""}`}
        onClick={onOpenGrowth}
      >
        {content}
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    );
  }

  return (
    <article className={`daily-observation__stat daily-observation__stat--${stat.key} ${stat.empty ? "is-empty" : ""}`}>
      {content}
    </article>
  );
}

function buildSubtitle(input: { dataPoints: number; loading: boolean; summary: DailySummary | null }) {
  if (input.loading) return input.summary ? "正在更新已有整理" : "正在整理已有记录";
  if (input.dataPoints <= 0) return "今天还没有记录";
  const generated = input.summary?.generatedAt ? ` · ${formatGeneratedTime(input.summary.generatedAt)} 整理` : "";
  return `基于今天 ${input.dataPoints} 条记录${generated}`;
}

function formatGeneratedTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function DailySummarySkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="daily-observation__skeleton" aria-busy="true">
        <Skeleton width="92%" height={16} />
        <div style={{ height: 6 }} />
        <Skeleton width="74%" height={16} />
      </div>
    );
  }
  return (
    <section className="daily-summary daily-summary--loading stagger" aria-label="小宝今日观察加载中" aria-busy="true">
      <div className="daily-summary__section fade-in-up">
        <Skeleton width={120} height={14} />
        <div style={{ height: 10 }} />
        <Skeleton width="92%" height={16} />
        <div style={{ height: 6 }} />
        <Skeleton width="74%" height={16} />
      </div>
      <div className="daily-summary__section fade-in-up">
        <Skeleton width={140} height={14} />
        <div style={{ height: 12 }} />
        <Skeleton width="100%" height={48} radius={10} />
        <div style={{ height: 8 }} />
        <Skeleton width="100%" height={48} radius={10} />
        <div style={{ height: 8 }} />
        <Skeleton width="100%" height={48} radius={10} />
      </div>
      <div className="daily-summary__section fade-in-up">
        <Skeleton width={100} height={14} />
        <div style={{ height: 10 }} />
        <Skeleton width="85%" height={14} />
        <div style={{ height: 6 }} />
        <Skeleton width="60%" height={14} />
      </div>
    </section>
  );
}

type FindingRowProps = {
  finding: Finding;
  onActionClick: (domain: string, id: string) => void;
};

function FindingRow({ finding, onActionClick }: FindingRowProps) {
  const parsed = finding.action ? parseActionTarget(finding.action.target) : null;
  const tagColor = FINDING_TYPE_COLOR[finding.type] ?? "#aaa";
  const tagLabel = FINDING_TYPE_LABEL[finding.type] ?? finding.type;

  return (
    <div className="daily-summary__finding">
      <span
        className="daily-summary__finding-tag"
        style={{ backgroundColor: tagColor }}
        aria-label={tagLabel}
      >
        {tagLabel}
      </span>
      <div className="daily-summary__finding-body">
        <span>{finding.text}</span>
        {finding.action && parsed && (
          <button
            type="button"
            className="daily-summary__finding-action"
            onClick={() => onActionClick(parsed.domain, parsed.id)}
          >
            {finding.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
