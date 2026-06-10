import { ImgHTMLAttributes, useEffect, useState } from "react";
import { cacheMediaFromRemote, getLocalMediaUrl, getMemoizedLocalUrl } from "../mediaCache";

/**
 * 媒体地址走本地缓存:本地(IndexedDB)命中 → objectURL 秒出;
 * 未命中 → 先用远程 URL 正常显示,同时后台落库,下次(包括杀进程后)即本地秒开。
 */
export function useCachedMediaSrc(remoteUrl?: string | null): string | undefined {
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
      } else {
        // 远程已在 <img> 中加载展示;这里仅后台落库,服务下一次打开。
        void cacheMediaFromRemote(remoteUrl);
      }
    });
    return () => { cancelled = true; };
  }, [remoteUrl]);

  return src;
}

type CachedImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | null };

/** 与 <img> 同用法,src 自动走本地缓存。 */
export function CachedImg({ src, ...rest }: CachedImgProps) {
  const cached = useCachedMediaSrc(src);
  if (!cached) return null;
  return <img src={cached} {...rest} />;
}
