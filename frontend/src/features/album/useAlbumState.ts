// 相册(Album Tab)功能的状态与逻辑。
//
// 从 App.tsx 这个巨型组件里原样抽出 album 一族的 state / refs / memo / 处理函数,
// 行为与抽出前逐字节一致——只是搬家,不改运行时语义。
//
// 调用约定(Option B):App.tsx 在 `canCaregive` 之后「提前」调用本 hook,并把返回值
// 解构回与原来同名的局部变量,因此 App.tsx 里其余引用一律照常编译。
//
// ⚠️ album 与 chat 共享大量基础设施,抽取边界极其讲究:
//  - 预览子系统(previewAttachment / previewAlbumItem / previewMotion / ... 及其 setter、
//    手势/轮播/翻页一族)与 chat 附件预览共用,留在 App.tsx;本 hook 只接收它需要的
//    若干 setter(setPreviewAlbumItem / setPreviewAttachment)与共享只读 ref
//    (previewAlbumItemsRef)作为依赖。
//  - chat/媒体共享:attachments / setAttachments / mediaUploadItems / 共享上传管线
//    processSelectedMediaFiles 留在 App,按值/迟绑定注入。
//  - persistAlbumItemOptimistic / applyStateResponse / showSystemWeakNotice /
//    processSelectedMediaFiles 都在 App.tsx 里定义得比本 hook 的调用点晚,故统一经迟绑定
//    ref `lateRef` 注入(沿用 records 的 `recordsLateRef` 模式);App 在它们都就绪之后、
//    每次渲染都无条件刷新该 ref。persistAlbumItemOptimistic / applyStateResponse 同时被仍
//    留在 App 的 chat 侧代码(processSelectedMediaFiles / AI 提交流 / saveAlbumPrompt /
//    applyAppSnapshot)复用,故它们的「真身」留在 App,本 hook 只经 lateRef 借用。
//  - `deleteAppRecord` / `deleteAttachment` 是模块导入(全程可用),本 hook 直接 import。
//
// 与 ledger / reminders / records 抽取的偏差:
//  1) 不需要 ledger/reminders/records 那样的 `mutatorsRef`:本 hook 的搬出处理函数并不直接
//     调用 `persistRecord`(只经 persistAlbumItemOptimistic 间接调用,后者经 lateRef 注入),
//     而 `deleteAppRecord` 是模块导入。故四个迟绑定依赖统一收进单个 `lateRef`。
//  2) `MediaUploadTarget`("chat" | "album")是 App.tsx 模块内私有 union,未导出;
//     processSelectedMediaFiles 的依赖签名里把它就地内联为 `"chat" | "album"`,避免反向
//     import App(会成环)、也不必动 App.tsx 的类型声明。
//  3) `albumScreenHandlers`(喂给 memo 化 <AlbumScreen/> 的稳定函数包)经 ref 间接调用最新
//     实现,引用永远稳定——与 reminders 的 remindersScreenHandlers 同模式。原样搬入并返回,
//     保持引用稳定性,AlbumScreen 的 React.memo 继续命中。
import {
  type ChangeEvent,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { makeId } from "../../data";
import { MAX_ALBUM_PICKER_ATTACHMENTS } from "../../utils/uploadLimits";
import { isNativeMediaPickerAvailable, isNativeMediaPickerCancel, pickNativeMediaFiles } from "../../nativeMediaPicker";
import { appAlbumEdit, appConfirm } from "../../components/appDialogs";
import { openAlbumPhotoSwipe } from "../../albumPhotoSwipe";
import {
  albumCategoryLabel,
  albumMonthLabel,
  attachmentAspectRatio,
  buildDerivedAlbumItems,
  dedupeAlbumItems,
  isVisibleAlbumMedia,
} from "../../albumDomain";
import { creatorMetaText, formatFullDate, normalizeAlbumItem, splitListText } from "../../appStateDomain";
import { deleteAppRecord, deleteAttachment, type AppStateResponse } from "../../appStateApi";
import type { AlbumItem, AppStateSnapshot, Attachment, ChatMessage } from "../../types";
import type { MediaUploadItem } from "../../appContracts";

// persistAlbumItemOptimistic / applyStateResponse / showSystemWeakNotice /
// processSelectedMediaFiles 都在 App.tsx 调用点之后才就绪,经此迟绑定 ref 注入。
// `isUploadingAlbumMedia` 由 App 从本 hook 返回的 albumUploadItems 派生(故也在调用点之后),
// 同样经此 ref 注入:handleAlbumFiles / openAlbumMediaPicker 是每次渲染重建、并经
// albumScreenHandlersRef 永远指向「最新闭包」被调用的,故读 lateRef 的最新值与原本读当render
// 闭包捕获值在运行时等价(实际触发的永远是最新一次渲染的处理函数)。
export type AlbumLateDeps = {
  showSystemWeakNotice: (message: string, tone?: "info" | "success" | "warning", durationMs?: number) => void;
  applyStateResponse: (response: { state: Partial<AppStateSnapshot> }) => void;
  persistAlbumItemOptimistic: (item: AlbumItem) => Promise<AppStateResponse>;
  processSelectedMediaFiles: (files: File[], target: "chat" | "album") => Promise<void>;
  isUploadingAlbumMedia: boolean;
};

export type UseAlbumStateDeps = {
  canCaregive: boolean;
  messages: ChatMessage[];
  storedAlbumItemsNormalized: AlbumItem[];
  setAlbumItems: (action: SetStateAction<AlbumItem[]>) => void;
  mediaUploadItems: MediaUploadItem[];
  // 预览子系统 setter / 共享只读 ref(留在 App,按值注入)。
  previewAlbumItem: AlbumItem | null;
  setPreviewAlbumItem: (action: SetStateAction<AlbumItem | null>) => void;
  setPreviewAttachment: (action: SetStateAction<Attachment | null>) => void;
  setAttachments: (action: SetStateAction<Attachment[]>) => void;
  previewAlbumItemsRef: MutableRefObject<AlbumItem[]>;
  setStorageStatus: (status: "loading" | "ready" | "offline") => void;
  setMessages: (action: SetStateAction<ChatMessage[]>) => void;
  lateRef: MutableRefObject<AlbumLateDeps>;
};

export function useAlbumState({
  canCaregive,
  messages,
  storedAlbumItemsNormalized,
  setAlbumItems,
  mediaUploadItems,
  previewAlbumItem,
  setPreviewAlbumItem,
  setPreviewAttachment,
  setAttachments,
  previewAlbumItemsRef,
  setStorageStatus,
  setMessages,
  lateRef,
}: UseAlbumStateDeps) {
  const albumFileInputRef = useRef<HTMLInputElement>(null);

  const albumUploadItems = useMemo(
    () => mediaUploadItems.filter((item) => item.target === "album"),
    [mediaUploadItems],
  );

  const derivedAlbumItems = useMemo(() => buildDerivedAlbumItems(messages), [messages]);
  const albumItems = useMemo(
    () => dedupeAlbumItems([...storedAlbumItemsNormalized, ...derivedAlbumItems]).filter(isVisibleAlbumMedia),
    [storedAlbumItemsNormalized, derivedAlbumItems],
  );
  const filteredAlbumItems = useMemo(
    () => albumItems,
    [albumItems],
  );
  const albumGroups = useMemo(() => {
    const groups = new Map<string, AlbumItem[]>();
    filteredAlbumItems.forEach((item) => {
      const key = (item.occurredAt ?? item.date).slice(0, 7) || "unknown";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: albumMonthLabel(key),
      items,
    }));
  }, [filteredAlbumItems]);
  const albumPreviewItems = useMemo(
    () => filteredAlbumItems.filter((item) => item.attachment?.url),
    [filteredAlbumItems],
  );
  const [albumRatioOverrides, setAlbumRatioOverrides] = useState<Record<string, number>>({});
  // 合批:相册首次加载时几十张老照片密集 onLoad,逐张 setState 会逐张重渲染整棵树。
  // 缓冲 160ms 一次性合并提交,几十次渲染收敛为 1~2 次。
  const pendingAlbumRatiosRef = useRef<Record<string, number>>({});
  const albumRatioFlushTimerRef = useRef<number | null>(null);
  const recordAlbumRatio = useCallback((attachmentId: string, ratio: number) => {
    if (!attachmentId || !Number.isFinite(ratio) || ratio <= 0) return;
    pendingAlbumRatiosRef.current[attachmentId] = ratio;
    if (albumRatioFlushTimerRef.current !== null) return;
    albumRatioFlushTimerRef.current = window.setTimeout(() => {
      albumRatioFlushTimerRef.current = null;
      const pending = pendingAlbumRatiosRef.current;
      pendingAlbumRatiosRef.current = {};
      setAlbumRatioOverrides((current) => {
        let changed = false;
        const next = { ...current };
        for (const [id, value] of Object.entries(pending)) {
          if (!next[id]) {
            next[id] = value;
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }, 160);
  }, []);
  const albumTileAspect = useCallback(
    (item: AlbumItem) => {
      if (!item.attachment) return 1; // category-icon placeholder → square
      const measured = albumRatioOverrides[item.attachment.id];
      return attachmentAspectRatio(item.attachment, measured);
    },
    [albumRatioOverrides],
  );
  const previewAlbumIndex = previewAlbumItem
    ? albumPreviewItems.findIndex((item) => item.id === previewAlbumItem.id)
    : -1;
  const previewCarouselItems = previewAlbumIndex >= 0
    ? [
        albumPreviewItems[previewAlbumIndex - 1] ?? null,
        previewAlbumItem,
        albumPreviewItems[previewAlbumIndex + 1] ?? null,
      ]
    : [];
  const albumStats = useMemo(
    () => ({
      media: albumItems.length,
      videos: albumItems.filter((item) => item.attachment?.kind === "video").length,
      categories: new Set(albumItems.map((item) => item.category)).size,
    }),
    [albumItems],
  );

  // Album tile tap → 全屏预览,交给 PhotoSwipe(手势物理/开合 morph/缩放均由库承担;
  // 自研轮播/手势/FLIP 已存档于 tag archive/handcrafted-preview)。
  const openAlbumPreview = (_event: { currentTarget: HTMLButtonElement }, attachment: Attachment, item: AlbumItem) => {
    if (!attachment.url) return;
    void openAlbumPhotoSwipe({
      items: previewAlbumItemsRef.current,
      startId: item.id,
      getThumbEl: (id) => {
        const safe = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id;
        return document.querySelector<HTMLElement>(`[data-vt-item="${safe}"] img, [data-vt-item="${safe}"] video`);
      },
      formatDate: (entry) => `${formatFullDate(entry.date)} · ${albumCategoryLabel(entry.category)}`,
      getAspectRatio: (entry) => albumTileAspect(entry),
      formatRecordedBy: (recordedBy) => (recordedBy ? creatorMetaText(recordedBy) : ""),
      // 弹窗用深色变体且不关预览:编辑成功由 pswp 就地刷新顶栏,删除确认后才退出。
      onEdit: (entry) => editAlbumItem(entry, { dark: true }),
      onDelete: (entry) => removeAlbumItem(entry, { dark: true }),
    });
  };

  const handleAlbumFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canCaregive || lateRef.current.isUploadingAlbumMedia) {
      event.target.value = "";
      return;
    }
    await lateRef.current.processSelectedMediaFiles(Array.from(event.target.files ?? []), "album");
    event.target.value = "";
  };

  const openAlbumMediaPicker = async () => {
    if (!canCaregive || lateRef.current.isUploadingAlbumMedia) return;
    if (isNativeMediaPickerAvailable()) {
      try {
        const files = await pickNativeMediaFiles({ limit: MAX_ALBUM_PICKER_ATTACHMENTS });
        if (files.length) await lateRef.current.processSelectedMediaFiles(files, "album");
        return;
      } catch (error) {
        if (isNativeMediaPickerCancel(error)) return;
        console.warn("[native-media-picker] failed", error);
        const message = error instanceof Error ? error.message : "无法读取已选择的素材";
        lateRef.current.showSystemWeakNotice(`相册选择失败：${message}`, "warning", 3600);
        return;
      }
    }
    albumFileInputRef.current?.click();
  };

  // 返回更新后的条目(取消返回 null),供全屏预览就地刷新顶栏;dark=黑底预览内的深色弹窗。
  const editAlbumItem = async (item: AlbumItem, ui?: { dark?: boolean }): Promise<AlbumItem | null> => {
    if (!canCaregive) return null;
    const dark = ui?.dark ?? false;
    const edited = await appAlbumEdit({ title: item.title, tags: item.tags.join("、"), dark });
    if (edited === null) return null;
    const nextItem = normalizeAlbumItem(
      {
        ...item,
        title: edited.title.trim() || item.title,
        tags: splitListText(edited.tags),
        source: "manual",
      },
      0,
    );
    setAlbumItems((current) => dedupeAlbumItems([nextItem, ...current.filter((entry) => entry.id !== nextItem.id)]));
    setPreviewAlbumItem((current) => (current?.id === nextItem.id ? nextItem : current));
    void lateRef.current.persistAlbumItemOptimistic(nextItem).catch(() => undefined);
    return nextItem;
  };

  // 返回是否真的删了(取消返回 false),供全屏预览决定要不要退出;dark 同 editAlbumItem。
  const removeAlbumItem = async (item: AlbumItem, ui?: { dark?: boolean }): Promise<boolean> => {
    if (!canCaregive) return false;
    const confirmed = await appConfirm({ title: "删除素材", content: `删除「${item.title}」？会同时删除云端/本地存储里的原始素材和缩略图。`, confirmText: "删除", danger: true, dark: ui?.dark ?? false });
    if (!confirmed) return false;
    const attachmentId = item.attachmentId || item.attachment?.id || "";
    setAlbumItems((current) =>
      current.filter((entry) => entry.id !== item.id && (!attachmentId || entry.attachmentId !== attachmentId)),
    );
    setPreviewAlbumItem((current) => (current?.id === item.id ? null : current));
    if (attachmentId) {
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
      setPreviewAttachment((current) => (current?.id === attachmentId ? null : current));
      setPreviewAlbumItem((current) => (current?.id === item.id || current?.attachmentId === attachmentId ? null : current));
    }
    try {
      if (attachmentId) {
        const response = await deleteAttachment(attachmentId);
        lateRef.current.applyStateResponse(response);
      } else {
        const response = await deleteAppRecord("albumItems", item.id);
        lateRef.current.applyStateResponse(response);
      }
    } catch (error) {
      setStorageStatus("offline");
      setMessages((current) => [
        ...current,
        {
          id: makeId("msg"),
          role: "ai",
          text: error instanceof Error ? `素材删除失败：${error.message}` : "素材删除失败，请稍后再试。",
          createdAt: new Date().toISOString(),
          tags: ["系统"],
        },
      ]);
    }
    // 本地 UI 已乐观移除(失败也有系统消息兜底),对调用方而言条目已不在。
    return true;
  };

  // AlbumScreen(memo)的函数 props:经 ref 间接调用最新实现,引用永远稳定——
  // 否则 App 每次渲染重建闭包,memo 形同虚设。
  const albumScreenHandlersRef = useRef({ handleAlbumFiles, openAlbumMediaPicker, openAlbumPreview });
  albumScreenHandlersRef.current = { handleAlbumFiles, openAlbumMediaPicker, openAlbumPreview };
  const [albumScreenHandlers] = useState(() => ({
    onPickFiles: (event: ChangeEvent<HTMLInputElement>) => {
      void albumScreenHandlersRef.current.handleAlbumFiles(event);
    },
    onOpenPicker: () => {
      void albumScreenHandlersRef.current.openAlbumMediaPicker();
    },
    onOpenPreview: (event: { currentTarget: HTMLButtonElement }, attachment: Attachment, item: AlbumItem) => {
      albumScreenHandlersRef.current.openAlbumPreview(event, attachment, item);
    },
  }));

  return {
    albumFileInputRef,
    albumUploadItems,
    derivedAlbumItems,
    albumItems,
    filteredAlbumItems,
    albumGroups,
    albumPreviewItems,
    albumRatioOverrides,
    setAlbumRatioOverrides,
    pendingAlbumRatiosRef,
    albumRatioFlushTimerRef,
    recordAlbumRatio,
    albumTileAspect,
    previewAlbumIndex,
    previewCarouselItems,
    albumStats,
    openAlbumPreview,
    handleAlbumFiles,
    openAlbumMediaPicker,
    editAlbumItem,
    removeAlbumItem,
    albumScreenHandlers,
  };
}
