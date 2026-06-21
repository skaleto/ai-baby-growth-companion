// 解析哄睡音源:这些 wav 是 Vite public 资产,在 WebView/浏览器里统一从 dist 根路径读取。
// native 参数保留给端口层调用兼容;当前本地包内音源不再走原生相对路径。
export function resolveSleepAudioSource(sourceKey: string, _native: boolean): string {
  return `/sleep-audio/${sourceKey}.wav`;
}
