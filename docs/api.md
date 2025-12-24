# Tesseract-API Reference

## Overview

The Tesseract-API provides RESTful endpoints for OCR processing with real-time progress reporting via Server-Sent Events (SSE).

## Base URL

```
http://localhost:8600
```

## Authentication

No authentication required for the current version.

## Content Types

- **Request**: `multipart/form-data` for file uploads
- **Response**: `application/json` for REST endpoints
- **SSE**: `text/event-stream` for progress monitoring

## Endpoints

### GET /ocr/status

Check service status and availability.

**Response:**
```json
{
  "service": "tesseract-api",
  "status": "ready",
  "processing": false
}
```

**Status Codes:**
- `200` - Service is ready
- `503` - Service unavailable

---

### POST /ocr/process

Submit an image for OCR processing with configurable return strategy.

**Request:**
```http
POST /ocr/process
Content-Type: multipart/form-data

image: [file]
returnStrategy: [sse|webhook|polling]
webhookUrl: [url] (required for webhook strategy)
language: [deu|eng|deu+eng]
```

**Parameters:**
- `image` (file, required) - Image file (JPEG/PNG, max 10MB)
- `returnStrategy` (query, optional) - Return strategy: `sse` (default), `webhook`, or `polling`
- `webhookUrl` (query, optional) - Webhook URL (required when returnStrategy=webhook)
- `callbackHeaders` (body, optional) - JSON object with custom headers for webhook requests
- `language` (body, optional) - OCR language: `deu` (default), `eng`, or `deu+eng` for mixed documents

**Response (SSE strategy):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "OCR processing started",
  "returnStrategy": "sse",
  "progressUrl": "/ocr/progress/550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Webhook strategy):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "OCR processing started",
  "returnStrategy": "webhook",
  "webhookUrl": "https://your-app.com/webhook"
}
```

**Response (Polling strategy):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "OCR processing started",
  "returnStrategy": "polling",
  "statusUrl": "/ocr/status/550e8400-e29b-41d4-a716-446655440000"
}
```

**Status Codes:**
- `200` - Processing started successfully
- `400` - Bad request (invalid file, service busy, etc.)
- `413` - File too large
- `415` - Unsupported media type

**Error Response:**
```json
{
  "statusCode": 400,
  "message": "No image file provided",
  "error": "Bad Request"
}
```

---

### GET /ocr/progress/{jobId}

Monitor OCR processing progress via Server-Sent Events.

**Request:**
```http
GET /ocr/progress/550e8400-e29b-41d4-a716-446655440000
Accept: text/event-stream
```

**Response Stream:**

The endpoint returns a stream of Server-Sent Events with the following format:

```
data: {"type":"progress","progress":20,"message":"Starting Tesseract OCR..."}

data: {"type":"progress","progress":50,"message":"OCR processing... 45%"}

data: {"type":"complete","progress":100,"message":"OCR processing completed","result":{...}}
```

**Event Types:**

#### Progress Event
```json
{
  "type": "progress",
  "progress": 50,
  "message": "OCR processing... 45%"
}
```

#### Completion Event
```json
{
  "type": "complete",
  "progress": 100,
  "message": "OCR processing completed",
  "result": {
    "words": [...],
    "lines": [...],
    "paragraphs": [...],
    "blocks": [...]
  }
}
```

#### Error Event
```json
{
  "type": "error",
  "error": "OCR processing failed: Invalid image format"
}
```

**Status Codes:**
- `200` - SSE stream established
- `404` - Job not found

---

### GET /ocr/status/{jobId}

Get the current status of an OCR job (for polling strategy).

**Request:**
```http
GET /ocr/status/550e8400-e29b-41d4-a716-446655440000
```

**Response (Processing):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "createdAt": "2024-01-01T12:00:00Z"
}
```

**Response (Completed):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "result": {
    "words": [...],
    "lines": [...],
    "paragraphs": [...],
    "blocks": [...]
  },
  "createdAt": "2024-01-01T12:00:00Z",
  "completedAt": "2024-01-01T12:00:05Z"
}
```

**Response (Failed):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "error": "OCR processing failed: Invalid image format",
  "createdAt": "2024-01-01T12:00:00Z",
  "completedAt": "2024-01-01T12:00:02Z"
}
```

**Status Codes:**
- `200` - Job status retrieved successfully
- `404` - Job not found

---

### POST /ocr/process-buffer

Submit image data as raw buffer for OCR processing with configurable return strategy.

**Request:**
```http
POST /ocr/process-buffer?returnStrategy=webhook&webhookUrl=https://your-app.com/webhook
Content-Type: application/octet-stream

[binary image data]
```

**Parameters:**
- `returnStrategy` (query, optional) - Return strategy: `sse` (default), `webhook`, or `polling`
- `webhookUrl` (query, optional) - Webhook URL (required when returnStrategy=webhook)
- `callbackHeaders` (query, optional) - JSON string with custom headers for webhook requests
- `language` (query, optional) - OCR language: `deu` (default), `eng`, or `deu+eng` for mixed documents

**Response:** Same format as `/ocr/process` endpoint based on return strategy.

---

### GET /ocr/debug

Get system debug information (development only).

**Response:**
```json
{
  "tempDirectory": {
    "path": "/tmp/tesseract-api",
    "exists": true,
    "writeTest": "success"
  },
  "tesseract": {
    "version": "tesseract 4.1.1",
    "availableLanguages": ["deu", "eng", "osd"]
  },
  "system": {
    "nodeVersion": "v18.17.0",
    "platform": "linux",
    "arch": "x64"
  }
}
```

## Data Models

### OCR Result Structure

The complete OCR result includes text recognition and barcode/QR code detection:

```typescript
interface OCRResult {
  words: DimensionData<TextContent>[];
  codes: DimensionData<DataContent>[];
}
```

### Base Dimension Interface

All OCR elements include position and size information:

```typescript
interface DimensionData<T = void> {
  left: number;        // X coordinate
  top: number;         // Y coordinate  
  width: number;       // Width in pixels
  height: number;      // Height in pixels
  baseline?: number;   // Text baseline (optional)
  data?: T;           // Element-specific data
}
```

### Text Content

Individual words contain text and confidence information:

```typescript
interface TextContent {
  id: string;          // Unique identifier
  text: string;        // Recognized text
  confidence?: number; // Recognition confidence (0-1)
}
```

### Data Content

Barcodes and QR codes contain decoded content and type information:

```typescript
interface DataContent {
  id: string;          // Unique identifier
  content: string;     // Decoded content
  type: 'QR_CODE' | 'BAR_CODE' | 'OTHER' | string;
}
```

### Example OCR Result

```json
{
  "words": [
    {
      "left": 100,
      "top": 50,
      "width": 80,
      "height": 20,
      "data": {
        "id": "word-1-1-1-1",
        "text": "Hello",
        "confidence": 0.95
      }
    },
    {
      "left": 190,
      "top": 50,
      "width": 60,
      "height": 20,
      "data": {
        "id": "word-1-1-1-2",
        "text": "World",
        "confidence": 0.92
      }
    }
  ],
  "codes": [
    {
      "left": 300,
      "top": 100,
      "width": 150,
      "height": 150,
      "data": {
        "id": "code-qr-1",
        "content": "https://example.com",
        "type": "QR_CODE"
      }
    },
    {
      "left": 500,
      "top": 100,
      "width": 200,
      "height": 80,
      "data": {
        "id": "code-bar-1",
        "content": "1234567890123",
        "type": "BAR_CODE"
      }
    }
  ]
}
```

## Webhook Payloads

When using the webhook return strategy, the service will send HTTP POST requests to your specified webhook URL with the following payloads:

### Successful Completion
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "result": {
    "words": [...],
    "lines": [...],
    "paragraphs": [...],
    "blocks": [...]
  },
  "timestamp": "2024-01-01T12:00:05Z"
}
```

### Processing Failure
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "error": "OCR processing failed: Invalid image format",
  "timestamp": "2024-01-01T12:00:02Z"
}
```

### Webhook Headers
- `Content-Type: application/json`
- Custom headers from `callbackHeaders` parameter (if provided)

## Client Examples

### JavaScript/Node.js

#### Basic OCR Request (German - Default)
```javascript
const FormData = require('form-data');
const fs = require('fs');

async function processImage(imagePath) {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  
  const response = await fetch('http://localhost:8600/ocr/process', {
    method: 'POST',
    body: form
  });
  
  const result = await response.json();
  console.log('Job started:', result.jobId);
  
  return result.jobId;
}
```

#### OCR Request with Language Selection
```javascript
async function processImageWithLanguage(imagePath, language = 'deu') {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  form.append('body', JSON.stringify({
    returnStrategy: 'sse',
    language: language
  }));
  
  const response = await fetch('http://localhost:8600/ocr/process', {
    method: 'POST',
    body: form
  });
  
  const result = await response.json();
  console.log('Job started:', result.jobId);
  
  return result.jobId;
}
```

#### SSE Progress Monitoring
```javascript
const EventSource = require('eventsource');

function monitorProgress(jobId) {
  const eventSource = new EventSource(`http://localhost:8600/ocr/progress/${jobId}`);
  
  eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
      case 'progress':
        console.log(`Progress: ${data.progress}% - ${data.message}`);
        break;
      case 'complete':
        console.log('OCR completed!');
        console.log('Result:', data.result);
        eventSource.close();
        break;
      case 'error':
        console.error('OCR failed:', data.error);
        eventSource.close();
        break;
    }
  };
  
  eventSource.onerror = function(error) {
    console.error('SSE error:', error);
    eventSource.close();
  };
}
```

### cURL Examples

#### Submit OCR Request (SSE - Default, German)
```bash
curl -X POST \
  -F "image=@/path/to/image.jpg" \
  http://localhost:8600/ocr/process
```

#### Submit OCR Request (English Language)
```bash
curl -X POST \
  -F "image=@/path/to/image.jpg" \
  -F 'body={"returnStrategy":"sse","language":"eng"}' \
  http://localhost:8600/ocr/process
```

#### Submit OCR Request (Webhook)
```bash
curl -X POST \
  -F "image=@/path/to/image.jpg" \
  -F 'body={"returnStrategy":"webhook","webhookUrl":"https://your-app.com/webhook","callbackHeaders":{"Authorization":"Bearer token123"}}' \
  http://localhost:8600/ocr/process
```

#### Submit OCR Request (Polling)
```bash
curl -X POST \
  -F "image=@/path/to/image.jpg" \
  -F 'body={"returnStrategy":"polling"}' \
  http://localhost:8600/ocr/process
```

#### Monitor Progress (SSE)
```bash
curl -N -H "Accept: text/event-stream" \
  http://localhost:8600/ocr/progress/550e8400-e29b-41d4-a716-446655440000
```

#### Check Job Status (Polling)
```bash
curl http://localhost:8600/ocr/status/550e8400-e29b-41d4-a716-446655440000
```

#### Check Service Status
```bash
curl http://localhost:8600/ocr/status
```

#### Buffer Mode with Webhook and Language
```bash
curl -X POST \
  --data-binary @/path/to/image.jpg \
  -H "Content-Type: application/octet-stream" \
  -G -d "returnStrategy=webhook" \
  -d "webhookUrl=https://your-app.com/webhook" \
  -d 'callbackHeaders={"Authorization":"Bearer token"}' \
  -d "language=eng" \
  http://localhost:8600/ocr/process-buffer
```

### Python Example

```python
import requests
import sseclient

def process_image_with_progress(image_path):
    # Submit OCR request
    with open(image_path, 'rb') as f:
        files = {'image': f}
        response = requests.post('http://localhost:8600/ocr/process', files=files)
    
    if response.status_code == 200:
        job_data = response.json()
        job_id = job_data['jobId']
        print(f"Job started: {job_id}")
        
        # Monitor progress
        progress_url = f"http://localhost:8600/ocr/progress/{job_id}"
        messages = sseclient.SSEClient(progress_url)
        
        for msg in messages:
            if msg.data:
                data = json.loads(msg.data)
                if data['type'] == 'progress':
                    print(f"Progress: {data['progress']}% - {data['message']}")
                elif data['type'] == 'complete':
                    print("OCR completed!")
                    return data['result']
                elif data['type'] == 'error':
                    print(f"OCR failed: {data['error']}")
                    break
    else:
        print(f"Request failed: {response.status_code}")
```

## Error Handling

### Common Error Responses

#### File Too Large
```json
{
  "statusCode": 413,
  "message": "File size must be less than 10MB",
  "error": "Payload Too Large"
}
```

#### Service Busy
```json
{
  "statusCode": 400,
  "message": "OCR service is busy, please try again later",
  "error": "Bad Request"
}
```

#### Invalid File Type
```json
{
  "statusCode": 400,
  "message": "File must be an image",
  "error": "Bad Request"
}
```

#### Job Not Found
```json
{
  "statusCode": 404,
  "message": "Job 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```

## Rate Limiting

The service processes one OCR request at a time. Concurrent requests will be rejected with a 400 status code until the current processing is complete.

## Supported Image Formats

- **JPEG** (.jpg, .jpeg)
- **PNG** (.png)
- **Maximum size**: 10MB
- **Recommended size**: Under 5MB for optimal performance

## Language Support

Currently supported languages:
- **German** (deu) - Default
- **English** (eng)
- **Mixed** (deu+eng) - For documents with both languages

**Default Behavior:** The service uses German (`deu`) by default, which provides optimal recognition for German characters (ä, ö, ü, ß). Specify a different language in the request body if needed.

**Language Selection Guidelines:**
- Use `deu` for German documents (default, no need to specify)
- Use `eng` for English-only documents
- Use `deu+eng` only for documents containing both German and English text

## Performance Considerations

- **Processing time** varies based on image size and complexity
- **Memory usage** peaks during OCR processing
- **Single-threaded** processing ensures consistent resource usage
- **Progress reporting** provides real-time feedback for long-running operations

## WebSocket Alternative

For applications that prefer WebSocket over SSE, consider implementing a WebSocket wrapper around the existing SSE endpoint.

## Versioning

Current API version: **v1** (implicit in all endpoints)

Future versions will include explicit versioning in the URL path (e.g., `/v2/ocr/process`).