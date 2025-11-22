# Barcode and QR Code Detection

## Overview

The OCR microservice now includes automatic barcode and QR code detection using ZXing-C++ alongside Tesseract OCR text recognition. Both processes run in parallel for optimal performance.

## Supported Code Types

- **QR Codes**: All standard QR code formats
- **Barcodes**: EAN, UPC, Code 39, Code 128, and other common formats
- **Data Matrix**: 2D barcode format
- **PDF417**: Stacked linear barcode

## How It Works

When you submit an image for processing, the service automatically:

1. Runs Tesseract OCR for text extraction
2. Runs ZXing for barcode/QR code detection
3. Combines results into a single response

Both processes run in parallel, so detection adds minimal overhead to processing time.

## Response Format

Results include both text words and detected codes:

```json
{
  "words": [
    {
      "left": 0.1,
      "top": 0.05,
      "width": 0.08,
      "height": 0.02,
      "data": {
        "id": "word-abc123",
        "text": "Invoice",
        "confidence": 0.95
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
        "id": "code-xyz789",
        "content": "https://example.com/product/12345",
        "type": "QR_CODE"
      }
    }
  ]
}
```

## Code Types

The `type` field indicates the detected code format:

- `QR_CODE`: QR code detected
- `BAR_CODE`: Linear barcode (EAN, UPC, Code 39, Code 128, etc.)
- `OTHER`: Other supported formats (Data Matrix, PDF417, etc.)

## Position Data

Bounding box coordinates are provided in pixels:

- `left`: X coordinate of top-left corner
- `top`: Y coordinate of top-left corner
- `width`: Width of the code in pixels
- `height`: Height of the code in pixels

## Error Handling

If ZXing fails to process an image (e.g., library not installed), the service continues with text OCR only. The `codes` array will be empty, but text recognition still works normally.

## Installation

ZXing-C++ is automatically included in the Docker image via Alpine package:

```dockerfile
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-deu \
    tesseract-ocr-data-eng \
    zxing-cpp
```

## Use Cases

- **Invoice Processing**: Extract text and scan barcodes for product codes
- **Document Management**: Detect QR codes linking to digital records
- **Inventory Systems**: Read product barcodes alongside item descriptions
- **Form Processing**: Capture both handwritten/printed text and machine-readable codes
