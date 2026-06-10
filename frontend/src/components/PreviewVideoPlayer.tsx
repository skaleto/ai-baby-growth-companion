import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Attachment } from "../types";
import { fractionFromPointer, progressFraction, seekTimeFromFraction } from "./previewVideoMath";
import { cacheMediaFromRemote, VIDEO_CACHE_MAX_BYTES } from "../mediaCache";
import { useCachedMediaSrc } from "./CachedMedia";

const HIDE_DELAY_MS = 2500;

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
  // 本地缓存命中 → 本地播放(杀进程后即点即播);未命中保持在线播,不在此处触发下载。
  const videoSrc = useCachedMediaSrc(attachment.url, { download: false });
  const poster = useCachedMediaSrc(attachment.thumbnailUrl);
  const barRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [fraction, setFraction] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  // Keep the thumbnail covering the <video> until it paints a real frame, so
  // opening doesn't flash black while the fresh element loads/decodes.
  const [frameReady, setFrameReady] = useState(false);

  // Bind the internal ref AND forward to bindPreviewVideo (which sets muted=false,
  // wires native-fullscreen-exit → close, and pauses on unbind).
  const setVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      bindVideo?.(node);
    },
    [bindVideo],
  );

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), HIDE_DELAY_MS);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  // Autoplay with sound when active; pause + reset when inactive.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      setControlsVisible(true);
      // Start muted so playback isn't gated on audio buffering (fast tap-to-play);
      // onPlaying unmutes once it's actually running.
      video.muted = true;
      void video
        .play()
        .then(() => scheduleHide())
        .catch(() => setControlsVisible(true));
    } else {
      video.pause();
      video.currentTime = 0;
      setFraction(0);
      setEnded(false);
      setFrameReady(false);
    }
  }, [active, scheduleHide]);

  // Re-show the poster whenever the media changes (carousel swipe).
  useEffect(() => {
    setFrameReady(false);
  }, [attachment.id]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (ended) {
      video.currentTime = 0;
      setEnded(false);
      void video.play().catch(() => {});
      return;
    }
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  }, [ended]);

  const seekToClientX = useCallback((clientX: number) => {
    const video = videoRef.current;
    const bar = barRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const f = fractionFromPointer(clientX, rect.left, rect.width);
    video.currentTime = seekTimeFromFraction(f, video.duration);
    setFraction(f);
    setEnded(false);
  }, []);

  // Controls stay shown while paused/ended; auto-hide only while actively playing.
  const showControls = controlsVisible || !playing || ended;

  return (
    <div
      className={`preview-video-player${showControls ? " controls-visible" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      <video
        ref={setVideoNode}
        src={videoSrc || attachment.url}
        poster={poster}
        playsInline
        preload="auto"
        aria-label={attachment.name}
        onClick={(event) => {
          event.stopPropagation();
          togglePlay();
          revealControls();
        }}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
          // 用户真的播放过这条视频 → 后台整文件落库(≤80MB,已缓存则跳过),下次本地即点即播。
          void cacheMediaFromRemote(attachment.url, { maxBytes: VIDEO_CACHE_MAX_BYTES });
        }}
        onPlaying={(event) => {
          event.currentTarget.muted = false;
          setFrameReady(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setEnded(true);
          setPlaying(false);
          setControlsVisible(true);
        }}
        onTimeUpdate={(event) => {
          if (event.currentTarget.currentTime > 0) setFrameReady(true);
          setFraction(progressFraction(event.currentTarget.currentTime, event.currentTarget.duration));
        }}
      />
      {poster ? (
        <img
          className={`preview-video-poster${frameReady ? " is-hidden" : ""}`}
          src={poster}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
      ) : null}
      <button
        type="button"
        className="preview-video-toggle"
        aria-label={ended ? "重播" : playing ? "暂停" : "播放"}
        onClick={(event) => {
          event.stopPropagation();
          togglePlay();
          revealControls();
        }}
      >
        {ended ? <RotateCcw size={28} /> : playing ? <Pause size={28} /> : <Play size={28} />}
      </button>
      <div
        ref={barRef}
        className="preview-video-progress"
        onPointerDown={(event) => {
          event.stopPropagation();
          draggingRef.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          seekToClientX(event.clientX);
          revealControls();
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return;
          event.stopPropagation();
          seekToClientX(event.clientX);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="preview-video-progress-track" aria-hidden="true" />
        <div className="preview-video-progress-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
