// Plyr 3.x 的类型经 package.json exports 暴露,本项目 moduleResolution=Node 读不到——
// 本地最小声明(仅覆盖我们使用的 API 面);升级 moduleResolution=bundler 后可删除。
declare module "plyr" {
  export type PlyrOptions = {
    controls?: string[];
    autoplay?: boolean;
    clickToPlay?: boolean;
    fullscreen?: { enabled?: boolean };
    storage?: { enabled?: boolean };
    iconUrl?: string;
  };
  export default class Plyr {
    constructor(target: HTMLElement, options?: PlyrOptions);
    play(): Promise<void> | void;
    pause(): void;
    destroy(): void;
  }
}
