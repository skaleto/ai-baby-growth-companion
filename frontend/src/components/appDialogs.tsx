// 应用级弹窗助手(antd-mobile,5.1 选型):替换系统 window.prompt/confirm——
// 安卓 WebView 的系统弹窗样式不可控且丑。命令式 API,调用点一行换。
import type { CSSProperties } from "react";
import { Dialog, Input } from "antd-mobile";

// 深色变体:给黑底全屏预览(PhotoSwipe / 媒体预览)内的弹窗用——白卡片在纯黑详情页上突兀。
// pswp 根层 z-index 是 100000(photoswipe.css --pswp-root-z-index),默认 1000 的弹窗会被
// 整个盖住,必须一并把 --z-index 提到其上。样式覆盖见 styles/vendor-mobile.css 的 .app-dialog-dark。
const DARK_DIALOG_PROPS = {
  bodyClassName: "app-dialog-dark",
  style: { "--z-index": "100001" } as CSSProperties,
};

export function appConfirm(options: { title?: string; content: string; confirmText?: string; danger?: boolean; dark?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    void Dialog.confirm({
      ...(options.dark ? DARK_DIALOG_PROPS : null),
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
  dark?: boolean;
}): Promise<string | null> {
  return new Promise((resolve) => {
    let value = options.defaultValue ?? "";
    void Dialog.confirm({
      ...(options.dark ? DARK_DIALOG_PROPS : null),
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
