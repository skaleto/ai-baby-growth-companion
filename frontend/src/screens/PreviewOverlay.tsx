// 全屏媒体预览浮层(自 App.tsx 上帝类拆出——架构债 D1,分类法 D12:整屏/顶层渲染块进 screens/)。
// 内含:附件大图/视频查看器 + 相册项左右滑动轮播(media-preview-carousel)+ 顶栏(关闭/信息/更多操作)。
// 同时服务两条来源——聊天附件(previewAttachment 直开)与相册项(previewAlbumItem,带轮播/翻页/编辑删除)。
//
// React.memo:App 本体在无关 setState(打字 / 聊天流式等)时不再带着这块全屏预览树重渲。
// memo 生效前提——函数 props 引用稳定:App 侧经 previewOverlayHandlers 的 ref 包装保证(镜像 appDialogsHandlers)。
// 数据 props(previewAttachment / previewAlbumItem / previewTransform / previewMotion 等)合理变化时会重渲本块,这是正确的。
// DOM 结构与拆分前逐字一致(CSS/快照测试不感知)——纯移动,非重写。
//
// 手势/翻页/缩放的全部 handler 与 state 留在 App(经 features/preview/usePreviewState 抽出),
// 本组件只做「受控视图」:接收状态 + 稳定 handler 包,原样渲染。previewCarouselTrackRef 由 App 持有并经
// props 透传(手势数学直接读写该 DOM),故这里以 ref prop 形式接收。
import { memo, type CSSProperties, type RefObject } from "react";
import { MoreHorizontal, PencilLine, Trash2, X } from "lucide-react";
import { CachedImg } from "../components/CachedMedia";
import { PreviewVideoPlayer } from "../components/PreviewVideoPlayer";
import { albumCategoryLabel } from "../albumDomain";
import { creatorMetaText, formatFullDate } from "../appStateDomain";
import type { AlbumItem, Attachment } from "../types";
import type { PreviewMotion, PreviewOriginRect } from "../features/preview/usePreviewState";

// App 侧经 ref 包装、引用永远稳定的函数 props(同 appDialogsHandlers 的间接模式)。
export type PreviewOverlayHandlers = {
  handlePreviewClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  closePreviewAttachment: () => void;
  setPreviewActionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // 与 useAlbumState 里的真身签名逐字对齐(编辑返回更新后的项或 null,删除返回是否删成);
  // 浮层里只以 `void editAlbumItem(...)` 触发,不消费返回值,但类型必须匹配。
  editAlbumItem: (item: AlbumItem, ui?: { dark?: boolean }) => Promise<AlbumItem | null>;
  removeAlbumItem: (item: AlbumItem, ui?: { dark?: boolean }) => Promise<boolean>;
  bindPreviewVideo: (node: HTMLVideoElement | null) => void;
  onPreviewStagePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPreviewStagePointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPreviewStagePointerEnd: (event: React.PointerEvent<HTMLElement>) => void;
  onPreviewImagePointerDown: (event: React.PointerEvent<HTMLImageElement>) => void;
  onPreviewImagePointerMove: (event: React.PointerEvent<HTMLImageElement>) => void;
  onPreviewImagePointerEnd: (event: React.PointerEvent<HTMLImageElement>) => void;
};

export type PreviewOverlayProps = {
  previewAttachment: Attachment | null;
  previewAlbumItem: AlbumItem | null;
  previewMotion: PreviewMotion;
  previewOriginRect: PreviewOriginRect | null;
  previewActionsOpen: boolean;
  previewTransform: { scale: number; x: number; y: number };
  previewCarouselItems: Array<AlbumItem | null>;
  previewCarouselTrackRef: RefObject<HTMLDivElement | null>;
  previewVt: boolean;
  canCaregive: boolean;
  handlers: PreviewOverlayHandlers;
};

export const PreviewOverlay = memo(function PreviewOverlay({
  previewAttachment,
  previewAlbumItem,
  previewMotion,
  previewOriginRect,
  previewActionsOpen,
  previewTransform,
  previewCarouselItems,
  previewCarouselTrackRef,
  previewVt,
  canCaregive,
  handlers,
}: PreviewOverlayProps) {
  const {
    handlePreviewClick,
    closePreviewAttachment,
    setPreviewActionsOpen,
    editAlbumItem,
    removeAlbumItem,
    bindPreviewVideo,
    onPreviewStagePointerDown,
    onPreviewStagePointerMove,
    onPreviewStagePointerEnd,
    onPreviewImagePointerDown,
    onPreviewImagePointerMove,
    onPreviewImagePointerEnd,
  } = handlers;

  if (!previewAttachment?.url) return null;

  return (
    <div
      className={`media-preview ${previewMotion}${previewVt ? " vt-mode" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="附件预览"
      style={
        previewOriginRect
          ? ({
              "--preview-flip": `translate(${previewOriginRect.left}px, ${previewOriginRect.top}px) scale(${
                previewOriginRect.width / (window.innerWidth || 1)
              }, ${previewOriginRect.height / (window.innerHeight || 1)})`,
              "--preview-to": "top left",
            } as CSSProperties)
          : undefined
      }
      onClick={handlePreviewClick}
    >
      <div className="media-preview-topbar" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="preview-close"
          aria-label="关闭"
          onClick={(event) => {
            event.stopPropagation();
            closePreviewAttachment();
          }}
        >
          <X size={20} />
        </button>
        {previewAlbumItem ? (
          <div className="media-preview-topinfo">
            <strong>{previewAlbumItem.title}</strong>
            <span>{formatFullDate(previewAlbumItem.date)} · {albumCategoryLabel(previewAlbumItem.category)}</span>
            {previewAlbumItem.recordedBy ? <small>{creatorMetaText(previewAlbumItem.recordedBy)}</small> : null}
          </div>
        ) : null}
        {previewAlbumItem && canCaregive ? (
          <div className="media-preview-menu">
            <button
              type="button"
              className="preview-menu-button"
              aria-label="更多操作"
              aria-expanded={previewActionsOpen}
              onClick={(event) => {
                event.stopPropagation();
                setPreviewActionsOpen((open) => !open);
              }}
            >
              <MoreHorizontal size={20} />
            </button>
            {previewActionsOpen ? (
              <div className="preview-menu-popover">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewActionsOpen(false);
                    void editAlbumItem(previewAlbumItem, { dark: true });
                  }}
                >
                  <PencilLine size={15} />
                  编辑
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewActionsOpen(false);
                    void removeAlbumItem(previewAlbumItem, { dark: true });
                  }}
                >
                  <Trash2 size={15} />
                  删除
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <figure
        className={previewAlbumItem ? "album-preview-figure" : undefined}
        onPointerDown={onPreviewStagePointerDown}
        onPointerMove={onPreviewStagePointerMove}
        onPointerUp={onPreviewStagePointerEnd}
        onPointerCancel={onPreviewStagePointerEnd}
      >
        {previewAlbumItem && previewCarouselItems.length ? (
          <div className="media-preview-carousel">
            <div className="media-preview-track" ref={previewCarouselTrackRef}>
              {previewCarouselItems.map((item, index) => {
                const attachment = item?.attachment;
                const isCurrent = item?.id === previewAlbumItem.id;
                return (
                  <div className={`media-preview-slide ${isCurrent ? "current" : ""} ${attachment ? "" : "empty"}`} key={item ? `preview-slide-${item.id}` : `preview-slot-${index}`}>
                    {attachment?.url ? (
                      attachment.kind === "video" ? (
                        isCurrent ? (
                          <PreviewVideoPlayer attachment={attachment} active bindVideo={bindPreviewVideo} />
                        ) : (
                          <CachedImg src={attachment.thumbnailUrl || attachment.url} alt={attachment.name} draggable={false} />
                        )
                      ) : (
                        <CachedImg
                          className={isCurrent && previewTransform.scale > 1 ? "is-zoomed" : ""}
                          src={attachment.url}
                          alt={attachment.name}
                          draggable={false}
                          style={isCurrent
                            ? {
                                transform: `translate3d(${previewTransform.x}px, ${previewTransform.y}px, 0) scale(${previewTransform.scale})`,
                              }
                            : undefined}
                          onPointerDown={isCurrent ? onPreviewImagePointerDown : undefined}
                          onPointerMove={isCurrent ? onPreviewImagePointerMove : undefined}
                          onPointerUp={isCurrent ? onPreviewImagePointerEnd : undefined}
                          onPointerCancel={isCurrent ? onPreviewImagePointerEnd : undefined}
                        />
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : previewAttachment.kind === "video" ? (
          <PreviewVideoPlayer attachment={previewAttachment} active bindVideo={bindPreviewVideo} />
        ) : (
          <CachedImg
            className={previewTransform.scale > 1 ? "is-zoomed" : ""}
            src={previewAttachment.url}
            alt={previewAttachment.name}
            draggable={false}
            style={{
              transform: `translate3d(${previewTransform.x}px, ${previewTransform.y}px, 0) scale(${previewTransform.scale})`,
            }}
            onPointerDown={onPreviewImagePointerDown}
            onPointerMove={onPreviewImagePointerMove}
            onPointerUp={onPreviewImagePointerEnd}
            onPointerCancel={onPreviewImagePointerEnd}
          />
        )}
      </figure>
    </div>
  );
});
