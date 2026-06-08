import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { LegalDocId } from "../legalContent";
import { LegalDocModal } from "./LegalDocModal";
import { AuthScene } from "./AuthScene";
import { AuthBrand } from "./AuthBrand";

export type ConsentGateProps = {
  /** 用户勾选监护人确认并点击“同意并继续”后调用。 */
  onAccept: () => void;
};

/**
 * 首登知情同意页（内测精简版）。
 * - 隐私政策 / 用户协议入口（点开看摘要静态页）。
 * - 内测阶段一句说明。
 * - 监护人确认勾选。
 * - 必须勾选才能“同意并继续”。
 * 渲染为全屏遮罩，挡住下方所有内容，直到用户同意。
 */
export function ConsentGate({ onAccept }: ConsentGateProps) {
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [openDoc, setOpenDoc] = useState<LegalDocId | null>(null);

  return (
    <div className="consent-gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="consent-gate-title">
      <AuthScene />
      <AuthBrand />
      <div className="consent-gate-card">
        <div className="consent-gate-badge" aria-hidden="true">
          <ShieldCheck size={26} />
        </div>
        <div className="consent-gate-copy">
          <p className="eyebrow">开始之前</p>
          <h1 id="consent-gate-title">欢迎来到小宝记</h1>
          <p>这里帮你记录和陪伴宝宝的成长。开始前，先简单了解几件事。</p>
        </div>

        <p className="consent-beta-note">
          目前是内测阶段，可能不太稳定。它不是医疗工具，请不要据此做医疗决策。
        </p>

        <p className="consent-links-intro">
          继续即表示你已阅读并同意我们的
          <button type="button" className="consent-link" onClick={() => setOpenDoc("privacy")}>
            隐私政策
          </button>
          和
          <button type="button" className="consent-link" onClick={() => setOpenDoc("terms")}>
            用户协议
          </button>
          。
        </p>

        <label className="consent-guardian-check">
          <input
            type="checkbox"
            checked={guardianConfirmed}
            onChange={(event) => setGuardianConfirmed(event.target.checked)}
          />
          <span>我是宝宝的监护人，或已获得监护人同意。</span>
        </label>

        <button
          type="button"
          className="consent-accept-button"
          disabled={!guardianConfirmed}
          onClick={onAccept}
        >
          同意并继续
        </button>
      </div>

      {openDoc ? <LegalDocModal docId={openDoc} onClose={() => setOpenDoc(null)} /> : null}
    </div>
  );
}
