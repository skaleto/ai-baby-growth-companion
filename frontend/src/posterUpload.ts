// 视频封面自愈的上传实现(注入给 mediaCache):
// 抽帧成功后回传服务端补正式缩略图。独立成模块的原因:mediaCache 被 esbuild
// 逻辑测试在 Node 中打包,不得直接依赖 authApi(import.meta.env 仅 Vite 可用)。
import { apiBaseUrl, apiFetch } from "./authApi";
import { setVideoPosterUploader } from "./mediaCache";

const attempted = new Set<string>();

setVideoPosterUploader((attachmentId, blob) => {
  if (!attachmentId || attempted.has(attachmentId)) return;
  attempted.add(attachmentId);
  void (async () => {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.readAsDataURL(blob);
      });
      await apiFetch(`${apiBaseUrl}/api/uploads/${encodeURIComponent(attachmentId)}/poster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailDataUrl: dataUrl }),
      });
    } catch {
      // 尽力而为:失败静默,下次会话再试(幂等端点,绝不覆盖已有封面)。
    }
  })();
});
