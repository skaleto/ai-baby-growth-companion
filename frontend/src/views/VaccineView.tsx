import { ChevronLeft, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { getVaccineDataSync } from "../vaccineData";
import { computeDoseStatus, pendingCount, vaccineDosesForRegion } from "../vaccineStatus";
import type { DoseStatus, RegionCode, VaccineDose } from "../data/vaccineSchedule.fallback";
import { RegionPicker } from "../components/RegionPicker";
import { monthsBetween } from "../utils/babyAge";
import type { BabyProfile } from "../types";

const STATUS_LABEL: Record<DoseStatus, string> = {
  done: "已接种", overdue: "已过期·建议补", closing: "窗口将过·尽快约", due: "现在可约", upcoming: "还没到",
};
const STATUS_ORDER: Record<DoseStatus, number> = { closing: 0, overdue: 1, due: 2, upcoming: 3, done: 4 };

export type VaccineViewProps = {
  profile: BabyProfile;
  canCaregive: boolean;
  onClose: () => void;
  onSetRegion: (code: RegionCode) => void;
  onToggleDose: (doseId: string, done: boolean) => void;
};

export function VaccineView({ profile, canCaregive, onClose, onSetRegion, onToggleDose }: VaccineViewProps) {
  // 本次进入固定一份数据(getVaccineDataSync 每次都 JSON.parse 出新引用,不锁住会让下面的 rows useMemo 失效)。
  // 后台 refreshVaccineData 拉到的新版按设计「下次进入生效」,故空依赖即可。
  const data = useMemo(() => getVaccineDataSync(), []);
  const region = (profile.vaccineRegion as RegionCode) || "national";
  const ageMonths = useMemo(() => monthsBetween(profile.birthDate) ?? null, [profile.birthDate]);
  const doneById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of profile.vaccineRecords ?? []) map.set(r.doseId, r.date);
    return map;
  }, [profile.vaccineRecords]);

  const rows = useMemo(() => {
    const doses = vaccineDosesForRegion(data.doses, region);
    const withStatus = doses.map((dose) => {
      const doneDate = doneById.get(dose.id) ?? null;
      const status = computeDoseStatus({ ageMonths, ageMonthMin: dose.ageMonthMin, ageMonthMax: dose.ageMonthMax, doneDate });
      return { dose, status, doneDate };
    });
    withStatus.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.dose.ageMonthMin - b.dose.ageMonthMin);
    return withStatus;
  }, [data, region, ageMonths, doneById]);

  const pending = pendingCount(rows.map((r) => r.status));
  const priceText = (dose: VaccineDose): string => {
    if (dose.klass !== "optional") return "";
    const ps = data.prices.filter((p) => p.doseVaccine === dose.vaccine && (p.region === region || p.region === "national"));
    if (!ps.length) return "咨询接种点";
    return ps.map((p) => `¥${p.price}${p.tier === "domestic" ? "(国产)" : p.tier === "imported" ? "(进口)" : ""}`).join(" / ");
  };

  return (
    <section className="vaccine-screen" aria-label="疫苗接种清单">
      <div className="milestone-head">
        <button type="button" className="milestone-back" onClick={onClose} aria-label="返回"><ChevronLeft size={20} /></button>
        <div><p className="eyebrow">疫苗接种</p><h2>{profile.nickname || "小宝"}的接种清单</h2></div>
      </div>

      <RegionPicker value={region} onChange={onSetRegion} disabled={!canCaregive} />

      <div className="vaccine-summary">
        <span>{profile.birthDate ? `当前月龄约 ${ageMonths ?? "-"} 月` : "未设生日,仅作参考"}</span>
        {pending > 0 ? <span className="vaccine-summary__pending">本阶段 {pending} 针待安排</span> : null}
      </div>

      <p className="milestone-disclaimer"><ShieldAlert size={14} />
        <span>本清单仅供参考,各地程序与价格略有差异,以当地接种点 / 居住地疾控安排为准,不构成医疗建议。</span></p>

      <div className="vaccine-list">
        {rows.map(({ dose, status, doneDate }) => (
          <article key={dose.id} className={`vaccine-card ${status} klass-${dose.klass}`}>
            <div className="vaccine-card__main">
              <div className="vaccine-card__head">
                <span className="vaccine-card__name">{dose.vaccine} · 第{dose.doseNo}剂</span>
                <span className="vaccine-card__tag">{dose.klass === "nip" || dose.klass === "provincial" ? "免费" : "自费"}</span>
              </div>
              <p className="vaccine-card__intro">{dose.intro}</p>
              <div className="vaccine-card__meta">
                <span>{dose.ageMonthMin}-{dose.ageMonthMax} 月龄</span>
                <span className={`vaccine-card__status ${status}`}>{STATUS_LABEL[status]}{status === "done" && doneDate ? ` · ${doneDate}` : ""}</span>
                {dose.klass === "optional" ? <span className="vaccine-card__price">{priceText(dose)}</span> : null}
              </div>
            </div>
            {canCaregive ? (
              <button type="button" className={`vaccine-card__cta${status === "done" ? " undo" : ""}`}
                onClick={() => onToggleDose(dose.id, status !== "done")}>
                {status === "done" ? "撤销" : "已接种"}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
