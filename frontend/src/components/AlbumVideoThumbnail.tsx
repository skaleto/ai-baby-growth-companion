import { Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Attachment } from "../types";
import { registerAlbumVideo } from "./albumVideoPlayback";
import { useCachedMediaSrc } from "./CachedMedia";

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
  // 海报走本地缓存:杀进程后也能本地秒出首帧画面(视频流本身仍在线拉)。
  const poster = useCachedMediaSrc(attachment.thumbnailUrl);
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
        src={attachment.url}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={title}
        onTimeUpdate={(event) => {
          if (event.currentTarget.currentTime > 0) setFramesReady(true);
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
