import { ImgHTMLAttributes, useEffect, useState } from "react";
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
 * 取源策略:内存命中→本地秒出;否则先等 IndexedDB(上限 50ms,通常 1~5ms)——
 * 命中则**完全零网络**直接本地(杀进程后缓存真正生效的关键),未命中/超时才落到远程
 * 并后台落库。每个实例源一旦确定不再切换(换源会重解码闪旧帧,曾致预览滑动闪跳)。
 */
export function CachedImg({ src, onLoad, ...rest }: CachedImgProps) {
  const [resolved, setResolved] = useState<string | undefined>(
    () => getMemoizedLocalUrl(src) || undefined,
  );

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    const memo = getMemoizedLocalUrl(src);
    if (memo) {
      setResolved(memo);
      return () => { cancelled = true; };
    }
    setResolved(undefined);
    if (!src) return () => { cancelled = true; };
    // IDB 查询与 50ms 限时赛跑:命中走本地(零网络);超时先走远程,之后即便查到本地也不换源。
    const timer = window.setTimeout(() => {
      if (!cancelled && !settled) {
        settled = true;
        setResolved(src);
      }
    }, 50);
    void getLocalMediaUrl(src).then((local) => {
      if (cancelled) return;
      window.clearTimeout(timer);
      if (settled) {
        if (!local) void cacheMediaFromRemote(src);
        return;
      }
      settled = true;
      if (local) {
        setResolved(local);
      } else {
        setResolved(src);
        void cacheMediaFromRemote(src);
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [src]);

  if (!resolved) return null;
  return <img src={resolved} onLoad={onLoad} {...rest} />;
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
