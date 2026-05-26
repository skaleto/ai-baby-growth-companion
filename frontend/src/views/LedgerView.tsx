import {
  CheckCircle2,
  ChevronRight,
  Image as ImageIcon,
  LineChart,
  Mic,
  ReceiptText,
  Trash2,
  Video,
  WalletCards,
} from "lucide-react";
import type { CSSProperties } from "react";
import { EXPENSE_CATEGORY_COLORS, LEDGER_VIEWS, type LedgerView as LedgerViewId } from "../appOptions";
import { creatorMetaText } from "../appStateDomain";
import type { Attachment, ExpenseItem } from "../types";
import {
  expenseCategoryLabel,
  expenseSourceLabel,
  formatMoney,
  formatMoneyCompact,
  type ExpenseMonthGroup,
} from "../utils/expense";

export type LedgerStats = {
  monthTotal: number;
  yearTotal: number;
  categoryTotals: Array<{ id: ExpenseItem["category"]; label: string; total: number }>;
  maxCategoryTotal: number;
  monthlyTotals: Array<{ month: string; label: string; total: number }>;
  maxMonthlyTotal: number;
  largest: ExpenseItem[];
};

export type LedgerViewProps = {
  babyNickname: string;
  canCaregive: boolean;
  ledgerView: LedgerViewId;
  setLedgerView: (id: LedgerViewId) => void;
  ledgerMonthKey: string;
  ledgerYearKey: string;
  monthExpenses: ExpenseItem[];
  sortedExpenses: ExpenseItem[];
  expenseMonthGroups: ExpenseMonthGroup[];
  ledgerStats: LedgerStats;
  expenseBulkMode: boolean;
  selectedExpenseIds: Set<string>;
  collapsedExpenseMonths: Set<string>;
  openNewExpenseEditor: () => void;
  openEditExpenseEditor: (expense: ExpenseItem) => void;
  toggleExpenseBulkMode: () => void;
  toggleExpenseMonthCollapse: (monthKey: string) => void;
  toggleExpenseSelection: (id: string) => void;
  exitExpenseBulkMode: () => void;
  requestBulkDeleteExpenses: () => void;
  openPreviewAttachment: (attachment: Attachment, albumItem?: null) => void;
};

const monthDayOf = (date: string) =>
  date && date.length >= 10 ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : date;

export function LedgerView(props: LedgerViewProps) {
  const {
    babyNickname,
    canCaregive,
    ledgerView,
    setLedgerView,
    ledgerMonthKey,
    ledgerYearKey,
    monthExpenses,
    sortedExpenses,
    expenseMonthGroups,
    ledgerStats,
    expenseBulkMode,
    selectedExpenseIds,
    collapsedExpenseMonths,
    openNewExpenseEditor,
    openEditExpenseEditor,
    toggleExpenseBulkMode,
    toggleExpenseMonthCollapse,
    toggleExpenseSelection,
    exitExpenseBulkMode,
    requestBulkDeleteExpenses,
    openPreviewAttachment,
  } = props;

  return (
    <section className="ledger-screen tab-content-enter" aria-label="账本">
      <div className="screen-head">
        <div className="screen-heading-with-icon">
          <WalletCards size={24} className="screen-head-lucide" />
          <div>
            <p className="eyebrow">账本</p>
            <h2>{babyNickname}的家庭花费</h2>
          </div>
        </div>
        <div className="screen-head-actions ledger-head-actions">
          <span className="screen-pill">{monthExpenses.length} 笔本月支出</span>
          {!canCaregive ? <span className="readonly-pill">仅查看</span> : null}
        </div>
      </div>

      <div className="segmented-tabs ledger-tabs" role="tablist" aria-label="账本视图">
        {LEDGER_VIEWS.map((view) => (
          <button
            type="button"
            className={ledgerView === view.id ? "active" : ""}
            aria-selected={ledgerView === view.id}
            role="tab"
            key={view.id}
            onClick={() => setLedgerView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>

      <section className="ledger-summary-card">
        <div>
          <span>本月支出</span>
          <strong>{formatMoney(ledgerStats.monthTotal)}</strong>
          <small>{ledgerMonthKey} · {monthExpenses.length} 笔</small>
        </div>
        <div>
          <span>年度累计</span>
          <strong>{formatMoney(ledgerStats.yearTotal)}</strong>
          <small>{ledgerYearKey} 年</small>
        </div>
      </section>

      {canCaregive ? (
        <button type="button" className="ledger-manual-cta" onClick={openNewExpenseEditor}>
          <span aria-hidden="true">
            <ReceiptText size={20} />
          </span>
          <strong>记一笔支出</strong>
          <small>手动补充宝宝相关花费</small>
        </button>
      ) : null}

      {ledgerView === "month" ? (
        <>
          <section className="ledger-card">
            <div className="section-title">
              <LineChart size={18} />
              <h2>本月分类占比</h2>
            </div>
            {ledgerStats.categoryTotals.length ? (
              <div className="expense-category-list">
                {ledgerStats.categoryTotals.map((category) => (
                  <article className={`expense-category-row expense-${category.id}`} key={category.id}>
                    <div>
                      <span>{category.label}</span>
                      <strong>{formatMoney(category.total)}</strong>
                    </div>
                    <i aria-hidden="true">
                      <b style={{ width: `${Math.max(8, (category.total / ledgerStats.maxCategoryTotal) * 100)}%` }} />
                    </i>
                  </article>
                ))}
              </div>
            ) : (
              <p className="ledger-empty-copy">本月还没有账本支出。</p>
            )}
          </section>

          <section className="ledger-card">
            <div className="section-title">
              <ReceiptText size={18} />
              <h2>本月较大支出</h2>
            </div>
            {ledgerStats.largest.length ? (
              <div className="expense-row-list">
                {ledgerStats.largest.map((expense) => {
                  const categoryLabel = expenseCategoryLabel(expense.category);
                  const categoryColor = EXPENSE_CATEGORY_COLORS[expense.category] ?? EXPENSE_CATEGORY_COLORS.other;
                  return (
                    <article
                      className="expense-row"
                      key={expense.id}
                      onClick={() => canCaregive && openEditExpenseEditor(expense)}
                      role={canCaregive ? "button" : undefined}
                      tabIndex={canCaregive ? 0 : undefined}
                      style={{ "--expense-color": categoryColor } as CSSProperties}
                    >
                      <span className="expense-row__bar" aria-hidden="true" />
                      <div className="expense-row__main">
                        <div className="expense-row__category-line">
                          <span className="expense-row__category-label">{categoryLabel}</span>
                        </div>
                        <div className="expense-row__title-line">
                          <h3 className="expense-row__title">{expense.title}</h3>
                          <strong className="expense-row__amount">{formatMoney(expense.amount)}</strong>
                        </div>
                        <div className="expense-row__meta">
                          <span className="expense-row__meta-part">{monthDayOf(expense.date)}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="ledger-empty-copy">记几笔之后，这里会自动列出本月最大支出。</p>
            )}
          </section>
        </>
      ) : null}

      {ledgerView === "year" ? (
        <section className="ledger-card">
          <div className="section-title">
            <LineChart size={18} />
            <h2>年度月度对比</h2>
          </div>
          <div className="expense-year-chart" aria-label="年度支出柱状图">
            {ledgerStats.monthlyTotals.map((month) => (
              <div
                className="expense-month-bar"
                key={month.month}
                title={month.total ? `${month.label}：${formatMoney(month.total)}` : `${month.label}：暂无支出`}
              >
                <span>{month.total ? formatMoneyCompact(month.total) : "0"}</span>
                <i aria-hidden="true">
                  <b style={{ height: `${month.total ? Math.max(8, (month.total / ledgerStats.maxMonthlyTotal) * 100) : 0}%` }} />
                </i>
                <em>{month.label}</em>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {ledgerView === "details" ? (
        <section className="ledger-card">
          <div className="section-title ledger-detail-head">
            <div className="section-title-main">
              <ReceiptText size={18} />
              <h2>支出明细</h2>
            </div>
            {canCaregive && sortedExpenses.length ? (
              <button
                type="button"
                className={`ledger-detail-edit-btn ${expenseBulkMode ? "active" : ""}`}
                onClick={toggleExpenseBulkMode}
              >
                {expenseBulkMode ? "完成" : "编辑"}
              </button>
            ) : null}
          </div>
          {sortedExpenses.length ? (
            <div className="expense-month-list">
              {expenseMonthGroups.map((group) => {
                const defaultCollapsed = group.monthKey !== ledgerMonthKey;
                const userToggled = collapsedExpenseMonths.has(group.monthKey);
                const collapsed = userToggled ? !defaultCollapsed : defaultCollapsed;
                return (
                  <section className="expense-month-group" key={group.monthKey}>
                    <button
                      type="button"
                      className={`expense-month-head ${collapsed ? "collapsed" : ""}`}
                      aria-expanded={!collapsed}
                      onClick={() => toggleExpenseMonthCollapse(group.monthKey)}
                    >
                      <span className="expense-month-toggle" aria-hidden="true">
                        <ChevronRight size={16} />
                      </span>
                      <span className="expense-month-title">{group.label}</span>
                      <span className="expense-month-stats">
                        {group.items.length} 笔 · {formatMoney(group.total)}
                      </span>
                    </button>
                    {!collapsed ? (
                      <div className="expense-row-list">
                        {group.items.map((expense) => {
                          const categoryLabel = expenseCategoryLabel(expense.category);
                          const categoryColor = EXPENSE_CATEGORY_COLORS[expense.category] ?? EXPENSE_CATEGORY_COLORS.other;
                          const sourceLabel = expenseSourceLabel(expense.source);
                          const recordedByLabel = expense.recordedBy ? creatorMetaText(expense.recordedBy) : "";
                          const metaParts = [monthDayOf(expense.date), sourceLabel, recordedByLabel].filter(Boolean);
                          const hasAttachments = (expense.attachments?.length ?? 0) > 0;
                          const firstAttachment = expense.attachments?.[0];
                          const selected = selectedExpenseIds.has(expense.id);
                          const handleRowClick = () => {
                            if (expenseBulkMode) {
                              toggleExpenseSelection(expense.id);
                            } else if (canCaregive) {
                              openEditExpenseEditor(expense);
                            }
                          };
                          return (
                            <article
                              className={`expense-row ${selected ? "selected" : ""} ${expenseBulkMode ? "bulk" : ""}`}
                              key={expense.id}
                              onClick={handleRowClick}
                              role={expenseBulkMode || canCaregive ? "button" : undefined}
                              tabIndex={expenseBulkMode || canCaregive ? 0 : undefined}
                              style={{ "--expense-color": categoryColor } as CSSProperties}
                            >
                              <span className="expense-row__bar" aria-hidden="true" />
                              {expenseBulkMode ? (
                                <span className="expense-row__checkbox" aria-hidden="true">
                                  {selected ? <CheckCircle2 size={20} /> : <span className="expense-row__checkbox-dot" />}
                                </span>
                              ) : null}
                              <div className="expense-row__main">
                                <div className="expense-row__category-line">
                                  <span className="expense-row__category-label">{categoryLabel}</span>
                                </div>
                                <div className="expense-row__title-line">
                                  <h3 className="expense-row__title">{expense.title}</h3>
                                  <strong className="expense-row__amount">{formatMoney(expense.amount)}</strong>
                                </div>
                                <div className="expense-row__meta">
                                  {metaParts.map((part, index) => (
                                    <span key={`${expense.id}-meta-${index}`} className="expense-row__meta-part">
                                      {part}
                                    </span>
                                  ))}
                                  {hasAttachments && firstAttachment ? (
                                    <button
                                      type="button"
                                      className="expense-row__attach"
                                      title={`查看附件（${expense.attachments?.length ?? 0}）`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (!firstAttachment.url) return;
                                        openPreviewAttachment(firstAttachment, null);
                                      }}
                                      disabled={!firstAttachment.url}
                                    >
                                      {firstAttachment.kind === "image" && firstAttachment.thumbnailUrl ? (
                                        <img
                                          src={firstAttachment.thumbnailUrl}
                                          alt=""
                                          className="expense-row__attach-thumb"
                                          loading="lazy"
                                          decoding="async"
                                        />
                                      ) : firstAttachment.kind === "video" && firstAttachment.thumbnailUrl ? (
                                        <img
                                          src={firstAttachment.thumbnailUrl}
                                          alt=""
                                          className="expense-row__attach-thumb"
                                          loading="lazy"
                                          decoding="async"
                                        />
                                      ) : firstAttachment.kind === "video" ? (
                                        <Video size={14} />
                                      ) : firstAttachment.kind === "audio" ? (
                                        <Mic size={14} />
                                      ) : (
                                        <ImageIcon size={14} />
                                      )}
                                      <span>
                                        {firstAttachment.kind === "video" ? "视频" : firstAttachment.kind === "audio" ? "语音" : "图片"}
                                        {expense.attachments && expense.attachments.length > 1 ? ` ${expense.attachments.length}` : ""}
                                      </span>
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="empty-state ledger-empty">
              <span className="empty-sticker" aria-hidden="true">
                <ReceiptText size={28} />
              </span>
              <p>还没有支出记录。</p>
              {canCaregive ? <button type="button" onClick={openNewExpenseEditor}>记第一笔</button> : null}
            </div>
          )}
        </section>
      ) : null}

      {expenseBulkMode && selectedExpenseIds.size > 0 ? (
        <div className="ledger-bulk-bar" role="region" aria-label="批量操作">
          <span className="ledger-bulk-bar__count">{selectedExpenseIds.size} 笔已选</span>
          <button
            type="button"
            className="ledger-bulk-bar__cancel"
            onClick={exitExpenseBulkMode}
          >
            取消
          </button>
          <button
            type="button"
            className="ledger-bulk-bar__delete"
            onClick={requestBulkDeleteExpenses}
            disabled={selectedExpenseIds.size === 0}
          >
            <Trash2 size={16} />
            删除选中
          </button>
        </div>
      ) : null}
    </section>
  );
}
