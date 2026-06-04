# HTTPS + 域名 + CORS 启用指南（REQ-OPS-001, R0.5）

- 创建日期：2026-06-05
- 状态：R0.5 运维准备项（配置模板 + 步骤；实际启用需用户提供正式域名）
- 关联：`scripts/deploy-aliyun-ecs.sh`、`docs/superpowers/specs/2026-06-05-release-readiness-improvement-design.md`（REQ-OPS-001）

> 当前生产为单 ECS（`120.55.188.242:8300`）裸 IP + HTTP。R0.5 要求：真实家庭数据不能明文传输，公网访问统一走 HTTPS，App 生产包不再访问裸 IP。本指南给出最小落地步骤与模板；实际执行需先有一个正式域名（成本：域名约几十元/年；证书 Let's Encrypt 免费）。

## 1. 前置：域名 + 备案

- 注册域名（如 `api.xiaobaoji.app`），解析 A 记录到 `120.55.188.242`。
- 国内服务器需完成 ICP 备案（域名指向境内 ECS 时必须），备案号在 App/官网展示（REQ-PRIV-004）。

## 2. Nginx 反代 + HTTPS（在 ECS 上）

```nginx
# /etc/nginx/conf.d/xiaobaoji.conf
server {
    listen 80;
    server_name api.xiaobaoji.app;
    location / { return 301 https://$host$request_uri; }   # HTTP 强制跳 HTTPS
}
server {
    listen 443 ssl http2;
    server_name api.xiaobaoji.app;

    ssl_certificate     /etc/letsencrypt/live/api.xiaobaoji.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.xiaobaoji.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 30m;             # 媒体上传（与 app 大文件限制对齐）

    location / {
        proxy_pass http://127.0.0.1:8300;  # 反代到后端
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;           # 覆盖 AI 流式 final 的长耗时
        proxy_buffering off;               # SSE 流式（agent chat stream）必须关 buffering
    }
}
```

证书签发与自动续期（免费）：
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.xiaobaoji.app          # 自动写证书 + 配置
sudo systemctl status certbot.timer                # 自动续期已启用
```

## 3. CORS 收敛（后端 / 部署脚本）

当前 CORS 在 `scripts/deploy-aliyun-ecs.sh`（`CORS_ORIGINS`）注入。R0.5 收敛为只允许正式域名 + 开发 + Capacitor：

```
CORS_ORIGINS="https://api.xiaobaoji.app,https://www.xiaobaoji.app,http://localhost:5173,http://localhost,capacitor://localhost"
```
- 移除裸 IP `http://120.55.188.242:8300`。
- `proxy_buffering off` 保证 `/api/agent/chat/stream` 的 SSE 不被 Nginx 缓冲（否则流式吐字失效）。

## 4. App 生产包改用 HTTPS 域名

- `VITE_AGENT_API_BASE_URL` 与 `ANDROID_API_BASE_URL` 从 `http://120.55.188.242:8300` 改为 `https://api.xiaobaoji.app`。
- 移动端 OTA / OSS bundle URL 一并走 HTTPS。
- 重新出包后，生产包扫描不应再含裸 IP（验收项）。

## 5. 验收（REQ-OPS-001）

- [ ] `https://api.xiaobaoji.app/api/health` 返回 `ok`
- [ ] `http://api.xiaobaoji.app/...` 自动 301 跳 HTTPS
- [ ] 生产包内 grep 不含 `120.55.188.242`
- [ ] `/api/agent/chat/stream` 在 HTTPS 下流式正常（验证 `proxy_buffering off` 生效）
- [ ] 备案号在 App/官网可见

## 6. 成本与工期（单人开发者）

| 项 | 钱 | 工期 |
|---|---|---|
| 域名 | ~几十元/年 | — |
| 证书（Let's Encrypt） | 免费 | — |
| Nginx + certbot 配置 | 0 | ~0.5 天 |
| CORS 收敛 + 改 API base + 重新出包 | 0 | ~0.5 天 |
| ICP 备案 | 0 | 数天（审核周期，提前办） |

> 备案审核有周期，建议最先启动；其余配置半天内可完成。
