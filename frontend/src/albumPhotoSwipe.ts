// 相册全屏预览:PhotoSwipe 5 集成(替换自研手势/FLIP/轮播)。
// 手势物理(跟手/惯性/缩放/开合 morph)全部交给 PhotoSwipe;本模块只做集成:
// 数据源(接 IndexedDB 本地缓存)、视频 slide、顶栏信息与编辑/删除菜单、缩略图联动。
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import "./styles/pswp-album.css";
import type { AlbumItem, Attachment, RecordedBy } from "./types";
import {
  cacheMediaFromRemote,
  captureVideoPosterToCache,
  getCachedPosterUrl,
  getLocalMediaUrl,
  VIDEO_CACHE_MAX_BYTES,
} from "./mediaCache";

type PswpAlbumData = {
  src?: string;
  width: number;
  height: number;
  msrc?: string;
  alt?: string;
  albumItem: AlbumItem;
  isVideo: boolean;
  videoUrl?: string;
  remoteVideoUrl?: string;
  poster?: string;
};

export type OpenAlbumPhotoSwipeOptions = {
  items: AlbumItem[];
  startId: string;
  getThumbEl?: (itemId: string) => HTMLElement | null;
  onEdit?: (item: AlbumItem) => void;
  onDelete?: (item: AlbumItem) => void;
  formatDate?: (item: AlbumItem) => string;
  formatRecordedBy?: (recordedBy?: RecordedBy) => string;
  /** 网格实测的宽高比(w/h),用于没有 width/height 的老附件——打开即正确比例,不再闪正方形。 */
  getAspectRatio?: (item: AlbumItem) => number;
};

const FALLBACK_WIDTH = 1600;

// 干净的细线 X(复刻旧版 lucide <X>),替代 PhotoSwipe 自带带描边阴影的"塑料"关闭图标。
const ICON_CLOSE =
  '<svg class="pswp-album-icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const ICON_MORE =
  '<svg class="pswp-album-icn" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

async function localOrRemote(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  const local = await getLocalMediaUrl(url);
  return local || url;
}

async function buildSlideData(item: AlbumItem, opts: OpenAlbumPhotoSwipeOptions): Promise<PswpAlbumData> {
  const attachment = item.attachment as Attachment;
  let width = attachment.width && attachment.width > 0 ? attachment.width : 0;
  let height = attachment.height && attachment.height > 0 ? attachment.height : 0;
  if (!width || !height) {
    // 老附件无尺寸:用网格实测比例推一个等比框(真实尺寸由 loadComplete 再精修)。
    const ratio = opts.getAspectRatio?.(item) || 4 / 3;
    width = FALLBACK_WIDTH;
    height = Math.max(1, Math.round(FALLBACK_WIDTH / ratio));
  }
  const thumb = await localOrRemote(attachment.thumbnailUrl);
  if (attachment.kind === "video") {
    const videoUrl = await localOrRemote(attachment.url);
    const poster = thumb || (await getCachedPosterUrl(attachment.url)) || undefined;
    return {
      width, height,
      msrc: poster,
      albumItem: item,
      isVideo: true,
      videoUrl,
      remoteVideoUrl: attachment.url,
      poster,
    };
  }
  const src = await localOrRemote(attachment.url);
  // 远程图打开期间后台落库,下次(含杀进程后)即本地。
  if (src === attachment.url) void cacheMediaFromRemote(attachment.url);
  return { src, width, height, msrc: thumb, alt: item.title, albumItem: item, isVideo: false };
}

function buildVideoElement(data: PswpAlbumData): HTMLElement {
  const video = document.createElement("video");
  video.className = "pswp-video";
  if (data.videoUrl) video.src = data.videoUrl;
  if (data.poster) video.poster = data.poster;
  video.controls = true;
  video.playsInline = true;
  video.autoplay = true;
  let cacheKicked = false;
  let posterCaptured = false;
  video.addEventListener("timeupdate", () => {
    // 播放稳定(≥3s)后整文件落库(≤80MB,已缓存自动跳过),不与起播抢带宽。
    if (video.currentTime >= 3 && !cacheKicked) {
      cacheKicked = true;
      void cacheMediaFromRemote(data.remoteVideoUrl, { maxBytes: VIDEO_CACHE_MAX_BYTES });
    }
    // 无封面视频:画出真帧后抽帧存为本地海报(本地源必然成功,跨域静默跳过)。
    if (video.currentTime > 0 && !data.poster && !posterCaptured) {
      posterCaptured = true;
      void captureVideoPosterToCache(video, data.remoteVideoUrl);
    }
  });
  return video;
}

function pauseVideosExcept(root: HTMLElement | null, current?: HTMLElement | null) {
  if (!root) return;
  root.querySelectorAll("video").forEach((video) => {
    if (current && current.contains(video)) return;
    try { video.pause(); } catch { /* 已分离的元素 pause 可能抛,无碍 */ }
  });
}

/** 打开相册全屏预览(PhotoSwipe)。数据源构建含 IndexedDB 本地解析(命中零网络)。 */
export async function openAlbumPhotoSwipe(opts: OpenAlbumPhotoSwipeOptions): Promise<void> {
  const items = opts.items.filter((item) => item.attachment?.url);
  if (!items.length) return;
  const startIndex = Math.max(0, items.findIndex((item) => item.id === opts.startId));
  const dataSource = await Promise.all(items.map((item) => buildSlideData(item, opts)));

  const lightbox = new PhotoSwipeLightbox({
    dataSource,
    pswpModule: () => import("photoswipe"),
    showHideAnimationType: "zoom",
    bgOpacity: 1,
    wheelToZoom: true,
    arrowPrev: true,
    arrowNext: true,
    zoom: false,
    counter: true,
    errorMsg: "这张媒体加载失败了,稍后再试。",
  });

  // 打开/关闭 morph 动画联动到网格缩略图。
  lightbox.addFilter("thumbEl", (thumbEl, data) => {
    const id = (data as PswpAlbumData).albumItem?.id;
    return (id && opts.getThumbEl?.(id)) || (thumbEl as HTMLElement);
  });
  lightbox.addFilter("placeholderSrc", (placeholderSrc, content) => {
    const data = content.data as PswpAlbumData;
    return data.msrc || placeholderSrc;
  });

  // 视频 slide:自定义内容元素。
  lightbox.on("contentLoad", (e) => {
    const data = e.content.data as PswpAlbumData;
    if (data.isVideo) {
      e.preventDefault();
      e.content.element = buildVideoElement(data) as unknown as HTMLDivElement;
      // 自定义内容必须显式标记加载完成,否则 placeholder 占位层一直盖在视频上(黑屏)。
      (e.content as unknown as { onLoaded: () => void }).onLoaded();
    }
  });

  // autoplay 属性对动态插入的 <video> 不可靠:激活时主动播,离开时暂停。
  lightbox.on("contentActivate", (e) => {
    const data = e.content.data as PswpAlbumData;
    if (data.isVideo) {
      const video = e.content.element instanceof HTMLVideoElement ? e.content.element : e.content.element?.querySelector?.("video");
      void (video as HTMLVideoElement | null)?.play?.()?.catch?.(() => undefined);
    }
  });
  lightbox.on("contentDeactivate", (e) => {
    const data = e.content.data as PswpAlbumData;
    if (data.isVideo) {
      const video = e.content.element instanceof HTMLVideoElement ? e.content.element : e.content.element?.querySelector?.("video");
      try { (video as HTMLVideoElement | null)?.pause?.(); } catch { /* 元素可能已分离 */ }
    }
  });

  // 图片真实尺寸就绪后,纠正占位尺寸(无 width/height 的旧数据)。
  lightbox.on("loadComplete", (e) => {
    const data = e.content.data as PswpAlbumData;
    const el = e.content.element;
    if (!data.isVideo && el instanceof HTMLImageElement && el.naturalWidth && el.naturalHeight) {
      const off = Math.abs(data.width - el.naturalWidth) + Math.abs(data.height - el.naturalHeight);
      if (off > 4) {
        data.width = el.naturalWidth;
        data.height = el.naturalHeight;
        const slide = (e.content as unknown as { slide?: { updateContentSize: (force?: boolean) => void } }).slide;
        slide?.updateContentSize(true);
      }
    }
  });

  // 顶栏:自定义关闭(干净圆形深色底)/ 标题信息 / ⋯ 菜单(编辑/删除)。
  lightbox.on("uiRegister", () => {
    const pswp = lightbox.pswp;
    if (!pswp?.ui) return;

    // 自定义关闭按钮(默认那个带描边阴影、观感塑料;此处复刻旧版圆形深色底 + 细线 X)。
    pswp.ui.registerElement({
      name: "album-close",
      order: 1,
      isButton: true,
      appendTo: "bar",
      title: "关闭",
      ariaLabel: "关闭",
      html: ICON_CLOSE,
      onClick: () => pswp.close(),
    });

    pswp.ui.registerElement({
      name: "album-info",
      order: 6,
      appendTo: "bar",
      onInit: (el) => {
        el.className += " pswp-album-info";
        const render = () => {
          const data = pswp.currSlide?.data as PswpAlbumData | undefined;
          const item = data?.albumItem;
          if (!item) { el.innerHTML = ""; return; }
          const date = opts.formatDate?.(item) ?? item.date;
          const who = opts.formatRecordedBy?.(item.recordedBy) ?? "";
          el.innerHTML = `<strong></strong><span></span>${who ? "<small></small>" : ""}`;
          (el.querySelector("strong") as HTMLElement).textContent = item.title;
          (el.querySelector("span") as HTMLElement).textContent = date;
          if (who) (el.querySelector("small") as HTMLElement).textContent = who;
        };
        render();
        pswp.on("change", render);
      },
    });

    if (opts.onEdit || opts.onDelete) {
      // popover 挂到根容器(而非菜单按钮内部)——button 内嵌 button 会让内层点击不可靠,
      // 是「点了没反应」的根因之一;显隐用 .is-open class(而非 hidden 属性,
      // 后者会被 .pswp-album-popover 的 display 规则覆盖,导致灰框常驻)。
      let popover: HTMLDivElement | null = null;
      pswp.ui.registerElement({
        name: "album-menu",
        order: 9,
        isButton: true,
        appendTo: "bar",
        title: "更多操作",
        ariaLabel: "更多操作",
        html: ICON_MORE,
        onInit: (el) => {
          popover = document.createElement("div");
          popover.className = "pswp-album-popover";
          const mk = (label: string, danger: boolean, fn?: (item: AlbumItem) => void) => {
            if (!fn || !popover) return;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = label;
            if (danger) btn.className = "danger";
            btn.addEventListener("click", (ev) => {
              ev.stopPropagation();
              popover?.classList.remove("is-open");
              const data = pswp.currSlide?.data as PswpAlbumData | undefined;
              if (data?.albumItem) {
                pswp.close();
                fn(data.albumItem);
              }
            });
            popover.appendChild(btn);
          };
          mk("编辑", false, opts.onEdit);
          mk("删除", true, opts.onDelete);
          pswp.element?.appendChild(popover);
          // 翻页 / 点击空白处收起(菜单按钮自身的点击交给 onClick 切换)。
          pswp.on("change", () => popover?.classList.remove("is-open"));
          pswp.element?.addEventListener("pointerdown", (ev) => {
            if (!popover) return;
            const target = ev.target as Node | null;
            if (!target || popover.contains(target) || el.contains(target)) return;
            popover.classList.remove("is-open");
          });
        },
        onClick: () => popover?.classList.toggle("is-open"),
      });
    }
  });

  // PhotoSwipe 在「打开动画进行中」收到 close() 会静默忽略(源码注释 for now do nothing)——
  // 用户点开后立刻点关闭/Esc/下滑就会「没反应」。补丁:opening 窗口内的 close 请求
  // 挂到 openingAnimationEnd 后自动补执行,任何时机的关闭都即点即效。
  lightbox.on("afterInit", () => {
    const pswp = lightbox.pswp as unknown as {
      close: () => void;
      opener: { isOpening: boolean };
      on: (name: string, fn: () => void) => void;
    } | null;
    if (!pswp) return;
    const rawClose = pswp.close.bind(pswp);
    let queued = false;
    pswp.close = () => {
      if (pswp.opener.isOpening) {
        if (queued) return;
        queued = true;
        pswp.on("openingAnimationEnd", () => rawClose());
        return;
      }
      rawClose();
    };
  });

  lightbox.on("change", () => {
    const pswp = lightbox.pswp;
    pauseVideosExcept(pswp?.element ?? null, pswp?.currSlide?.content?.element ?? null);
  });
  lightbox.on("close", () => {
    pauseVideosExcept(lightbox.pswp?.element ?? null, null);
  });
  lightbox.on("destroy", () => {
    // 一次性使用:每次打开新建实例,销毁时彻底释放。
    setTimeout(() => lightbox.destroy(), 0);
  });

  lightbox.init();
  lightbox.loadAndOpen(startIndex);
}
