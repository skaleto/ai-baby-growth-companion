import { ImgHTMLAttributes, useEffect, useRef, useState } from "react";
import {
  cacheMediaFromRemote,
  getCachedPosterUrl,
  getLocalMediaUrl,
  getMemoizedLocalUrl,
} from "../mediaCache";
import type { Attachment } from "../types";

type CachedSrcOptions = {
  /**
   * false 时只查本地、绝不触发整文件下载(用于视频流:命中本地即本地播放,
   * 未命中保持远程在线播,落库时机由播放事件另行触发)。默认 true(图片/海报)。
   */
  download?: boolean;
};

/**
 * 媒体地址走本地缓存:本地(IndexedDB)命中 → objectURL 秒出;
 * 未命中 → 先用远程 URL 正常显示;download 不为 false 时后台落库,下次(包括杀进程后)本地秒开。
 */
export function useCachedMediaSrc(remoteUrl?: string | null, options?: CachedSrcOptions): string | undefined {
  const download = options?.download !== false;
  const [src, setSrc] = useState<string | undefined>(
    () => getMemoizedLocalUrl(remoteUrl) || remoteUrl || undefined,
  );

  useEffect(() => {
    let cancelled = false;
    const memo = getMemoizedLocalUrl(remoteUrl);
    if (memo) {
      setSrc(memo);
      return () => { cancelled = true; };
    }
    setSrc(remoteUrl || undefined);
    if (!remoteUrl) return () => { cancelled = true; };
    void getLocalMediaUrl(remoteUrl).then((local) => {
      if (cancelled) return;
      if (local) {
        setSrc(local);
      } else if (download) {
        // 远程已在元素中加载展示;这里仅后台落库,服务下一次打开。
        void cacheMediaFromRemote(remoteUrl);
      }
    });
    return () => { cancelled = true; };
  }, [remoteUrl, download]);

  return src;
}

type CachedImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | null };

/**
 * 与 <img> 同用法,src 自动走本地缓存。
 * 防闪规则:远程图一旦加载完成就不再把 src 换成本地 objectURL——换源会让 <img> 重新解码、
 * 期间保留旧帧,正是预览左右滑动时「闪一下前一张」的来源。本地化只服务下一次渲染。
 */
export function CachedImg({ src, onLoad, ...rest }: CachedImgProps) {
  const remoteLoadedRef = useRef(false);
  const [resolved, setResolved] = useState<string | undefined>(
    () => getMemoizedLocalUrl(src) || src || undefined,
  );

  useEffect(() => {
    let cancelled = false;
    remoteLoadedRef.current = false;
    const memo = getMemoizedLocalUrl(src);
    if (memo) {
      setResolved(memo);
      return () => { cancelled = true; };
    }
    setResolved(src || undefined);
    if (!src) return () => { cancelled = true; };
    void getLocalMediaUrl(src).then((local) => {
      if (cancelled) return;
      if (local) {
        // 远程尚未加载完成时才切到本地(更快且无旧帧);已显示完成则保持现状,避免重绘闪动。
        if (!remoteLoadedRef.current) setResolved(local);
      } else {
        void cacheMediaFromRemote(src);
      }
    });
    return () => { cancelled = true; };
  }, [src]);

  if (!resolved) return null;
  return (
    <img
      src={resolved}
      onLoad={(event) => {
        remoteLoadedRef.current = true;
        onLoad?.(event);
      }}
      {...rest}
    />
  );
}

/**
 * 视频海报:优先用上传时生成的 thumbnailUrl(走本地缓存);没有时退回「抽帧兜底海报」
 * (看过一次该视频后由 captureVideoPosterToCache 写入)。两者都没有返回 undefined。
 */
export function useVideoPoster(attachment: Pick<Attachment, "url" | "thumbnailUrl">): string | undefined {
  const fromThumbnail = useCachedMediaSrc(attachment.thumbnailUrl);
  const [fallback, setFallback] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setFallback(undefined);
    if (attachment.thumbnailUrl || !attachment.url) return () => { cancelled = true; };
    void getCachedPosterUrl(attachment.url).then((poster) => {
      if (!cancelled && poster) setFallback(poster);
    });
    return () => { cancelled = true; };
  }, [attachment.url, attachment.thumbnailUrl]);

  return attachment.thumbnailUrl ? fromThumbnail : fallback;
}
