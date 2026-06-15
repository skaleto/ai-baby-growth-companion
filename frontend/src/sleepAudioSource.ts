// 解析平台音源:Web 走 dist 根下的 /sleep-audio/*.wav;原生走插件期望的 public/ 相对路径。
// 注:native 路径格式以 mediagrid 为准——真机首验,若不符在此一处改。
export function resolveSleepAudioSource(sourceKey: string, native: boolean): string {
  return native ? `public/sleep-audio/${sourceKey}.wav` : `/sleep-audio/${sourceKey}.wav`;
}
