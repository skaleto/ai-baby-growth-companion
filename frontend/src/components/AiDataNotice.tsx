import { useState } from "react";
import { Info, X } from "lucide-react";
import { AI_DATA_NOTICE_PARAGRAPHS, AI_DATA_NOTICE_TITLE } from "../legalContent";

export type AiDataNoticeProps = {
  /** 额外的 className，便于在不同入口微调样式。 */
  className?: string;
};

/**
 * AI 数据使用说明入口：一个 info 图标按钮，点开后弹出短说明。
 * 文案见 legalContent.ts（低焦虑、不出现内部字段名）。
 */
export function AiDataNotice({ className }: AiDataNoticeProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={["icon-button", "ai-data-notice-trigger", className].filter(Boolean).join(" ")}
        aria-label={AI_DATA_NOTICE_TITLE}
        title={AI_DATA_NOTICE_TITLE}
        onClick={() => setOpen(true)}
      >
        <Info size={18} />
      </button>

      {open ? (
        <div className="story-modal-backdrop ai-data-notice-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <div
            className="story-modal ai-data-notice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-data-notice-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="legal-doc-head">
              <h3 id="ai-data-notice-title">{AI_DATA_NOTICE_TITLE}</h3>
              <button type="button" className="icon-button" aria-label="关闭" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="ai-data-notice-body">
              {AI_DATA_NOTICE_PARAGRAPHS.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
