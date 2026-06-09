# 小宝记

ai-baby-growth-companion

面向孕期到宝宝 1 岁家庭的 AI 成长记录 App。当前版本是 React + Capacitor 的移动 MVP：浏览器可预览，同一套代码可同步到 iOS 和 Android 原生工程。

## 产品文档

- 项目总索引：[harness/project-index.md](harness/project-index.md)
- 当前发展脉络：[harness/app-development-roadmap.md](harness/app-development-roadmap.md)
- 发布硬化方案：[docs/release/release-readiness.md](docs/release/release-readiness.md)
- 功能清单与验证归属：[docs/product/feature-inventory.md](docs/product/feature-inventory.md)
- 系统架构：[docs/architecture/system-architecture.md](docs/architecture/system-architecture.md)

## 本地运行

```bash
npm install
npm run dev
```

## 前端交付验证

涉及 UI、样式、交互或移动端布局的改动，交付前需要跑本地前端验证：

```bash
npm run verify:frontend
```

该命令会构建应用、启动本地预览，并用 Playwright 检查桌面冒烟和 `360x740`、`390x844`、`430x932` 三档移动视口。完整规范见：[前端验证工作流](docs/verification/frontend-verification.md)。

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

## 阿里云 ECS 部署

已有公网 IP 的 ECS 可以通过 JAR + systemd 方式部署后端。生产数据同步默认关闭，部署时也要显式保持 `SYNC_DATA=0`：

```bash
SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun
```

移动端 OTA 包必须显式注入生产 API base URL，构建后还要校验包内不含 `localhost`：

```bash
VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update
```

完整步骤、密钥文件位置、日志和备份说明见：[阿里云 ECS 公网 IP 部署](docs/ops/aliyun-ecs-deploy.md)。2026-06-05 的 OTA base URL 事故复盘见：[docs/ops/ota-incident-2026-06-05.md](docs/ops/ota-incident-2026-06-05.md)。

## 已接入的移动能力

- Capacitor iOS/Android 工程：`ios/`、`android/`
- 原生媒体选择：手机端通过 Capacitor WebView 能力选择照片/视频并上传
- 本地通知：创建提醒时通过 `@capacitor/local-notifications` 尝试注册系统通知
- 触感反馈：关键操作通过 `@capacitor/haptics` 提供轻触反馈
- OTA：通过 `@capgo/capacitor-updater` 下发前端 bundle
- 浏览器降级：非手机环境继续使用文件上传和界面内提醒

## MVP 功能

- 通过聊天记录宝宝每天的成长、喂养、睡眠、提醒和长期记忆
- 从中文自然语言中提取奶量、夜醒、哄睡难度、里程碑、提醒事项
- 自动生成成长时间线、今日照护概览、AI 记忆和提醒追踪
- 健康、疫苗、用药建议保留安全边界，不替代医生诊断

## 后端服务

仓库包含一个 Spring Boot 后端模块：[backend](backend)。当前后端提供登录、家庭共享状态、附件上传、Agent chat/stream、ASR、Pro 内测、数据权利请求、OTA 等接口。

```powershell
cd backend
$env:DEEPSEEK_API_KEY="sk-..."
mvn spring-boot:run
```

接口：

```http
GET  http://localhost:8080/api/health
POST http://localhost:8080/api/agent/chat
POST http://localhost:8080/api/agent/chat/stream
```
