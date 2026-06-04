import { X } from "lucide-react";
import type { LegalDocId } from "../legalContent";
import { LEGAL_DOCS } from "../legalContent";

export type LegalDocModalProps = {
  docId: LegalDocId;
  onClose: () => void;
};

/**
 * 只读的静态法律/说明文本查看器（内测精简版）。
 * 文本来自 legalContent.ts 的要点摘要。
 */
export function LegalDocModal({ docId, onClose }: LegalDocModalProps) {
  const doc = LEGAL_DOCS[docId];
  const titleId = `legal-doc-${docId}-title`;

  return (
    <div className="story-modal-backdrop legal-doc-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="story-modal legal-doc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="legal-doc-head">
          <h3 id={titleId}>{doc.title}</h3>
          <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="legal-doc-body">
          {doc.sections.map((section) => (
            <section key={section.heading} className="legal-doc-section">
              <h4>{section.heading}</h4>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </section>
          ))}
          <p className="legal-doc-footnote">{doc.footnote}</p>
        </div>
      </div>
    </div>
  );
}
