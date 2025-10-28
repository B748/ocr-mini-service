# OCR Return Strategies

The OCR service supports three different return strategies for handling processing results:

## 1. Server-Sent Events (SSE) - Default

Real-time progress updates via SSE stream.

**Usage:**

```bash
# Form data upload
curl -X POST http://localhost:8600/ocr/process \
  -F "image=@document.jpg" \
  -F "returnStrategy=sse"

# Listen to progress
curl -N http://localhost:8600/ocr/progress/{jobId}
```

**Response:**

```json
{
  "jobId": "abc123",
  "message": "OCR processing started",
  "returnStrategy": "sse",
  "progressUrl": "/ocr/progress/abc123"
}
```

## 2. Webhook

Results sent to your webhook URL when processing completes.

**Usage:**

```bash
curl -X POST http://localhost:8600/ocr/process \
  -F "image=@document.jpg" \
  -F "returnStrategy=webhook" \
  -F "webhookUrl=https://your-app.com/ocr-webhook" \
  -H "Content-Type: multipart/form-data" \
  -d '{"callbackHeaders": {"Authorization": "Bearer token123"}}'
```

**Response:**

```json
{
  "jobId": "abc123",
  "message": "OCR processing started",
  "returnStrategy": "webhook",
  "webhookUrl": "https://your-app.com/ocr-webhook"
}
```

**Webhook Payload:**

```json
{
  "jobId": "abc123",
  "status": "completed",
  "result": {
    "words": [...]
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 3. Polling

Client polls for results using the status endpoint.

**Usage:**

```bash
# Start processing
curl -X POST http://localhost:8600/ocr/process \
  -F "image=@document.jpg" \
  -F "returnStrategy=polling"

# Poll for status
curl http://localhost:8600/ocr/status/{jobId}
```

**Response:**

```json
{
  "jobId": "abc123",
  "message": "OCR processing started",
  "returnStrategy": "polling",
  "statusUrl": "/ocr/status/abc123"
}
```

**Status Response:**

```json
{
  "jobId": "abc123",
  "status": "completed",
  "result": {
    "words": [...]
  },
  "createdAt": "2024-01-01T12:00:00Z",
  "completedAt": "2024-01-01T12:00:05Z"
}
```

## Buffer Mode Support

All return strategies work with buffer mode:

```bash
curl -X POST http://localhost:8600/ocr/process-buffer \
  --data-binary @document.jpg \
  -H "Content-Type: application/octet-stream" \
  -G -d "returnStrategy=webhook" \
  -d "webhookUrl=https://your-app.com/webhook" \
  -d 'callbackHeaders={"Authorization":"Bearer token"}'
```

## Error Handling

All strategies handle errors consistently:

**SSE:** Error event in stream
**Webhook:** Status "failed" with error message
**Polling:** Status "failed" with error message

## Status Values

- `processing`: OCR is currently running
- `completed`: OCR finished successfully
- `failed`: OCR encountered an error
