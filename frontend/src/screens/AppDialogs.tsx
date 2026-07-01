// App 顶层的四个模态对话框(自 App.tsx 上帝类拆出——架构债 D1,分类法 D12:整屏/顶层渲染块进 screens/)。
// 内含:支出编辑器(expenseEditorDialog)、删除支出确认(deleteExpenseDialog)、
// 删除时间线记录确认(deleteCareEventDialog)、批量删除支出确认(bulkDeleteExpensesDialog)。
//
// React.memo:App 本体在无关 setState(打字 / 聊天流式 / 预览手势等)时不再带着这四块对话框树重渲。
// memo 生效前提——函数 props 引用稳定:App 侧经 appDialogsHandlers 的 ref 包装保证(镜像 chatScreenHandlers)。
// 数据 props(各对话框的 open / target / draft 等)合理变化时会重渲本块,这是正确的。
// DOM 结构与拆分前逐字一致(CSS/快照测试不感知)——纯移动,非重写。
import { memo, type RefObject } from "react";
import { ChevronDown, ReceiptText, Save, Trash2, X } from "lucide-react";
import { EXPENSE_CATEGORY_OPTIONS } from "../appOptions";
import { formatExpenseDateLabel } from "../appStateDomain";
import { formatMoney } from "../utils/expense";
import { StorySelect } from "../components/StorySelect";
import { AppDateField } from "../components/appWheelFields";
import type { ExpenseDraft } from "../features/ledger/useLedgerState";
import type { ExpenseItem } from "../types";
import type { RecordEvent } from "../appContracts";

// App 侧经 ref 包装、引用永远稳定的函数 props(同 chatScreenHandlers 的间接模式)。
export type AppDialogsHandlers = {
  closeExpenseEditor: () => void;
  saveExpenseDraft: (event: React.FormEvent) => void;
  setExpenseDraft: React.Dispatch<React.SetStateAction<ExpenseDraft>>;
  settleExpenseOptionalPanel: () => void;
  closeDeleteExpenseConfirm: () => void;
  confirmDeleteExpense: () => void | Promise<void>;
  closeDeleteCareEventConfirm: () => void;
  confirmDeleteCareTimelineEvent: () => void;
  closeBulkDeleteExpenses: () => void;
  confirmBulkDeleteExpenses: () => void | Promise<void>;
};

export type AppDialogsProps = {
  // 支出编辑器
  expenseEditorOpen: boolean;
  editingExpenseId: string | null;
  expenseDraft: ExpenseDraft;
  expenseEditorBodyRef: RefObject<HTMLDivElement | null>;
  expenseOptionalPanelRef: RefObject<HTMLDetailsElement | null>;
  // 删除确认
  deleteExpenseTarget: ExpenseItem | null;
  deleteCareEventTarget: RecordEvent | null;
  bulkDeleteExpensesOpen: boolean;
  selectedExpenseIds: Set<string>;
  handlers: AppDialogsHandlers;
};

export const AppDialogs = memo(function AppDialogs({
  expenseEditorOpen,
  editingExpenseId,
  expenseDraft,
  expenseEditorBodyRef,
  expenseOptionalPanelRef,
  deleteExpenseTarget,
  deleteCareEventTarget,
  bulkDeleteExpensesOpen,
  selectedExpenseIds,
  handlers,
}: AppDialogsProps) {
  const {
    closeExpenseEditor,
    saveExpenseDraft,
    setExpenseDraft,
    settleExpenseOptionalPanel,
    closeDeleteExpenseConfirm,
    confirmDeleteExpense,
    closeDeleteCareEventConfirm,
    confirmDeleteCareTimelineEvent,
    closeBulkDeleteExpenses,
    confirmBulkDeleteExpenses,
  } = handlers;

  const expenseEditorDialog = expenseEditorOpen ? (
    <div className="story-modal-backdrop ledger-form-backdrop" role="presentation" onMouseDown={closeExpenseEditor}>
      <form className="story-modal ledger-form-sheet expense-editor" onSubmit={saveExpenseDraft} onMouseDown={(event) => event.stopPropagation()}>
        <div className="story-modal-head">
          <div>
            <p className="eyebrow">账本</p>
            <h3>{editingExpenseId ? "编辑支出" : "记一笔支出"}</h3>
          </div>
          <button type="button" className="icon-button" onClick={closeExpenseEditor} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="expense-editor-body" ref={expenseEditorBodyRef}>
          <section className="expense-core-card" aria-label="支出核心信息">
            <label className="expense-title-field">
              商品名或用途
              <input
                value={expenseDraft.title}
                onChange={(event) => setExpenseDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="比如 奶粉、尿裤、体检"
              />
            </label>
            <label className="expense-money-field">
              金额
              <span className="expense-money-input">
                <span aria-hidden="true">¥</span>
                <input
                  inputMode="decimal"
                  value={expenseDraft.amount}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0.00"
                />
              </span>
            </label>
            <div className="expense-editor-grid expense-required-grid">
              <label>
                分类
                <StorySelect
                  value={expenseDraft.category}
                  options={EXPENSE_CATEGORY_OPTIONS}
                  ariaLabel="支出分类"
                  onChange={(category) => setExpenseDraft((current) => ({ ...current, category }))}
                />
              </label>
              <label>
                日期
                <span className="expense-date-field">
                  <span>{formatExpenseDateLabel(expenseDraft.date)}</span>
                  <AppDateField
                    className="expense-date-input"
                    overlay
                    value={expenseDraft.date}
                    onChange={(value) => setExpenseDraft((current) => ({ ...current, date: value }))}
                  />
                </span>
              </label>
            </div>
          </section>
          <details
            className="expense-optional-panel"
            ref={expenseOptionalPanelRef}
            onToggle={(event) => {
              if (event.currentTarget.open) settleExpenseOptionalPanel();
            }}
          >
            <summary>
              <span>
                <strong>补充说明</strong>
                <small>商家、备注</small>
              </span>
              <ChevronDown size={17} />
            </summary>
            <div className="expense-optional-fields">
              <label>
                商家
                <input
                  value={expenseDraft.merchant}
                  onFocus={settleExpenseOptionalPanel}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, merchant: event.target.value }))}
                  placeholder="比如 医院、母婴店、朋友代买"
                />
              </label>
              <label>
                备注
                <textarea
                  value={expenseDraft.note}
                  onFocus={settleExpenseOptionalPanel}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, note: event.target.value }))}
                  placeholder="比如 活动价、医生建议购买"
                />
              </label>
            </div>
          </details>
        </div>
        <div className="story-modal-actions">
          <button type="button" className="screen-action-button quiet" onClick={closeExpenseEditor}>
            取消
          </button>
          <button type="submit" className="screen-action-button">
            <Save size={16} />
            保存
          </button>
        </div>
      </form>
    </div>
  ) : null;
  const deleteExpenseDialog = deleteExpenseTarget ? (
    <div className="story-modal-backdrop" role="presentation" onMouseDown={closeDeleteExpenseConfirm}>
      <div
        className="story-modal delete-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-expense-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="delete-confirm-badge" aria-hidden="true">
          <ReceiptText size={22} />
        </div>
        <div className="delete-confirm-copy">
          <p className="eyebrow">删除支出</p>
          <h3 id="delete-expense-title">确定删除这笔支出吗？</h3>
          <p>“{deleteExpenseTarget.title} · {formatMoney(deleteExpenseTarget.amount)}”会从家庭账本里移除。</p>
        </div>
        <div className="story-modal-actions delete-confirm-actions">
          <button type="button" className="screen-action-button quiet" onClick={closeDeleteExpenseConfirm}>
            先保留
          </button>
          <button type="button" className="screen-action-button danger" onClick={() => void confirmDeleteExpense()}>
            <Trash2 size={16} />
            删除
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const deleteCareEventDialog = deleteCareEventTarget ? (
    <div className="story-modal-backdrop" role="presentation" onMouseDown={closeDeleteCareEventConfirm}>
      <div
        className="story-modal delete-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-care-event-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="delete-confirm-badge" aria-hidden="true">
          <Trash2 size={22} />
        </div>
        <div className="delete-confirm-copy">
          <p className="eyebrow">删除记录</p>
          <h3 id="delete-care-event-title">确定删除这条时间线记录吗？</h3>
          <p>“{deleteCareEventTarget.title} · {deleteCareEventTarget.body}”会从当天记录和统计里移除。</p>
        </div>
        <div className="story-modal-actions delete-confirm-actions">
          <button type="button" className="screen-action-button quiet" onClick={closeDeleteCareEventConfirm}>
            先保留
          </button>
          <button type="button" className="screen-action-button danger" onClick={confirmDeleteCareTimelineEvent}>
            <Trash2 size={16} />
            删除
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const bulkDeleteExpensesDialog = bulkDeleteExpensesOpen && selectedExpenseIds.size > 0 ? (
    <div className="story-modal-backdrop" role="presentation" onMouseDown={closeBulkDeleteExpenses}>
      <div
        className="story-modal delete-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-expense-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="delete-confirm-badge" aria-hidden="true">
          <ReceiptText size={22} />
        </div>
        <div className="delete-confirm-copy">
          <p className="eyebrow">批量删除</p>
          <h3 id="bulk-delete-expense-title">确定删除选中的 {selectedExpenseIds.size} 笔支出？</h3>
          <p>选中的支出会从家庭账本里一并移除，无法撤销。</p>
        </div>
        <div className="story-modal-actions delete-confirm-actions">
          <button type="button" className="screen-action-button quiet" onClick={closeBulkDeleteExpenses}>
            先保留
          </button>
          <button type="button" className="screen-action-button danger" onClick={() => void confirmBulkDeleteExpenses()}>
            <Trash2 size={16} />
            删除 {selectedExpenseIds.size} 笔
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {expenseEditorDialog}
      {deleteCareEventDialog}
      {deleteExpenseDialog}
      {bulkDeleteExpensesDialog}
    </>
  );
});
