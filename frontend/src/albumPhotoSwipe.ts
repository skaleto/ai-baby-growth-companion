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
import { resumeAlbumVideos, suspendAlbumVideos } from "./components/albumVideoPlayback";

type PswpAlbumData = {
  src?: string;
  width: number;
  height: number;
  msrc?: string;
  alt?: string;
  albumItem: AlbumItem;
  attachmentId?: string;
  isVideo: boolean;
  videoUrl?: string;
  remoteVideoUrl?: string;
  poster?: string;
};

export type OpenAlbumPhotoSwipeOptions = {
  items: AlbumItem[];
  startId: string;
  getThumbEl?: (itemId: string) => HTMLElement | null;
  /** 编辑回调。预览保持打开;返回更新后的条目则就地刷新顶栏信息(取消返回 null/void)。 */
  onEdit?: (item: AlbumItem) => Promise<AlbumItem | null | void> | AlbumItem | null | void;
  /** 删除回调。返回 true(已删除)才关闭预览;取消(false/void)留在原地。 */
  onDelete?: (item: AlbumItem) => Promise<boolean | void> | boolean | void;
  formatDate?: (item: AlbumItem) => string;
  formatRecordedBy?: (recordedBy?: RecordedBy) => string;
  /** 网格实测的宽高比(w/h),用于没有 width/height 的老附件——打开即正确比例,不再闪正方形。 */
  getAspectRatio?: (item: AlbumItem) => number;
};

const FALLBACK_WIDTH = 1600;

// 干净的细线 X(复刻旧版 lucide <X>),替代 PhotoSwipe 自带带描边阴影的"塑料"关闭图标。
const ICON_CLOSE =
  '<svg class="pswp-album-icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const ICON_PLAY =
  '<svg class="pswp-vb-icn pswp-vb-icn-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
const ICON_PAUSE =
  '<svg class="pswp-vb-icn pswp-vb-icn-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>';
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
      attachmentId: attachment.id,
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
  const shell = document.createElement("div");
  shell.className = "pswp-video-shell";
  const video = document.createElement("video");
  video.className = "pswp-video";
  if (data.videoUrl) video.src = data.videoUrl;
  if (data.poster) video.poster = data.poster;
  video.playsInline = true;
  // 绝不设 autoplay:PhotoSwipe 会预加载相邻 slide(contentLoad 对没划到的视频也会触发),
  // 带 autoplay 的 <video> 攒够数据就自行带声开播——这就是「没划到/刚划过的视频在后台响」。
  // 播放只允许由 contentActivate(真正成为当前页)触发。
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
      // 服务端缺封面(data.poster 为空)→ 抽帧本地缓存 + 回传服务端自愈。
      void captureVideoPosterToCache(video, data.remoteVideoUrl, { uploadForAttachmentId: data.attachmentId });
    }
  });
  shell.appendChild(video);
  return shell;
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
    // 相邻图无缝贴合:默认 spacing 0.1(=10% 视口宽)就是滑动时看到的那条黑边间隔。
    spacing: 0,
    wheelToZoom: true,
    // 触屏产品:滑动即翻页,不要桌面式左右箭头(部分安卓 WebView 误报有鼠标导致箭头出现)。
    arrowPrev: false,
    arrowNext: false,
    zoom: false,
    counter: true,
    // 首尾不循环:第一张往前/最后一张往后就是划不动(到边即止)。
    loop: false,
    // 翻页/缩放归位用 iOS 式减速长尾(拖拽松手是内部弹簧,此项主要影响箭头导航与开合)。
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
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
      const video = e.content.element?.querySelector?.("video");
      void (video as HTMLVideoElement | null)?.play?.()?.catch?.(() => undefined);
    }
  });
  lightbox.on("contentDeactivate", (e) => {
    const data = e.content.data as PswpAlbumData;
    if (data.isVideo) {
      const video = e.content.element?.querySelector?.("video");
      try { (video as HTMLVideoElement | null)?.pause?.(); } catch { /* 元素可能已分离 */ }
    }
  });
  // slide 内容被回收/销毁时彻底拆除:停播 + 卸 src + load(),释放解码器与音频会话,
  // 杜绝「划过去的视频还在后台出声」。
  lightbox.on("contentDestroy", (e) => {
    const data = e.content.data as PswpAlbumData;
    if (data.isVideo) {
      const video = e.content.element?.querySelector?.("video");
      if (video instanceof HTMLVideoElement) {
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch { /* 已分离的元素操作可能抛,无碍 */ }
      }
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
          // 编辑/删除都不再先关预览(旧行为会「自动返回瀑布页」):弹窗(深色变体)直接盖在
          // 预览上;取消留在原地;编辑成功就地刷新顶栏;删除确认后素材已不存在才关闭预览。
          const pauseCurrentVideo = () => {
            const video = pswp.currSlide?.content?.element?.querySelector?.("video");
            try { (video as HTMLVideoElement | null)?.pause?.(); } catch { /* 已分离 */ }
          };
          const mk = (label: string, danger: boolean, run?: (data: PswpAlbumData) => void) => {
            if (!run || !popover) return;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = label;
            if (danger) btn.className = "danger";
            btn.addEventListener("click", (ev) => {
              ev.stopPropagation();
              popover?.classList.remove("is-open");
              const data = pswp.currSlide?.data as PswpAlbumData | undefined;
              if (data?.albumItem) {
                pauseCurrentVideo();
                run(data);
              }
            });
            popover.appendChild(btn);
          };
          mk("编辑", false, opts.onEdit && ((data) => {
            void (async () => {
              const next = await opts.onEdit?.(data.albumItem);
              if (next) {
                data.albumItem = next;
                pswp.dispatch("change"); // album-info 订阅了 change,就地重渲染标题/日期
              }
            })();
          }));
          mk("删除", true, opts.onDelete && ((data) => {
            void (async () => {
              const removed = await opts.onDelete?.(data.albumItem);
              if (removed) pswp.close();
            })();
          }));
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

  // 视频控制条(5.3):挂在 pswp 的 UI 层(与关闭/菜单按钮同层)。
  // 教训:任何放在 slide 内容里的控件(含 Plyr)都会与 pswp 手势层抢触摸——
  // 拖进度=拖页、tap 被截走;UI 层元素不经过手势系统,关闭键已在真机验证可点。
  // 5.3:左下角播放/暂停切换键常驻(暂停时不再消失导致滑轨变长);
  // 「播放中滑不动页」根因是 <video> 元素本身在 WebView 里吃掉触摸,
  // 与中央按钮无关 → .pswp-video 置 pointer-events:none(见 pswp-album.css)。
  lightbox.on("uiRegister", () => {
    const pswp = lightbox.pswp;
    if (!pswp?.ui) return;
    pswp.ui.registerElement({
      name: "video-bar",
      appendTo: "wrapper",
      onInit: (el) => {
        el.className += " pswp-video-bar";
        el.innerHTML =
          `<button type="button" class="pswp-vb-center" aria-label="播放">${ICON_PLAY}</button>` +
          `<div class="pswp-vb-bottom">` +
          `<button type="button" class="pswp-vb-toggle" aria-label="暂停">${ICON_PAUSE}${ICON_PLAY}</button>` +
          `<input class="pswp-vb-progress" type="range" min="0" max="1000" step="1" value="0" aria-label="播放进度" />` +
          `<span class="pswp-vb-time">0:00 / 0:00</span>` +
          `</div>`;
        const toggleBtn = el.querySelector(".pswp-vb-toggle") as HTMLButtonElement;
        const progress = el.querySelector(".pswp-vb-progress") as HTMLInputElement;
        const timeText = el.querySelector(".pswp-vb-time") as HTMLElement;
        const bottom = el.querySelector(".pswp-vb-bottom") as HTMLElement;

        // 只让底部控制条(暂停键 + 进度条)吞自身触摸,避免拖进度被 pswp 当成横滑翻页。
        // 中央及其余全屏区域全程 pointer-events:none,横滑直接穿透到 pswp 手势层——
        // 绝不再在整条 el 上拦截(那正是「视频页滑不动」反复发作的根)。
        for (const type of ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "touchend", "mousedown", "click"]) {
          bottom.addEventListener(type, (event) => event.stopPropagation());
        }

        const fmt = (seconds: number) => {
          if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
          const total = Math.round(seconds);
          return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
        };

        let video: HTMLVideoElement | null = null;
        let scrubbing = false;
        const sync = () => {
          if (!video) return;
          el.classList.toggle("is-playing", !video.paused);
          // 左下角按钮常驻:播放=暂停键,暂停=继续播放键(图标显隐由 .is-playing CSS 切换)。
          toggleBtn.setAttribute("aria-label", video.paused ? "继续播放" : "暂停");
          const duration = video.duration;
          timeText.textContent = `${fmt(video.currentTime)} / ${fmt(duration)}`;
          if (!scrubbing && Number.isFinite(duration) && duration > 0) {
            progress.value = String(Math.round((video.currentTime / duration) * 1000));
          }
          const pct = Number.isFinite(duration) && duration > 0 ? (Number(progress.value) / 1000) * 100 : 0;
          progress.style.setProperty("--p", `${pct}%`);
        };
        const events = ["timeupdate", "durationchange", "play", "pause", "loadedmetadata"];
        const unbind = () => {
          if (!video) return;
          for (const name of events) video.removeEventListener(name, sync);
          video = null;
        };
        const rebind = () => {
          unbind();
          const data = pswp.currSlide?.data as PswpAlbumData | undefined;
          const next = data?.isVideo ? pswp.currSlide?.content?.element?.querySelector?.("video") : null;
          el.classList.toggle("is-video", Boolean(next));
          if (next instanceof HTMLVideoElement) {
            video = next;
            for (const name of events) video.addEventListener(name, sync);
            sync();
          }
        };

        toggleBtn.addEventListener("click", () => {
          if (!video) return;
          if (video.paused) void video.play().catch(() => undefined);
          else video.pause();
        });
        const seekTo = (raw: string) => {
          if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
          video.currentTime = (Number(raw) / 1000) * video.duration;
        };
        progress.addEventListener("pointerdown", () => { scrubbing = true; });
        progress.addEventListener("input", () => { if (video) { seekTo(progress.value); timeText.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`; } });
        const endScrub = () => { scrubbing = false; };
        progress.addEventListener("pointerup", endScrub);
        progress.addEventListener("pointercancel", endScrub);
        progress.addEventListener("change", () => { seekTo(progress.value); endScrub(); });

        pswp.on("change", rebind);
        // 首帧内容可能晚于 change 就绪:contentActivate 后再绑一次。
        pswp.on("contentActivate", () => setTimeout(rebind, 0));
        pswp.on("close", unbind);
        rebind();
      },
    });
  });

  // 视频页:轻点(非滑动)切换播放/暂停。pswp 的 tap 系统自带 tap↔drag 区分——
  // 滑动只翻页、轻点才 toggle;中央播放键因此能纯视觉(pointer-events:none)不挡横滑。
  lightbox.on("tapAction", (e) => {
    const pswp = lightbox.pswp;
    const data = pswp?.currSlide?.data as PswpAlbumData | undefined;
    if (!data?.isVideo) return; // 图片维持默认行为(toggle-controls)
    e.preventDefault();
    const video = pswp?.currSlide?.content?.element?.querySelector?.("video");
    if (video instanceof HTMLVideoElement) {
      if (video.paused) void video.play().catch(() => undefined);
      else video.pause();
    }
  });

  lightbox.on("change", () => {
    const pswp = lightbox.pswp;
    pauseVideosExcept(pswp?.element ?? null, pswp?.currSlide?.content?.element ?? null);
  });
  lightbox.on("close", () => {
    pauseVideosExcept(lightbox.pswp?.element ?? null, null);
  });
  lightbox.on("destroy", () => {
    // 恢复网格自动播放(预览期间挂起)。
    resumeAlbumVideos();
    // 一次性使用:每次打开新建实例,销毁时彻底释放。
    setTimeout(() => lightbox.destroy(), 0);
  });

  // 预览期间挂起网格视频解码:被盖住的网格视频继续播放会拖低滑动帧率。
  suspendAlbumVideos();
  // 测试钩子(默认关闭零成本):DOM 测试经 __PSWP_TEST_HOOK 取实例驱动翻页(箭头已移除)。
  if ((window as unknown as { __PSWP_TEST_HOOK?: boolean }).__PSWP_TEST_HOOK) {
    (window as unknown as { __pswpLightbox?: unknown }).__pswpLightbox = lightbox;
  }
  lightbox.init();
  lightbox.loadAndOpen(startIndex);
}
