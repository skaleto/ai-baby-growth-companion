import { ChevronLeft, PencilLine, Save, LineChart } from "lucide-react";
import { StorySelect } from "../components/StorySelect";
import { GROWTH_MEASUREMENT_META, GROWTH_MEASUREMENT_TYPES } from "../appOptions";
import type { BabyProfile, GrowthMeasurement, GrowthMeasurementType } from "../types";

export type GrowthEntryViewProps = {
  profile: BabyProfile;
  growthMeasurements: GrowthMeasurement[];
  canCaregive: boolean;
  draft: { type: GrowthMeasurementType; value: string; date: string; note: string };
  editingMeasurementId: string;
  onDraftChange: (next: GrowthEntryViewProps["draft"]) => void;
  onSubmit: (e: React.FormEvent) => void;
  onEdit: (measurement: GrowthMeasurement) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function GrowthEntryView(props: GrowthEntryViewProps) {
  const { profile, growthMeasurements, canCaregive, draft, editingMeasurementId, onDraftChange, onSubmit, onEdit, onCancelEdit, onDelete, onClose } = props;
  const isEditing = Boolean(editingMeasurementId);

  return (
    <section className="milestone-screen" aria-label="宝宝成长">
      <div className="milestone-head">
        <button type="button" className="milestone-back" onClick={onClose} aria-label="返回">
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="eyebrow">宝宝成长</p>
          <h2>{profile.nickname || "小宝"}的成长数据</h2>
        </div>
      </div>

      <section className="growth-card">
        <div className="section-title">
          <LineChart size={18} />
          <h2>成长记录</h2>
        </div>
        {canCaregive ? (
          <form className="growth-entry-form" onSubmit={onSubmit}>
            {isEditing ? <p className="growth-entry-editing">正在编辑这条成长数据。保存后会更新历史记录。</p> : null}
            <div className="growth-entry-row">
              <StorySelect
                ariaLabel="测量项"
                value={draft.type}
                options={GROWTH_MEASUREMENT_TYPES.map((type) => ({
                  value: type,
                  label: GROWTH_MEASUREMENT_META[type].label,
                }))}
                onChange={(type) =>
                  onDraftChange({ ...draft, type: type as GrowthMeasurementType })
                }
              />
              <div className="growth-value-input">
                <input
                  type="number"
                  inputMode="decimal"
                  step={GROWTH_MEASUREMENT_META[draft.type].step}
                  min={GROWTH_MEASUREMENT_META[draft.type].min}
                  max={GROWTH_MEASUREMENT_META[draft.type].max}
                  placeholder="数值"
                  value={draft.value}
                  onChange={(event) =>
                    onDraftChange({ ...draft, value: event.target.value })
                  }
                />
                <span className="growth-unit">{GROWTH_MEASUREMENT_META[draft.type].unit}</span>
              </div>
            </div>
            <div className="growth-entry-row">
              <input
                type="date"
                value={draft.date}
                onChange={(event) =>
                  onDraftChange({ ...draft, date: event.target.value })
                }
              />
              <input
                type="text"
                placeholder="备注（可选）"
                value={draft.note}
                onChange={(event) =>
                  onDraftChange({ ...draft, note: event.target.value })
                }
              />
            </div>
            <div className="growth-entry-actions">
              <button type="submit" className="screen-action-button">
                <Save size={16} />
                {isEditing ? "保存修改" : "记录一笔"}
              </button>
              {isEditing ? (
                <button type="button" className="screen-action-button quiet" onClick={onCancelEdit}>
                  取消编辑
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="readonly-copy">当前身份仅可查看，记录成长数据需要照护人操作。</p>
        )}

        <div className="growth-history">
          {GROWTH_MEASUREMENT_TYPES.map((type) => {
            const meta = GROWTH_MEASUREMENT_META[type];
            const items = growthMeasurements
              .filter((measurement) => measurement.type === type)
              .sort((a, b) => a.date.localeCompare(b.date));
            if (!items.length) return null;
            const rows = items.map((item, index) => ({
              item,
              delta: index > 0 ? item.value - items[index - 1].value : null,
            }));
            return (
              <article className="growth-history-group" key={type}>
                <header>
                  <strong>{meta.label}</strong>
                  <span>
                    最新 {items[items.length - 1].value}
                    {meta.unit}
                  </span>
                </header>
                <ul>
                  {rows
                    .slice()
                    .reverse()
                    .map(({ item, delta }) => (
                      <li key={item.id}>
                        <div className="growth-history-main">
                          <span className="growth-history-value">
                            {item.value}
                            {meta.unit}
                          </span>
                          {delta !== null ? (
                            <span className={`growth-history-delta ${delta >= 0 ? "up" : "down"}`}>
                              {delta >= 0 ? "+" : ""}
                              {Number(delta.toFixed(2))}
                              {meta.unit}
                            </span>
                          ) : null}
                        </div>
                        <div className="growth-history-meta">
                          <span>{item.date}</span>
                          {item.note ? <span className="growth-history-note">{item.note}</span> : null}
                          {canCaregive ? (
                            <div className="growth-history-actions">
                              <button
                                type="button"
                                className={`growth-history-edit ${editingMeasurementId === item.id ? "active" : ""}`}
                                onClick={() => onEdit(item)}
                              >
                                <PencilLine size={13} />
                                {editingMeasurementId === item.id ? "编辑中" : "编辑"}
                              </button>
                              <button
                                type="button"
                                className="growth-history-delete"
                                onClick={() => onDelete(item.id)}
                              >
                                删除
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                </ul>
              </article>
            );
          })}
          {growthMeasurements.length === 0 ? (
            <p className="growth-empty">还没有成长记录。在上面记录第一笔身高、体重或头围吧。</p>
          ) : null}
        </div>
      </section>
    </section>
  );
}
