import { Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Attachment } from "../types";

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
  const [canAutoplay] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canAutoplay) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [canAutoplay]);

  if (!attachment.url) {
    return <Video size={24} />;
  }

  return (
    <video
      ref={videoRef}
      src={attachment.url}
      poster={attachment.thumbnailUrl}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={title}
      onLoadedMetadata={(event) => {
        const el = event.currentTarget;
        if (el.videoWidth && el.videoHeight) onRatio?.(el.videoWidth / el.videoHeight);
      }}
    />
  );
}
