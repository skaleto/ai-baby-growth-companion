#!/usr/bin/env bash
# 上传 backend/data/vaccine-data.json 到 OSS(公开读),供前端 vaccineData.ts 直接拉取。
# 与 OTA 包不同:疫苗数据是「同名可变」文件,故用 public-read + application/json + 短缓存(可更新)。
# 复用 upload-mobile-update-oss.sh 的凭据机制(从 ECS systemd 环境读 ALIYUN_OSS_*),用后端 OSS Java SDK 上传。
#
# 用法:
#   MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-vaccine-data.sh
# 或直连 ECS:
#   ECS_HOST=120.55.188.242 SSH_KEY=$HOME/.ssh/ai_baby_aliyun scripts/upload-vaccine-data.sh
# 或直接给 OSS 配置:
#   ALIYUN_OSS_ENDPOINT=... ALIYUN_OSS_BUCKET=... ALIYUN_OSS_ACCESS_KEY_ID=... ALIYUN_OSS_ACCESS_KEY_SECRET=... scripts/upload-vaccine-data.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_FILE="${VACCINE_DATA_FILE:-$ROOT_DIR/backend/data/vaccine-data.json}"
SERVICE_NAME="${SERVICE_NAME:-ai-baby-growth-companion}"
SSH_TARGET="${MOBILE_UPDATE_OSS_SSH_TARGET:-}"
ECS_HOST="${ECS_HOST:-}"
ECS_USER="${ECS_USER:-root}"
ECS_PORT="${ECS_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_CONFIG_DIR="${REMOTE_CONFIG_DIR:-/etc/ai-baby-growth-companion}"
REMOTE_USER="${REMOTE_USER:-babyapp}"
OBJECT_KEY="${VACCINE_DATA_OSS_OBJECT_KEY:-baby-companion/data/vaccine-data.json}"
CONTENT_TYPE="application/json; charset=utf-8"
CACHE_CONTROL="${VACCINE_DATA_CACHE_CONTROL:-public, max-age=300}"
INTELLIJ_JBR_BIN="/Applications/IntelliJ IDEA.app/Contents/jbr/Contents/Home/bin"
INTELLIJ_MAVEN="/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn"

# 让 JBR 17 的 java/javac 上 PATH(系统 java 可能过旧)。
if [[ -x "$INTELLIJ_JBR_BIN/javac" ]]; then
  export PATH="$INTELLIJ_JBR_BIN:$PATH"
fi

if [[ ! -f "$DATA_FILE" ]]; then
  echo "找不到疫苗数据文件:$DATA_FILE(先跑 node scripts/build-vaccine-data-json.mjs)" >&2
  exit 1
fi
# 校验是合法 JSON 且是 VaccineData 结构
node -e "const d=require('$DATA_FILE'); if(typeof d.version!=='string'||!Array.isArray(d.doses)||!Array.isArray(d.prices)) {console.error('vaccine-data.json 结构非法'); process.exit(1)}"

ssh_args=(-p "$ECS_PORT")
if [[ -n "$SSH_KEY" ]]; then
  ssh_args+=(-i "$SSH_KEY")
fi
if [[ -z "$SSH_TARGET" && -n "$ECS_HOST" ]]; then
  SSH_TARGET="$ECS_USER@$ECS_HOST"
fi
remote() { ssh "${ssh_args[@]}" "$SSH_TARGET" "$@"; }
remote_file() {
  remote "REMOTE_USER='$REMOTE_USER' FILE_PATH='$1' bash -s" <<'REMOTE_READ'
set -euo pipefail
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
$SUDO cat "$FILE_PATH"
REMOTE_READ
}
remote_env_value() {
  printf '%s\n' "$2" | tr ' ' '\n' | awk -F= -v key="$1" '$1 == key {print substr($0, length(key) + 2); exit}'
}

if [[ -n "$SSH_TARGET" ]]; then
  remote_environment="$(remote "systemctl show '$SERVICE_NAME' -p Environment --value 2>/dev/null || true")"
  ALIYUN_OSS_ENDPOINT="${ALIYUN_OSS_ENDPOINT:-$(remote_env_value ALIYUN_OSS_ENDPOINT "$remote_environment")}"
  ALIYUN_OSS_BUCKET="${ALIYUN_OSS_BUCKET:-$(remote_env_value ALIYUN_OSS_BUCKET "$remote_environment")}"
  ALIYUN_OSS_ACCESS_KEY_ID_FILE="${ALIYUN_OSS_ACCESS_KEY_ID_FILE:-$(remote_env_value ALIYUN_OSS_ACCESS_KEY_ID_FILE "$remote_environment")}"
  ALIYUN_OSS_ACCESS_KEY_SECRET_FILE="${ALIYUN_OSS_ACCESS_KEY_SECRET_FILE:-$(remote_env_value ALIYUN_OSS_ACCESS_KEY_SECRET_FILE "$remote_environment")}"
  ALIYUN_OSS_ACCESS_KEY_ID="${ALIYUN_OSS_ACCESS_KEY_ID:-$(remote_file "${ALIYUN_OSS_ACCESS_KEY_ID_FILE:-$REMOTE_CONFIG_DIR/aliyun_oss_access_key_id}")}"
  ALIYUN_OSS_ACCESS_KEY_SECRET="${ALIYUN_OSS_ACCESS_KEY_SECRET:-$(remote_file "${ALIYUN_OSS_ACCESS_KEY_SECRET_FILE:-$REMOTE_CONFIG_DIR/aliyun_oss_access_key_secret}")}"
fi

ALIYUN_OSS_ENDPOINT="${ALIYUN_OSS_ENDPOINT:-}"
ALIYUN_OSS_BUCKET="${ALIYUN_OSS_BUCKET:-}"
ALIYUN_OSS_ACCESS_KEY_ID="${ALIYUN_OSS_ACCESS_KEY_ID:-}"
ALIYUN_OSS_ACCESS_KEY_SECRET="${ALIYUN_OSS_ACCESS_KEY_SECRET:-}"
if [[ -z "$ALIYUN_OSS_ENDPOINT" || -z "$ALIYUN_OSS_BUCKET" || -z "$ALIYUN_OSS_ACCESS_KEY_ID" || -z "$ALIYUN_OSS_ACCESS_KEY_SECRET" ]]; then
  echo "缺少 OSS endpoint/bucket/key。请用 MOBILE_UPDATE_OSS_SSH_TARGET 或 ECS_HOST+SSH_KEY,或直接给 ALIYUN_OSS_* 环境变量。" >&2
  exit 1
fi

ENDPOINT_HOST="${ALIYUN_OSS_ENDPOINT#http://}"; ENDPOINT_HOST="${ENDPOINT_HOST#https://}"; ENDPOINT_HOST="${ENDPOINT_HOST%/}"
if [[ "$ENDPOINT_HOST" == "$ALIYUN_OSS_BUCKET."* ]]; then OSS_HOST="$ENDPOINT_HOST"; else OSS_HOST="$ALIYUN_OSS_BUCKET.$ENDPOINT_HOST"; fi
PUBLIC_URL="https://$OSS_HOST/$OBJECT_KEY"

echo "上传疫苗数据到 OSS(公开读):$OBJECT_KEY"

resolve_maven() {
  if [[ -n "${MAVEN_BIN:-}" && -x "$MAVEN_BIN" ]]; then echo "$MAVEN_BIN"; return; fi
  if [[ -x "$INTELLIJ_MAVEN" ]]; then echo "$INTELLIJ_MAVEN"; return; fi
  if command -v mvn >/dev/null 2>&1; then command -v mvn; return; fi
  echo "找不到 Maven,设 MAVEN_BIN。" >&2; exit 1
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
CLASSPATH_FILE="$TMP_DIR/classpath.txt"
(cd "$ROOT_DIR/backend" && "$(resolve_maven)" -q -DincludeScope=runtime -Dmdep.outputFile="$CLASSPATH_FILE" dependency:build-classpath)

cat > "$TMP_DIR/VaccineDataOssUploader.java" <<'JAVA'
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.CannedAccessControlList;
import com.aliyun.oss.model.ObjectMetadata;
import java.io.File;

public class VaccineDataOssUploader {
    public static void main(String[] args) {
        String endpoint = env("ALIYUN_OSS_ENDPOINT");
        String bucket = env("ALIYUN_OSS_BUCKET");
        String accessKeyId = env("ALIYUN_OSS_ACCESS_KEY_ID");
        String accessKeySecret = env("ALIYUN_OSS_ACCESS_KEY_SECRET");
        String objectKey = env("VACCINE_DATA_OSS_OBJECT_KEY");
        String filePath = env("VACCINE_DATA_FILE");
        String contentType = env("VACCINE_DATA_CONTENT_TYPE");
        String cacheControl = env("VACCINE_DATA_CACHE_CONTROL");
        OSS client = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentType(contentType);
            metadata.setCacheControl(cacheControl);
            client.putObject(bucket, objectKey, new File(filePath), metadata);
            client.setObjectAcl(bucket, objectKey, CannedAccessControlList.PublicRead);
        } finally {
            client.shutdown();
        }
    }
    private static String env(String key) {
        String v = System.getenv(key);
        if (v == null || v.isBlank()) throw new IllegalArgumentException(key + " is required");
        return v;
    }
}
JAVA

OSS_CLASSPATH="$(cat "$CLASSPATH_FILE")"
javac -cp "$OSS_CLASSPATH" "$TMP_DIR/VaccineDataOssUploader.java"
ALIYUN_OSS_ENDPOINT="$ALIYUN_OSS_ENDPOINT" \
ALIYUN_OSS_BUCKET="$ALIYUN_OSS_BUCKET" \
ALIYUN_OSS_ACCESS_KEY_ID="$ALIYUN_OSS_ACCESS_KEY_ID" \
ALIYUN_OSS_ACCESS_KEY_SECRET="$ALIYUN_OSS_ACCESS_KEY_SECRET" \
VACCINE_DATA_OSS_OBJECT_KEY="$OBJECT_KEY" \
VACCINE_DATA_FILE="$DATA_FILE" \
VACCINE_DATA_CONTENT_TYPE="$CONTENT_TYPE" \
VACCINE_DATA_CACHE_CONTROL="$CACHE_CONTROL" \
java -cp "$TMP_DIR:$OSS_CLASSPATH" VaccineDataOssUploader

echo "已上传。公开地址:"
echo "  $PUBLIC_URL"
echo "校验(HTTP 状态 + version):"
HTTP_CODE="$(curl -s -o "$TMP_DIR/check.json" -w '%{http_code}' "$PUBLIC_URL")"
echo "  HTTP $HTTP_CODE"
if [[ "$HTTP_CODE" == "200" ]]; then
  node -e "const d=require('$TMP_DIR/check.json'); console.log('  线上 version='+d.version+' doses='+d.doses.length)"
else
  echo "  ⚠️ 公开读校验未通过(HTTP $HTTP_CODE),检查 bucket 是否允许 public-read 对象。" >&2
  exit 1
fi
