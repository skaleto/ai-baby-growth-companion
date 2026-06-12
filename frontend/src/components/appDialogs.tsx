// 应用级弹窗助手(antd-mobile,5.1 选型):替换系统 window.prompt/confirm——
// 安卓 WebView 的系统弹窗样式不可控且丑。命令式 API,调用点一行换。
import { Dialog, Input } from "antd-mobile";

export function appConfirm(options: { title?: string; content: string; confirmText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    void Dialog.confirm({
      title: options.title,
      content: options.content,
      confirmText: options.confirmText ?? "确定",
      cancelText: "取消",
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

export function appAlert(content: string, title?: string): Promise<void> {
  return new Promise((resolve) => {
    void Dialog.alert({ title, content, confirmText: "知道了", onConfirm: () => resolve() });
  });
}

export function appPrompt(options: {
  title: string;
  defaultValue?: string;
  placeholder?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    let value = options.defaultValue ?? "";
    void Dialog.confirm({
      title: options.title,
      content: (
        <Input
          autoFocus
          defaultValue={value}
          placeholder={options.placeholder}
          onChange={(next) => {
            value = next;
          }}
        />
      ),
      confirmText: "确定",
      cancelText: "取消",
      onConfirm: () => resolve(value),
      onCancel: () => resolve(null),
    });
  });
}
