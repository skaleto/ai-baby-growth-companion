# 小宝成长伙伴

ai-baby-growth-companion

面向孕期到宝宝 1 岁家庭的 AI 成长记录 App。当前版本是 React + Capacitor 的移动 MVP：浏览器可预览，同一套代码可同步到 iOS 和 Android 原生工程。

## 产品文档

- [AI宝宝成长伙伴 App 需求文档](docs/product-requirements.md)

## 本地运行

```bash
npm install
npm run dev
```

## 移动端构建

```bash
npm run build
npm run mobile:sync
```

仓库已经包含 `ios/` 和 `android/` 原生工程。只有在删除原生目录后才需要重新生成：

```bash
npm run mobile:init
```

打开原生 IDE：

```bash
npm run mobile:ios
npm run mobile:android
```

发布到真机或商店前需要：

- iOS：安装完整 Xcode，并在 Xcode 中配置 Team、Bundle Identifier、签名和 App Store Connect 信息。
- Android：安装 Android Studio 和 JDK 17+，再用 Android Studio 或 Gradle 生成 release 包。

## 已接入的移动能力

- Capacitor iOS/Android 工程：`ios/`、`android/`
- 原生相机/相册：手机端通过 `@capacitor/camera` 添加成长照片
- 本地通知：创建提醒时通过 `@capacitor/local-notifications` 尝试注册系统通知
- 触感反馈：关键操作通过 `@capacitor/haptics` 提供轻触反馈
- 浏览器降级：非手机环境继续使用文件上传和界面内提醒

## MVP 功能

- 通过聊天记录宝宝每天的成长、喂养、睡眠、提醒和长期记忆
- 从中文自然语言中提取奶量、夜醒、哄睡难度、里程碑、提醒事项
- 自动生成成长时间线、今日照护概览、AI 记忆和提醒追踪
- 健康、疫苗、用药建议保留安全边界，不替代医生诊断
