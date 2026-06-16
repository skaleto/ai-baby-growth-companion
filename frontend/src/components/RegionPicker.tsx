import { memo } from "react";
import type { RegionCode } from "../data/vaccineSchedule.fallback";

const REGIONS: { code: RegionCode; label: string }[] = [
  { code: "national", label: "全国(仅一类)" },
  { code: "BJ", label: "北京" }, { code: "SH", label: "上海" }, { code: "GD", label: "广东" },
  { code: "ZJ", label: "浙江" }, { code: "JS", label: "江苏" },
];

export const RegionPicker = memo(function RegionPicker({ value, onChange, disabled }: {
  value: RegionCode; onChange: (code: RegionCode) => void; disabled?: boolean;
}) {
  return (
    <div className="vaccine-region">
      <span className="vaccine-region__label">接种地</span>
      <div className="vaccine-region__chips">
        {REGIONS.map((r) => (
          <button key={r.code} type="button" disabled={disabled} aria-pressed={value === r.code}
            className={`vaccine-region__chip${value === r.code ? " on" : ""}`}
            onClick={() => onChange(r.code)}>{r.label}</button>
        ))}
      </div>
    </div>
  );
});
