import Plyr from "plyr";
import "plyr/dist/plyr.css";
// 离线自包含:Plyr 默认 iconUrl 会去 fetch cdn.plyr.io 的图标精灵(违反 OTA 离线 + CSP)。
// 这里把 vendored 的精灵以 ?raw 内联进 DOM 一次(loadSprite:false 让 Plyr 不发任何图标网络请求),
// 控件通过 <use href="#plyr-*"> 直接引用已注入的 symbol。
import plyrSpriteRaw from "../assets/plyr-sprite.svg?raw";

let plyrSpriteInjected = false;
function ensurePlyrSprite() {
  if (plyrSpriteInjected || typeof document === "undefined") return;
  plyrSpriteInjected = true;
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.display = "none";
  holder.innerHTML = plyrSpriteRaw;
  document.body.appendChild(holder);
}
import { useCallback, useEffect, useRef, useState } from "react";
import type { Attachment } from "../types";
import { cacheMediaFromRemote, captureVideoPosterToCache, VIDEO_CACHE_MAX_BYTES } from "../mediaCache";
import { useCachedMediaSrc, useVideoPoster } from "./CachedMedia";

// 视频播放/进度拖动改用成熟的 Plyr(替换原自研 pointer 进度条:热区小、逐帧 seek 卡顿、无可见滑块)。
// Plyr 自带无障碍、键盘、触摸拖动 seek 与自动隐藏控件;拖动进度用它自己的 <input type=range>,
// 手感与稳定性由库保证。我们只保留:本地缓存起播、无封面抽帧兜底、原生全屏退出即关预览。
export function PreviewVideoPlayer({
  attachment,
  active,
  bindVideo,
}: {
  attachment: Attachment;
  active: boolean;
  bindVideo?: (node: HTMLVideoElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const plyrRef = useRef<Plyr | null>(null);
  // 本地缓存命中 → 本地播放(杀进程后即点即播);未命中保持在线播,不在此处触发下载。
  const videoSrc = useCachedMediaSrc(attachment.url, { download: false });
  // 海报:thumbnailUrl(本地缓存)→ 抽帧兜底海报;交给 Plyr 的 poster 显示,起播前不黑屏。
  const poster = useVideoPoster(attachment);
  const cacheKickedRef = useRef(false);
  const posterCaptureRef = useRef(false);
  const [frameReady, setFrameReady] = useState(false);

  // Bind the internal ref AND forward to bindPreviewVideo(设 muted=false、接管原生全屏退出、卸载即暂停)。
  const setVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      bindVideo?.(node);
    },
    [bindVideo],
  );

  // 初始化 Plyr(每次挂载一次;卸载先 destroy 还原 DOM 再由 React 移除元素)。
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    ensurePlyrSprite();
    const player = new Plyr(video, {
      controls: ["play-large", "play", "progress", "current-time", "mute", "fullscreen"],
      clickToPlay: true,
      hideControls: true,
      resetOnEnd: true,
      // 离线/CSP:精灵已内联进 DOM,loadSprite:false 让 Plyr 不发图标网络请求;
      // blankVideo 置空,杜绝 Plyr 回退去 fetch cdn.plyr.io 的默认空白视频。
      loadSprite: false,
      blankVideo: "",
      keyboard: { focused: true, global: false },
      fullscreen: { enabled: true, iosNative: true },
      tooltips: { controls: false, seek: true },
    });
    plyrRef.current = player;

    // 隔离:在 Plyr 控件区(尤其进度滑块)拖动 = seek,不能冒泡到相册舞台触发左右滑翻页。
    // 相册翻页是 onPreviewStagePointerDown 的 React 合成事件,原生 stopPropagation 可阻止其到达 React 根监听。
    const controls = player.elements.controls;
    const stopBubble = (event: Event) => event.stopPropagation();
    controls?.addEventListener("pointerdown", stopBubble);
    controls?.addEventListener("pointermove", stopBubble);
    controls?.addEventListener("pointerup", stopBubble);

    return () => {
      controls?.removeEventListener("pointerdown", stopBubble);
      controls?.removeEventListener("pointermove", stopBubble);
      controls?.removeEventListener("pointerup", stopBubble);
      try {
        player.destroy();
      } catch {
        // destroy 在极端卸载竞态下可能抛错,忽略即可。
      }
      plyrRef.current = null;
    };
    // 仅挂载/卸载时运行;src 变化由下方 attachment.id effect 处理。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // active 时静音起播(不被音频缓冲卡住,onPlaying 再解除静音);非 active 暂停并复位。
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.muted = true;
      void video.play().catch(() => undefined);
    } else {
      video.pause();
      video.currentTime = 0;
      setFrameReady(false);
    }
  }, [active, videoSrc]);

  // 媒体切换(carousel 翻页)时重新等待真帧。
  useEffect(() => {
    setFrameReady(false);
  }, [attachment.id]);

  return (
    <div className="preview-video-player" onClick={(event) => event.stopPropagation()}>
      <video
        ref={setVideoNode}
        src={videoSrc || attachment.url}
        poster={poster || undefined}
        playsInline
        preload="auto"
        aria-label={attachment.name}
        onPlaying={(event) => {
          event.currentTarget.muted = false;
          setFrameReady(true);
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (video.currentTime > 0) setFrameReady(true);
          // 播放稳定(≥3s)后才整文件落库——起播阶段不与 <video> 流加载抢带宽(否则开头黑屏变长)。
          if (video.currentTime >= 3 && !cacheKickedRef.current) {
            cacheKickedRef.current = true;
            void cacheMediaFromRemote(attachment.url, { maxBytes: VIDEO_CACHE_MAX_BYTES });
          }
          // 无封面视频:画出真帧后抽一帧存为本地海报(本地/同源源才会成功,跨域静默跳过)。
          if (video.currentTime > 0 && !poster && !posterCaptureRef.current) {
            posterCaptureRef.current = true;
            void captureVideoPosterToCache(video, attachment.url);
          }
        }}
      />
      {poster && !frameReady ? (
        <img className="preview-video-poster" src={poster} alt="" aria-hidden="true" decoding="async" />
      ) : null}
    </div>
  );
}
