import { Video } from "lucide-react";
import { useState } from "react";
import type { Attachment } from "../types";

const videoPosterFrameSrc = (url?: string) => {
  if (!url || url.startsWith("data:") || url.startsWith("blob:") || url.includes("#")) return url;
  return `${url}#t=0.1`;
};

export function AlbumVideoThumbnail({ attachment, title }: { attachment: Attachment; title: string }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const posterSrc = attachment.thumbnailUrl && !posterFailed ? attachment.thumbnailUrl : undefined;

  if (posterSrc) {
    return <img src={posterSrc} alt={title} loading="lazy" decoding="async" onError={() => setPosterFailed(true)} />;
  }

  if (!attachment.url) {
    return <Video size={24} />;
  }

  return (
    <video
      src={videoPosterFrameSrc(attachment.url)}
      muted
      playsInline
      preload="metadata"
      aria-label={title}
    />
  );
}
