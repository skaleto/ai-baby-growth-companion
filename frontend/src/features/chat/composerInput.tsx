// 聊天 composer 输入的独立 external store(架构债 D1 / 性能杠杆:把"逐键 setState"从 App 上帝组件移出)。
//
// 背景:打字时 input 状态在 App 上,每个字符触发 App 整体重渲——157 个闭包重建、39 个 useMemo 重算,
// 即便子屏已 memo,App 本体这趟仍然跑满。把 input 挪到 external store 后,只有订阅它的 <ComposerTextarea>
// 随打字重渲,App 本体不再每键重跑。
//
// IME 安全:textarea 仍是「受控组件」(value 来自 store、onChange 写 store→通知→重渲带回新值),
// 组合态/光标语义与拆分前逐字节一致;唯一变化是重渲范围从整个 App 收窄到这一个组件。
import React, { useSyncExternalStore } from "react";

let currentValue = "";
const listeners = new Set<() => void>();

export const composerInput = {
  get: (): string => currentValue,
  set: (next: string): void => {
    if (next === currentValue) return;
    currentValue = next;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// 兼容旧 `inputValueRef.current` 读写的稳定代理:读写都走 store,App 里 13 处 inputValueRef.current 一字不改。
export const composerInputRef = {
  get current(): string {
    return composerInput.get();
  },
  set current(next: string) {
    composerInput.set(next);
  },
};

export const useComposerInputValue = (): string =>
  useSyncExternalStore(composerInput.subscribe, composerInput.get, composerInput.get);

type ComposerTextareaProps = {
  rows?: number;
  placeholder: string;
  disabled?: boolean;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

// 唯一随打字重渲的组件(memo + 订阅 store)。
export const ComposerTextarea = React.memo(function ComposerTextarea({
  rows = 1,
  placeholder,
  disabled,
  onKeyDown,
}: ComposerTextareaProps) {
  const value = useComposerInputValue();
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(event) => composerInput.set(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
});
