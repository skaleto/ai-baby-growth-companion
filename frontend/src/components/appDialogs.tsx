// 应用级弹窗助手(5.1 选型 + 2026-06-13「暗夜毛玻璃」定稿):替换系统 prompt/confirm。
// 统一一套语言:图标 chip 头 + 暖卡 + 并排胶囊按钮(取消=描边、确定=实心 sage、删除=实心 coral)。
// 命令式 API,调用点一行换。样式覆盖见 styles/vendor-mobile.css 的 .app-dialog / .app-dialog-dark。
import type { CSSProperties } from "react";
import { Dialog, Input } from "antd-mobile";
import { PencilLine, Trash2 } from "lucide-react";

// 深色变体:给黑底全屏预览(PhotoSwipe / 媒体预览)内的弹窗用——白卡片在纯黑详情页上突兀。
// pswp 根层 z-index 是 100000(photoswipe.css --pswp-root-z-index),默认 1000 的弹窗会被
// 整个盖住,必须一并把 --z-index 提到其上。
function baseProps(dark?: boolean) {
  return {
    bodyClassName: `app-dialog${dark ? " app-dialog-dark" : ""}`,
    ...(dark ? { style: { "--z-index": "100001" } as CSSProperties } : null),
  };
}

function DialogIcon({ kind }: { kind: "edit" | "danger" }) {
  return (
    <span className={`app-dialog-icn app-dialog-icn-${kind}`} aria-hidden="true">
      {kind === "danger" ? <Trash2 size={20} /> : <PencilLine size={18} />}
    </span>
  );
}

export function appConfirm(options: { title?: string; content: string; confirmText?: string; danger?: boolean; dark?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    Dialog.show({
      ...baseProps(options.dark),
      // 危险操作(删除)给一枚珊瑚色圆形图标,普通确认无图标。
      ...(options.danger ? { header: <DialogIcon kind="danger" /> } : null),
      title: options.title,
      content: options.content,
      closeOnAction: true,
      closeOnMaskClick: true,
      onClose: () => resolve(false),
      // 用稳定的自定义 class 控样式,绕开 antd 的 danger 行内 color(会盖住实心底上的白字)。
      actions: [[
        { key: "cancel", text: "取消", className: "app-dlg-cancel", onClick: () => resolve(false) },
        { key: "confirm", text: options.confirmText ?? "确定", className: options.danger ? "app-dlg-danger" : "app-dlg-primary", onClick: () => resolve(true) },
      ]],
    });
  });
}

export function appAlert(content: string, title?: string): Promise<void> {
  return new Promise((resolve) => {
    Dialog.show({
      ...baseProps(false),
      title,
      content,
      closeOnAction: true,
      onClose: () => resolve(),
      actions: [[{ key: "ok", text: "知道了", className: "app-dlg-primary", onClick: () => resolve() }]],
    });
  });
}

// 通用单字段输入(取消返回 null)。沿用新弹窗样式族。
export function appPrompt(options: { title: string; placeholder?: string; defaultValue?: string; dark?: boolean }): Promise<string | null> {
  return new Promise((resolve) => {
    let value = options.defaultValue ?? "";
    Dialog.show({
      ...baseProps(options.dark),
      title: options.title,
      content: (
        <div className="app-dialog-form">
          <label className="app-dialog-field">
            <Input autoFocus defaultValue={value} placeholder={options.placeholder} onChange={(next) => { value = next; }} />
          </label>
        </div>
      ),
      closeOnAction: true,
      closeOnMaskClick: true,
      onClose: () => resolve(null),
      actions: [[
        { key: "cancel", text: "取消", className: "app-dlg-cancel", onClick: () => resolve(null) },
        { key: "confirm", text: "确定", className: "app-dlg-primary", onClick: () => resolve(value) },
      ]],
    });
  });
}

// 相册「编辑回忆」:名称 + 标签并入一张表单(替代旧的连弹两次 prompt)。
export function appAlbumEdit(options: { title: string; tags: string; dark?: boolean }): Promise<{ title: string; tags: string } | null> {
  return new Promise((resolve) => {
    // 受控值用闭包暂存:content 仅渲染一次,onChange 持续回写,确认时读快照。
    const draft = { title: options.title, tags: options.tags };
    Dialog.show({
      ...baseProps(options.dark),
      header: (
        <div className="app-dialog-head">
          <DialogIcon kind="edit" />
          <b>编辑回忆</b>
        </div>
      ),
      content: (
        <div className="app-dialog-form">
          <label className="app-dialog-field">
            <span>名称</span>
            <Input autoFocus defaultValue={draft.title} placeholder="给这段回忆起个名字" onChange={(value) => { draft.title = value; }} />
          </label>
          <label className="app-dialog-field">
            <span>标签</span>
            <Input defaultValue={draft.tags} placeholder="用顿号或逗号分隔" onChange={(value) => { draft.tags = value; }} />
          </label>
        </div>
      ),
      closeOnAction: true,
      closeOnMaskClick: true,
      onClose: () => resolve(null),
      actions: [[
        { key: "cancel", text: "取消", className: "app-dlg-cancel", onClick: () => resolve(null) },
        { key: "save", text: "保存", className: "app-dlg-primary", onClick: () => resolve({ title: draft.title, tags: draft.tags }) },
      ]],
    });
  });
}
