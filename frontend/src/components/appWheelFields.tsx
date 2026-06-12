// 日期/时间滚轮字段(antd-mobile,5.1 选型):替换原生 <input type="date|time">——
// 系统控件在安卓上样式不可控。外观沿用应用输入框风格(.app-wheel-field),
// 点击弹滚轮;onChange 直接给字符串(YYYY-MM-DD / HH:mm),调用点一行换。
import { useMemo, useState } from "react";
import { DatePicker, Picker } from "antd-mobile";

type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** 透传 class(覆盖式日期入口沿用原定位样式)。 */
  className?: string;
  /** 覆盖式入口:按钮只作点击面(外层已有展示文案)。 */
  overlay?: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

const parseDate = (value: string): Date => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export function AppDateField({ value, onChange, disabled, placeholder = "选择日期", className, overlay }: FieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={overlay ? className : `app-wheel-field${className ? ` ${className}` : ""}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {overlay ? null : value || <span className="app-wheel-placeholder">{placeholder}</span>}
      </button>
      <DatePicker
        visible={open}
        value={parseDate(value)}
        precision="day"
        min={new Date(2015, 0, 1)}
        max={new Date(2040, 11, 31)}
        onClose={() => setOpen(false)}
        onConfirm={(picked) => {
          onChange(`${picked.getFullYear()}-${pad(picked.getMonth() + 1)}-${pad(picked.getDate())}`);
        }}
        confirmText="确定"
        cancelText="取消"
      />
    </>
  );
}

const HOUR_COLUMN = Array.from({ length: 24 }, (_, hour) => ({ label: pad(hour), value: pad(hour) }));
const MINUTE_COLUMN = Array.from({ length: 60 }, (_, minute) => ({ label: pad(minute), value: pad(minute) }));

export function AppTimeField({ value, onChange, disabled, placeholder = "选择时间", className }: FieldProps) {
  const [open, setOpen] = useState(false);
  const pickerValue = useMemo(() => {
    const [hour = "09", minute = "00"] = (value || "").split(":");
    return [pad(Number(hour) || 0), pad(Number(minute) || 0)];
  }, [value]);
  return (
    <>
      <button
        type="button"
        className={`app-wheel-field${className ? ` ${className}` : ""}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {value || <span className="app-wheel-placeholder">{placeholder}</span>}
      </button>
      <Picker
        visible={open}
        columns={[HOUR_COLUMN, MINUTE_COLUMN]}
        value={pickerValue}
        onClose={() => setOpen(false)}
        onConfirm={(picked) => {
          onChange(`${picked[0] ?? "09"}:${picked[1] ?? "00"}`);
        }}
        confirmText="确定"
        cancelText="取消"
      />
    </>
  );
}
