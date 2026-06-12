// 相册 Tab(从 App.tsx 单体中拆出,架构债 D1)。
// React.memo:聊天输入/其他 Tab 的任何 setState 不再重渲染整个相册网格。
// memo 生效前提:函数 props 必须引用稳定——App 侧经 ref 包装(albumScreenHandlers),
// 数据 props 均为 useMemo/state 产物。DOM 结构与拆分前逐字一致(CSS/手势测试不感知)。
import { memo, useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type RefObject } from "react";
import { Camera as CameraIcon, Image as ImageIcon, PencilLine, Trash2, Video } from "lucide-react";
import type { AlbumItem, Attachment, AlbumItemCategory } from "../types";
import { attachmentListSrc, distributeIntoColumns } from "../albumDomain";
import { albumCategoryIconSrc } from "./albumIcons";
import { AlbumVideoThumbnail } from "./AlbumVideoThumbnail";
import { CachedImg } from "./CachedMedia";
import { observeViewportWindow, prefetchAlbumVideo } from "./albumVideoPlayback";
import { preloadLocalMediaUrls } from "../mediaCache";
import { hapticLight } from "../haptics";
import growthIcon from "../assets/storybook-icons/growth.png";

type AlbumUploadListItem = {
  id: string;
  kind: string;
  name: string;
  status: string;
  progress: number;
  message?: string | null;
};

type AlbumGroup = { key: string; label: string; items: AlbumItem[] };

export type AlbumScreenProps = {
  canCaregive: boolean;
  isUploadingAlbumMedia: boolean;
  albumStats: { media: number; videos: number; categories: number };
  albumUploadItems: AlbumUploadListItem[];
  albumGroups: AlbumGroup[];
  albumFileInputRef: RefObject<HTMLInputElement | null>;
  albumTileAspect: (item: AlbumItem) => number;
  onPickFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenPicker: () => void;
  onOpenPreview: (event: { currentTarget: HTMLButtonElement }, attachment: Attachment, item: AlbumItem) => void;
  onEditItem: (item: AlbumItem) => void;
  onDeleteItem: (item: AlbumItem) => void;
  onRecordRatio: (attachmentId: string, ratio: number) => void;
};

/** 长按 tile 弹出的编辑/删除气泡:fixed 定位坐标在长按瞬间从 tile rect 计算。 */
type TileMenuState = { item: AlbumItem; top: number; centerX: number; below: boolean };

// 首组每列前 8 个 tile 首帧即挂媒体(约两屏),其余进入 ±150% 视口窗口才挂、离开即卸(D3)。
const EAGER_TILES_PER_COLUMN = 8;

type AlbumPhotoTileProps = {
  item: AlbumItem;
  tileIndexSeed: number;
  eager: boolean;
  canManage: boolean;
  albumTileAspect: (item: AlbumItem) => number;
  onOpenPreview: AlbumScreenProps["onOpenPreview"];
  onLongPress: (item: AlbumItem, rect: DOMRect) => void;
  onRecordRatio: AlbumScreenProps["onRecordRatio"];
};

// 长按判定:480ms 内按住不动(位移 ≤10px)。要赶在浏览器原生 contextmenu(约 500ms)之前。
const LONG_PRESS_MS = 480;
const LONG_PRESS_SLOP_PX = 10;

const AlbumPhotoTile = memo(function AlbumPhotoTile({
  item,
  tileIndexSeed,
  eager,
  canManage,
  albumTileAspect,
  onOpenPreview,
  onLongPress,
  onRecordRatio,
}: AlbumPhotoTileProps) {
  const attachment = item.attachment;
  // tile 壳(article+button)常驻保证布局高度与点击目标稳定;媒体子树按视口窗口挂卸。
  const [inWindow, setInWindow] = useState(eager);
  const articleRef = useRef<HTMLElement | null>(null);
  // fired 在长按触发后吞掉随之而来的 click(否则松手会顺带打开预览)。
  const longPressRef = useRef<{ timer: number | null; x: number; y: number; fired: boolean }>({ timer: null, x: 0, y: 0, fired: false });
  const cancelLongPress = () => {
    const state = longPressRef.current;
    if (state.timer !== null) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
  };

  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    let mounted = eager;
    return observeViewportWindow(el, (next) => {
      // 进窗即挂;出窗卸载(媒体元素数 ≈ 可视区±2屏)。eager tile 同样参与出窗卸载。
      if (next !== mounted) {
        mounted = next;
        setInWindow(next);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <article
      ref={articleRef}
      className={`album-photo-tile album-${item.category}`}
      style={
        {
          "--aspect": albumTileAspect(item),
          "--tile-index": tileIndexSeed % 18,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="album-photo-thumb"
        data-vt-item={item.id}
        onPointerDown={(event) => {
          if (attachment?.kind === "video") prefetchAlbumVideo(attachment.url);
          if (!canManage || !attachment?.url) return;
          const state = longPressRef.current;
          cancelLongPress();
          state.x = event.clientX;
          state.y = event.clientY;
          state.fired = false;
          state.timer = window.setTimeout(() => {
            state.timer = null;
            state.fired = true;
            const el = articleRef.current;
            if (el) onLongPress(item, el.getBoundingClientRect());
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(event) => {
          const state = longPressRef.current;
          if (state.timer === null) return;
          if (Math.hypot(event.clientX - state.x, event.clientY - state.y) > LONG_PRESS_SLOP_PX) cancelLongPress();
        }}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onContextMenu={(event) => {
          // 长按走自定义气泡,压掉浏览器原生长按菜单(保存图片等)。
          if (canManage) event.preventDefault();
        }}
        onClick={(event) => {
          if (longPressRef.current.fired) {
            longPressRef.current.fired = false;
            return;
          }
          if (attachment) onOpenPreview(event, attachment, item);
        }}
        aria-label={`预览 ${item.title}`}
        disabled={!attachment?.url}
      >
        {!inWindow ? null : attachment?.kind === "video" ? (
          <AlbumVideoThumbnail
            attachment={attachment}
            title={item.title}
            onRatio={
              attachment.width && attachment.height
                ? undefined
                : (ratio) => onRecordRatio(attachment.id, ratio)
            }
          />
        ) : attachment ? (
          <CachedImg
            src={attachmentListSrc(attachment)}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onLoad={
              attachment.width && attachment.height
                ? undefined
                : (event) => {
                    const el = event.currentTarget;
                    if (el.naturalWidth && el.naturalHeight)
                      onRecordRatio(attachment.id, el.naturalWidth / el.naturalHeight);
                  }
            }
          />
        ) : (
          <img src={albumCategoryIconSrc(item.category)} alt="" loading="lazy" decoding="async" />
        )}
      </button>
    </article>
  );
});

export const AlbumScreen = memo(function AlbumScreen({
  canCaregive,
  isUploadingAlbumMedia,
  albumStats,
  albumUploadItems,
  albumGroups,
  albumFileInputRef,
  albumTileAspect,
  onPickFiles,
  onOpenPicker,
  onOpenPreview,
  onEditItem,
  onDeleteItem,
  onRecordRatio,
}: AlbumScreenProps) {
  // 长按 tile 的编辑/删除气泡。注意:tile 有 content-visibility(自带 paint containment,
  // 越界内容会被裁掉),气泡必须渲染在 tile 子树之外、用 fixed 浮层定位。
  const [tileMenu, setTileMenu] = useState<TileMenuState | null>(null);
  const openTileMenu = useCallback((item: AlbumItem, rect: DOMRect) => {
    hapticLight();
    const below = rect.top < 96; // 贴近屏幕顶时翻到媒体内侧,避免被顶栏裁掉
    setTileMenu({
      item,
      below,
      centerX: rect.left + rect.width / 2,
      top: below ? rect.top + 10 : rect.top - 10,
    });
  }, []);

  useEffect(() => {
    if (!tileMenu) return;
    // 气泡坐标是长按瞬间快照,页面一滚就漂——滚动即收起。
    const close = () => setTileMenu(null);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [tileMenu]);
  // 测试探针(默认关闭零开销):window.__COUNT_ALBUM_RENDERS 置位时统计渲染次数,
  // 守护 memo 的 props 稳定性(gesture 测试 [M]:打字期间渲染数必须为 0)。
  if (typeof window !== "undefined" && (window as unknown as { __COUNT_ALBUM_RENDERS?: boolean }).__COUNT_ALBUM_RENDERS) {
    const w = window as unknown as { __albumRenders?: number };
    w.__albumRenders = (w.__albumRenders || 0) + 1;
  }

  // D4:相册数据就绪后,用单个 IDB 事务批量预查首屏素材灌进内存映射,
  // 替代每个 tile 各自开事务的「首挂事务风暴」;后续 tile 进窗按需单查。
  useEffect(() => {
    const firstScreen = albumGroups
      .flatMap((group) => group.items)
      .slice(0, EAGER_TILES_PER_COLUMN * 4)
      .map((item) => (item.attachment ? attachmentListSrc(item.attachment) : null));
    if (firstScreen.length) void preloadLocalMediaUrls(firstScreen);
  }, [albumGroups]);
  return (
    <section className="album-screen tab-content-enter" aria-label="相册">
      <div className="screen-head">
        <div>
          <p className="eyebrow">相册</p>
          <h2>成长回忆库</h2>
        </div>
        <div className="screen-head-actions">
          <input
            ref={albumFileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            disabled={!canCaregive || isUploadingAlbumMedia}
            onChange={onPickFiles}
          />
          {canCaregive ? (
            <button
              type="button"
              className="screen-action-button album-upload-button"
              title={isUploadingAlbumMedia ? "相册素材正在上传" : "上传到相册"}
              disabled={isUploadingAlbumMedia}
              onClick={onOpenPicker}
            >
              <CameraIcon size={15} />
              上传
            </button>
          ) : null}
        </div>
      </div>

      <div className="album-summary-strip">
        <span>
          <b>{albumStats.media}</b>
          素材
        </span>
        <span>
          <b>{albumStats.videos}</b>
          视频
        </span>
        <span>
          <b>{albumStats.categories}</b>
          分类
        </span>
      </div>


      {albumUploadItems.length ? (
        <div className="album-upload-list" aria-live="polite">
          {albumUploadItems.map((item) => (
            <div className={`album-upload-item upload-item ${item.status}`} key={item.id}>
              <div className="album-upload-icon" aria-hidden="true">
                {item.kind === "video" ? <Video size={17} /> : <ImageIcon size={17} />}
              </div>
              <div className="upload-copy">
                <span title={item.name}>{item.name}</span>
                <small>{item.message ?? (item.status === "uploading" ? `上传 ${item.progress}%` : "准备中")}</small>
                <div className="upload-progress-track" aria-hidden="true">
                  <div className="upload-progress-bar" style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {albumGroups.length ? (
        <div className="album-timeline">
          {albumGroups.map((group, groupIndex) => (
            <section className="album-month-group" key={group.key}>
              <div className="album-month-head">
                <h3>{group.label}</h3>
                <span>{group.items.length} 项</span>
              </div>
              <div className="album-photo-grid">
                {distributeIntoColumns(group.items, 2, albumTileAspect).map((column, columnIndex) => (
                  <div className="album-photo-column" key={columnIndex}>
                    {column.map((item, itemIndex) => (
                      <AlbumPhotoTile
                        key={item.id}
                        item={item}
                        tileIndexSeed={groupIndex * 7 + columnIndex * 3 + itemIndex}
                        eager={groupIndex === 0 && itemIndex < EAGER_TILES_PER_COLUMN}
                        canManage={canCaregive}
                        albumTileAspect={albumTileAspect}
                        onOpenPreview={onOpenPreview}
                        onLongPress={openTileMenu}
                        onRecordRatio={onRecordRatio}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state album-empty">
          <span className="empty-sticker" aria-hidden="true">
            <img src={growthIcon} alt="" />
          </span>
          <p>还没有这个分类的回忆。</p>
          {canCaregive ? (
            <button type="button" onClick={onOpenPicker}>
              上传到相册
            </button>
          ) : null}
        </div>
      )}

      {tileMenu ? (
        // 收起用 click 而非 pointerdown:浮层若在 pointerdown 即卸载,随后的 click 会落到
        // 底下的 tile 上顺带打开预览;click 收起则整次点击都被浮层吃掉。
        <div className="album-tile-menu-layer" onClick={() => setTileMenu(null)}>
          <div
            className={`album-tile-menu${tileMenu.below ? " is-below" : ""}`}
            style={{ top: tileMenu.top, left: `clamp(96px, ${tileMenu.centerX}px, calc(100vw - 96px))` } as CSSProperties}
            onClick={(event) => event.stopPropagation()}
            role="menu"
            aria-label={`${tileMenu.item.title} 的操作`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setTileMenu(null);
                onEditItem(tileMenu.item);
              }}
            >
              <PencilLine size={14} />
              编辑
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => {
                setTileMenu(null);
                onDeleteItem(tileMenu.item);
              }}
            >
              <Trash2 size={14} />
              删除
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
});
