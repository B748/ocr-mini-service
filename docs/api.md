# Tesseract-API Reference

## Overview

The Tesseract-API provides RESTful endpoints for OCR processing with real-time progress reporting via Server-Sent Events (SSE).

## Base URL

```
http://localhost:3000
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

Submit an image for OCR processing.

**Request:**
```http
POST /ocr/process
Content-Type: multipart/form-data

image: [file]
```

**Parameters:**
- `image` (file, required) - Image file (JPEG/PNG, max 10MB)

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "OCR processing started",
  "progressUrl": "/ocr/progress/550e8400-e29b-41d4-a716-446655440000"
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

The complete OCR result follows a hierarchical structure:

```typescript
interface OCRResult {
  words: DimensionData<TextContent>[];
  lines: OCRHierarchyElement[];
  paragraphs: OCRHierarchyElement[];
  blocks: OCRHierarchyElement[];
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

### Hierarchy Elements

Lines, paragraphs, and blocks contain references to child elements:

```typescript
interface OCRHierarchyElement extends DimensionData<StructureContent> {
  childIds: string[];  // Array of child element IDs
}

interface StructureContent {
  id: string;          // Unique identifier
  type: 'H_BAR' | 'V_BAR' | 'IMAGE' | string;
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
  "lines": [
    {
      "left": 100,
      "top": 50,
      "width": 150,
      "height": 20,
      "data": {
        "id": "line-1-1-1",
        "type": "H_BAR"
      },
      "childIds": ["word-1-1-1-1", "word-1-1-1-2"]
    }
  ],
  "paragraphs": [
    {
      "left": 100,
      "top": 50,
      "width": 150,
      "height": 20,
      "data": {
        "id": "paragraph-1-1",
        "type": "V_BAR"
      },
      "childIds": ["line-1-1-1"]
    }
  ],
  "blocks": [
    {
      "left": 100,
      "top": 50,
      "width": 150,
      "height": 20,
      "data": {
        "id": "block-1",
        "type": "V_BAR"
      },
      "childIds": ["paragraph-1-1"]
    }
  ]
}
```

## Client Examples

### JavaScript/Node.js

#### Basic OCR Request
```javascript
const FormData = require('form-data');
const fs = require('fs');

async function processImage(imagePath) {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  
  const response = await fetch('http://localhost:3000/ocr/process', {
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
  const eventSource = new EventSource(`http://localhost:3000/ocr/progress/${jobId}`);
  
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

#### Submit OCR Request
```bash
curl -X POST \
  -F "image=@/path/to/image.jpg" \
  http://localhost:3000/ocr/process
```

#### Monitor Progress
```bash
curl -N -H "Accept: text/event-stream" \
  http://localhost:3000/ocr/progress/550e8400-e29b-41d4-a716-446655440000
```

#### Check Status
```bash
curl http://localhost:3000/ocr/status
```

### Python Example

```python
import requests
import sseclient

def process_image_with_progress(image_path):
    # Submit OCR request
    with open(image_path, 'rb') as f:
        files = {'image': f}
        response = requests.post('http://localhost:3000/ocr/process', files=files)
    
    if response.status_code == 200:
        job_data = response.json()
        job_id = job_data['jobId']
        print(f"Job started: {job_id}")
        
        # Monitor progress
        progress_url = f"http://localhost:3000/ocr/progress/{job_id}"
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
- **German** (deu)
- **English** (eng)

The service automatically uses both languages for optimal text recognition.

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