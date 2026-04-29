# Baby Companion Backend

Spring Boot backend for the AI baby growth companion MVP. It receives text from the mobile app, calls the DeepSeek Chat Completions API, and returns the model reply.

## Requirements

- JDK 17+
- Maven 3.9+ recommended
- DeepSeek API key

## Configuration

Set the API key as an environment variable:

```powershell
$env:DEEPSEEK_API_KEY="sk-..."
```

Optional environment variables:

```powershell
$env:DEEPSEEK_BASE_URL="https://api.deepseek.com"
$env:DEEPSEEK_MODEL="deepseek-v4-flash"
$env:APP_CORS_ALLOWED_ORIGINS="http://localhost:5174,capacitor://localhost,http://localhost"
```

## Run

```powershell
cd backend
mvn spring-boot:run
```

The service starts on:

```text
http://localhost:8080
```

## API

Health check:

```http
GET /api/health
```

Chat:

```http
POST /api/ai/chat
Content-Type: application/json

{
  "message": "今天小宝喝奶 5 次，每次 120ml，晚上醒了 3 次",
  "babyNickname": "小宝",
  "context": "宝宝 3 个月，混合喂养"
}
```

PowerShell test:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:8080/api/ai/chat" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"message":"今天小宝喝奶 5 次，每次 120ml，晚上醒了 3 次","babyNickname":"小宝","context":"宝宝 3 个月，混合喂养"}'
```

Response:

```json
{
  "reply": "已帮你整理...",
  "model": "deepseek-v4-flash",
  "requestId": "cmpl-...",
  "createdAt": "2026-04-29T12:00:00Z"
}
```

## Build

```powershell
mvn clean package
java -jar target\baby-companion-backend-0.1.0.jar
```

## Notes

- Do not put `DEEPSEEK_API_KEY` inside the mobile app.
- For production, add user authentication, request rate limits, structured logging, and persistent storage.
