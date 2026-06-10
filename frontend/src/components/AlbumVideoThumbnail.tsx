import { Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Attachment } from "../types";
import { registerAlbumVideo } from "./albumVideoPlayback";
import { useCachedMediaSrc, useVideoPoster } from "./CachedMedia";
import { captureVideoPosterToCache } from "../mediaCache";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AlbumVideoThumbnail({
  attachment,
  title,
  onRatio,
}: {
  attachment: Attachment;
  title: string;
  onRatio?: (ratio: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // 海报:thumbnailUrl(本地缓存)→ 抽帧兜底海报(无封面视频看过一次后生成)。
  const poster = useVideoPoster(attachment);
  // 视频流:本地已缓存(全屏播放过)则本地播,否则在线播;网格自动播放不触发整文件下载。
  const videoSrc = useCachedMediaSrc(attachment.url, { download: false });
  const posterCaptureRef = useRef(false);
  const [canAutoplay] = useState(() => !prefersReducedMotion());
  // The poster overlay stays on top of the <video> until the video has actually
  // painted a real frame. Without it, the native poster is dismissed the moment
  // play() is called but before the first frame decodes (preload="metadata" did
  // not buffer frames), leaving a brief blank/white flash.
  const [framesReady, setFramesReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canAutoplay) return;
    // Shared controller plays only the most-centered video (caps concurrent decodes to 1).
    return registerAlbumVideo(video);
  }, [canAutoplay]);

  if (!attachment.url) {
    return <Video size={24} />;
  }

  return (
    <>
      <video
        ref={videoRef}
        src={videoSrc || attachment.url}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={title}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (video.currentTime > 0) setFramesReady(true);
          // 无封面视频:画出真帧后抽一帧存为本地海报(本地/同源源才会成功,跨域静默跳过)。
          if (video.currentTime > 0 && !poster && !posterCaptureRef.current) {
            posterCaptureRef.current = true;
            void captureVideoPosterToCache(video, attachment.url);
          }
        }}
        onLoadedMetadata={(event) => {
          const el = event.currentTarget;
          if (el.videoWidth && el.videoHeight) onRatio?.(el.videoWidth / el.videoHeight);
        }}
      />
      {poster ? (
        <img
          className={`album-video-poster${framesReady ? " is-hidden" : ""}`}
          src={poster}
          alt={title}
          loading="lazy"
          decoding="async"
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
