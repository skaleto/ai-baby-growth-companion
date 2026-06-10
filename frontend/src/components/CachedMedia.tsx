import { ImgHTMLAttributes, useEffect, useState } from "react";
import { cacheMediaFromRemote, getLocalMediaUrl, getMemoizedLocalUrl } from "../mediaCache";

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

/** 与 <img> 同用法,src 自动走本地缓存。 */
export function CachedImg({ src, ...rest }: CachedImgProps) {
  const cached = useCachedMediaSrc(src);
  if (!cached) return null;
  return <img src={cached} {...rest} />;
}
