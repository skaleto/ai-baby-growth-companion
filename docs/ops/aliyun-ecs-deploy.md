# Aliyun ECS Public IP Deployment

This project can be deployed to a single Aliyun ECS instance as a Spring Boot
JAR managed by systemd. The Android app should be built with
`VITE_AGENT_API_BASE_URL=http://<ECS_PUBLIC_IP>:8300`.

This setup is intended for prototype testing over a public IP. Current
production host is `120.55.188.242:8300`, but formal release hardening should
move to a domain, HTTPS, restricted CORS, and `wss://` for ASR. The current
HTTPS rollout checklist lives in `docs/ops/https-domain-setup.md`.

For code-only production deploys, keep production data sync disabled:

```bash
SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun
```

For OTA builds, always pass the production API base URL explicitly. The
2026-06-05 incident in `docs/ops/ota-incident-2026-06-05.md` was caused by a
bundle compiled with a localhost API base URL.

## 1. Aliyun Console Checklist

- The ECS instance has a public IP and non-zero public bandwidth.
- The security group allows inbound TCP `8300` from the networks that need to
  use the app. For quick testing this can be `0.0.0.0/0`.
- The security group allows inbound TCP `22` only from your own IP when
  possible.
- Outbound HTTPS is allowed so the backend can call DeepSeek, Doubao, and
  Doubao ASR.

## 2. Prepare Remote API Keys

SSH to ECS and create the secret files. Do not commit these values.

```bash
ssh root@<ECS_PUBLIC_IP>

mkdir -p /etc/ai-baby-growth-companion
chown root:babyapp /etc/ai-baby-growth-companion 2>/dev/null || true
chmod 750 /etc/ai-baby-growth-companion

nano /etc/ai-baby-growth-companion/deepseek_apikey
nano /etc/ai-baby-growth-companion/doubao_apikey
nano /etc/ai-baby-growth-companion/doubao_asr_key

chown root:babyapp /etc/ai-baby-growth-companion/deepseek_apikey \
  /etc/ai-baby-growth-companion/doubao_apikey \
  /etc/ai-baby-growth-companion/doubao_asr_key
chmod 640 /etc/ai-baby-growth-companion/deepseek_apikey \
  /etc/ai-baby-growth-companion/doubao_apikey \
  /etc/ai-baby-growth-companion/doubao_asr_key
```

## 3. Deploy Backend

From the project root:

```bash
ECS_HOST=<ECS_PUBLIC_IP> scripts/deploy-aliyun-ecs.sh
```

If your ECS requires an SSH key:

```bash
ECS_HOST=<ECS_PUBLIC_IP> \
SSH_KEY=~/.ssh/aliyun.pem \
scripts/deploy-aliyun-ecs.sh
```

The deploy script will:

- Build `backend/target/baby-companion-backend-0.1.0.jar`.
- Install Java 17, curl, and rsync on ECS when supported.
- Create the `babyapp` service user.
- Put the app under `/opt/ai-baby-growth-companion`.
- Put persistent SQLite, uploads, JWT secret, and invite codes under
  `/var/lib/ai-baby-growth-companion`.
- Use key files from `/etc/ai-baby-growth-companion`.
- Install and restart `ai-baby-growth-companion.service`.
- Verify `http://<ECS_PUBLIC_IP>:8300/api/health`.

By default the script does **not** sync local `backend/data` to the remote
host — `SYNC_DATA` defaults to `0`. Code-only deploys are the safe path; opt
into data sync only on a fresh ECS where you intentionally seed the database.
When `SYNC_DATA=1` is set in an interactive shell, the script also prompts
for a `yes` confirmation before copying.

Useful options:

```bash
# Default: code-only deploy, never touch backend/data on the remote.
ECS_HOST=<ECS_PUBLIC_IP> scripts/deploy-aliyun-ecs.sh

# First-time seed: upload local backend/data when the remote SQLite is missing.
SYNC_DATA=1 ECS_HOST=<ECS_PUBLIC_IP> scripts/deploy-aliyun-ecs.sh

# Force local backend/data over an existing remote data directory (DESTRUCTIVE).
SYNC_DATA=1 OVERWRITE_REMOTE_DATA=1 ECS_HOST=<ECS_PUBLIC_IP> scripts/deploy-aliyun-ecs.sh

# Deploy and build the Android debug APK in one run.
BUILD_ANDROID=1 ECS_HOST=<ECS_PUBLIC_IP> scripts/deploy-aliyun-ecs.sh
```

## 4. Build Android APK

```bash
VITE_AGENT_API_BASE_URL=http://<ECS_PUBLIC_IP>:8300 npm run build:android:debug
```

The APK will use:

- REST API: `http://<ECS_PUBLIC_IP>:8300/api/...`
- ASR WebSocket: `ws://<ECS_PUBLIC_IP>:8300/api/asr/stream`

## 5. Operations

```bash
# Health check
curl http://<ECS_PUBLIC_IP>:8300/api/health

# Service status
ssh root@<ECS_PUBLIC_IP> 'systemctl status ai-baby-growth-companion'

# Logs
ssh root@<ECS_PUBLIC_IP> 'journalctl -u ai-baby-growth-companion -f'

# Restart
ssh root@<ECS_PUBLIC_IP> 'systemctl restart ai-baby-growth-companion'
```

## 6. Data and Backup

Back up this directory regularly:

```text
/var/lib/ai-baby-growth-companion
```

It contains SQLite data, uploaded files, JWT secret, and invite codes. Losing
or regenerating the JWT secret will log existing clients out.
