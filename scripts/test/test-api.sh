#!/bin/bash

# Simple API Test Script
# Usage: ./test-api.sh [api-url]

set -e

API_URL="${1:-http://localhost:8600}"
FAILED_TESTS=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[TEST] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

echo "=== Tesseract-API Simple Test ==="
echo "API URL: $API_URL"
echo ""

# Test 1: Status check
log "1. Testing status endpoint..."
if response=$(curl -s -w "%{http_code}" -o /tmp/status_test.json "$API_URL/ocr/status" 2>/dev/null); then
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log "✓ Status endpoint responding correctly (HTTP $http_code)"
        cat /tmp/status_test.json | jq . 2>/dev/null || cat /tmp/status_test.json
    else
        error "✗ Status endpoint failed (HTTP $http_code)"
    fi
else
    error "✗ Could not connect to status endpoint"
fi
echo ""

# Test 2: Debug information
log "2. Getting debug information..."
if response=$(curl -s -w "%{http_code}" -o /tmp/debug_test.json "$API_URL/ocr/debug" 2>/dev/null); then
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log "✓ Debug endpoint responding correctly (HTTP $http_code)"
        cat /tmp/debug_test.json | jq . 2>/dev/null || cat /tmp/debug_test.json
    else
        warn "⚠ Debug endpoint failed (HTTP $http_code) - this is optional"
    fi
else
    warn "⚠ Could not connect to debug endpoint - this is optional"
fi
echo ""

# Test 3: Submit a simple request (will fail without image, but shows endpoint works)
log "3. Testing OCR endpoint (without image - should return error)..."
if response=$(curl -s -w "%{http_code}" -X POST -o /tmp/ocr_test.json "$API_URL/ocr/process" 2>/dev/null); then
    http_code="${response: -3}"
    if [ "$http_code" = "400" ]; then
        log "✓ OCR endpoint correctly rejects request without image (HTTP $http_code)"
        cat /tmp/ocr_test.json | jq . 2>/dev/null || cat /tmp/ocr_test.json
    else
        error "✗ OCR endpoint unexpected response (HTTP $http_code)"
    fi
else
    error "✗ Could not connect to OCR endpoint"
fi
echo ""

# Cleanup
rm -f /tmp/status_test.json /tmp/debug_test.json /tmp/ocr_test.json

# Results
if [ $FAILED_TESTS -eq 0 ]; then
    log "✅ All API tests passed successfully!"
    echo ""
    echo "=== Manual Testing Instructions ==="
    echo ""
    echo "To test with an actual image:"
    echo "curl -X POST -F \"image=@your-image.jpg\" $API_URL/ocr/process"
    echo ""
    echo "To monitor progress (replace JOB_ID with actual job ID):"
    echo "curl -N -H \"Accept: text/event-stream\" $API_URL/ocr/progress/JOB_ID"
    echo ""
    echo "Or use the SSE client:"
    echo "node test-sse-client.js JOB_ID $API_URL"
    exit 0
else
    error "❌ $FAILED_TESTS test(s) failed"
    exit 1
fi