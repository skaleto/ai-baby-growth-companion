import type { DailySummary, Finding } from "../types";
import {
  FINDING_TYPE_COLOR,
  FINDING_TYPE_LABEL,
  parseActionTarget,
} from "../utils/dailySummary";

export type DailySummaryViewProps = {
  summary: DailySummary | null;
  onActionClick: (domain: string, id: string) => void;
};

export function DailySummaryView({ summary, onActionClick }: DailySummaryViewProps) {
  if (!summary) return null;

  const hasFindings = summary.findings && summary.findings.length > 0;
  const hasMissing = summary.missingItems && summary.missingItems.length > 0;
  const hasObservations = summary.observations && summary.observations.length > 0;

  return (
    <section className="daily-summary" aria-label="今日发现">
      {summary.facts && summary.facts.length > 0 && (
        <div className="daily-summary__section">
          <h3>宝宝今天</h3>
          <p className="daily-summary__facts">{summary.facts.join("；")}</p>
        </div>
      )}

      {hasFindings && (
        <div className="daily-summary__section">
          <h3>你可能没注意到</h3>
          {summary.findings.map((finding, idx) => (
            <FindingRow
              key={`${finding.type}-${idx}`}
              finding={finding}
              onActionClick={onActionClick}
            />
          ))}
        </div>
      )}

      {hasObservations && (
        <div className="daily-summary__section">
          <h3>需要你看一眼</h3>
          {summary.observations.map((text, idx) => (
            <div key={idx} className="daily-summary__missing-item">{text}</div>
          ))}
        </div>
      )}

      {hasMissing && (
        <div className="daily-summary__section">
          <h3>漏掉了吗</h3>
          {summary.missingItems.map((item) => (
            <div key={item.id} className="daily-summary__missing-item">
              {item.message}
            </div>
          ))}
        </div>
      )}
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
