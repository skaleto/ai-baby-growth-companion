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
};

const FALLBACK_SIZE = { width: 1440, height: 1440 };

async function localOrRemote(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  const local = await getLocalMediaUrl(url);
  return local || url;
}

async function buildSlideData(item: AlbumItem, opts: OpenAlbumPhotoSwipeOptions): Promise<PswpAlbumData> {
  const attachment = item.attachment as Attachment;
  const width = attachment.width && attachment.width > 0 ? attachment.width : FALLBACK_SIZE.width;
  const height = attachment.height && attachment.height > 0 ? attachment.height : FALLBACK_SIZE.height;
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
  const wrap = document.createElement("div");
  wrap.className = "pswp-video-wrap";
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
  wrap.appendChild(video);
  return wrap;
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
    bgOpacity: 0.92,
    wheelToZoom: true,
    arrowPrev: true,
    arrowNext: true,
    zoom: false,
    counter: true,
    padding: { top: 64, bottom: 32, left: 0, right: 0 },
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
        const instance = e.content.instance as unknown as { refreshSlideContent?: (index: number) => void };
        instance?.refreshSlideContent?.(e.content.index);
      }
    }
  });

  // 顶栏:标题/日期/记录人 + ⋯ 菜单(编辑/删除)。
  lightbox.on("uiRegister", () => {
    const pswp = lightbox.pswp;
    if (!pswp?.ui) return;
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
      pswp.ui.registerElement({
        name: "album-menu",
        order: 7,
        isButton: true,
        appendTo: "bar",
        html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
        onInit: (el) => {
          el.setAttribute("aria-label", "更多操作");
          const popover = document.createElement("div");
          popover.className = "pswp-album-popover";
          popover.hidden = true;
          const mk = (label: string, danger: boolean, fn?: (item: AlbumItem) => void) => {
            if (!fn) return;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = label;
            if (danger) btn.className = "danger";
            btn.addEventListener("click", (ev) => {
              ev.stopPropagation();
              popover.hidden = true;
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
          el.appendChild(popover);
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            popover.hidden = !popover.hidden;
          });
          pswp.on("change", () => { popover.hidden = true; });
        },
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
