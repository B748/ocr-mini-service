#!/bin/bash

# Complete OCR Test Script with SSE monitoring
# Usage: ./test-ocr-complete.sh [image-file] [api-url]

set -e

API_URL="${2:-http://localhost:3000}"
IMAGE_FILE="${1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARN: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO: $1${NC}"
}

# Create test image if none provided
create_test_image() {
    local test_image="/tmp/test-ocr-$(date +%s).png"
    
    if command -v convert &> /dev/null; then
        log "Creating test image with ImageMagick..."
        convert -size 600x200 xc:white \
                -font Arial -pointsize 24 -fill black \
                -gravity center \
                -annotate +0-30 "Tesseract API Test" \
                -annotate +0+0 "OCR Processing Demo" \
                -annotate +0+30 "$(date '+%Y-%m-%d %H:%M:%S')" \
                "$test_image"
    elif command -v python3 &> /dev/null && python3 -c "import PIL" 2>/dev/null; then
        log "Creating test image with Python PIL..."
        python3 << EOF
from PIL import Image, ImageDraw, ImageFont
import datetime

img = Image.new('RGB', (600, 200), color='white')
draw = ImageDraw.Draw(img)

try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
except:
    font = ImageFont.load_default()

draw.text((300, 60), "Tesseract API Test", fill='black', anchor='mm', font=font)
draw.text((300, 100), "OCR Processing Demo", fill='black', anchor='mm', font=font)
draw.text((300, 140), datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'), fill='black', anchor='mm', font=font)

img.save('$test_image')
EOF
    else
        error "Cannot create test image. Please provide an image file or install ImageMagick/Python PIL"
    fi
    
    if [ -f "$test_image" ]; then
        log "Test image created: $test_image"
        echo "$test_image"
    else
        error "Failed to create test image"
    fi
}

# Check if API is available
check_api() {
    log "Checking API availability at $API_URL..."
    
    if curl -s -f "$API_URL/ocr/status" > /dev/null; then
        log "✓ API is available"
        curl -s "$API_URL/ocr/status" | jq . 2>/dev/null || curl -s "$API_URL/ocr/status"
    else
        error "✗ API is not available at $API_URL"
    fi
}

# Submit OCR request
submit_ocr_request() {
    local image_file="$1"
    
    log "Submitting OCR request with image: $(basename "$image_file")"
    log "Image size: $(du -h "$image_file" | cut -f1)"
    
    local response=$(curl -s -X POST -F "image=@$image_file" "$API_URL/ocr/process")
    
    if echo "$response" | jq . > /dev/null 2>&1; then
        log "✓ OCR request submitted successfully"
        echo "$response" | jq .
        
        local job_id=$(echo "$response" | jq -r '.jobId')
        if [ "$job_id" != "null" ] && [ -n "$job_id" ]; then
            echo "$job_id"
        else
            error "No job ID received in response"
        fi
    else
        error "Failed to submit OCR request: $response"
    fi
}

# Monitor progress with SSE
monitor_progress() {
    local job_id="$1"
    
    log "Monitoring progress for job: $job_id"
    log "Starting SSE client..."
    
    if [ -f "$SCRIPT_DIR/test-sse-client.js" ]; then
        node "$SCRIPT_DIR/test-sse-client.js" "$job_id" "$API_URL"
    else
        warn "SSE client not found, using curl fallback..."
        
        # Fallback: use curl to monitor (less pretty but functional)
        timeout 60s curl -N -H "Accept: text/event-stream" \
            "$API_URL/ocr/progress/$job_id" | while IFS= read -r line; do
            if [[ $line == data:* ]]; then
                local data="${line#data: }"
                echo "[$(date +'%H:%M:%S')] $data" | jq . 2>/dev/null || echo "[$(date +'%H:%M:%S')] $data"
            fi
        done
    fi
}

# Main execution
main() {
    log "Starting complete OCR test..."
    log "API URL: $API_URL"
    
    # Check API availability
    check_api
    echo ""
    
    # Determine image file
    if [ -z "$IMAGE_FILE" ]; then
        warn "No image file provided, creating test image..."
        IMAGE_FILE=$(create_test_image)
        CLEANUP_IMAGE=true
    elif [ ! -f "$IMAGE_FILE" ]; then
        error "Image file not found: $IMAGE_FILE"
    else
        log "Using provided image: $IMAGE_FILE"
        CLEANUP_IMAGE=false
    fi
    
    echo ""
    
    # Submit OCR request
    JOB_ID=$(submit_ocr_request "$IMAGE_FILE")
    echo ""
    
    # Monitor progress
    log "Job ID: $JOB_ID"
    monitor_progress "$JOB_ID"
    
    # Cleanup
    if [ "$CLEANUP_IMAGE" = true ] && [ -f "$IMAGE_FILE" ]; then
        log "Cleaning up test image..."
        rm -f "$IMAGE_FILE"
    fi
    
    log "Complete OCR test finished!"
    exit 0
}

# Cleanup function
cleanup() {
    if [ "$CLEANUP_IMAGE" = true ] && [ -f "$IMAGE_FILE" ]; then
        rm -f "$IMAGE_FILE"
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Check dependencies
if ! command -v curl &> /dev/null; then
    error "curl is required but not installed"
fi

if ! command -v jq &> /dev/null; then
    warn "jq not found - JSON output will be less pretty"
fi

if ! command -v node &> /dev/null; then
    warn "Node.js not found - will use curl fallback for SSE monitoring"
fi

# Run main function
main "$@"