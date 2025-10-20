#!/bin/bash

# Test script to verify permission fixes
# Usage: ./test-permission-fix.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTAINER_NAME="tesseract-api-permission-test"
IMAGE_NAME="tesseract-api:permission-test"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[TEST] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Cleanup function
cleanup() {
    log "Cleaning up test container and image..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    docker rmi "$IMAGE_NAME" 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT

log "Testing permission fixes for Tesseract-API"
log "Project root: $PROJECT_ROOT"
echo ""

# Step 1: Build new image with permission fixes
log "1. Building Docker image with permission fixes..."
cd "$PROJECT_ROOT"

if docker build -f docker/Dockerfile -t "$IMAGE_NAME" .; then
    log "✅ Docker image built successfully"
else
    error "❌ Failed to build Docker image"
fi
echo ""

# Step 2: Run container
log "2. Starting container for permission testing..."
if docker run -d --name "$CONTAINER_NAME" -p 8601:8600 "$IMAGE_NAME"; then
    log "✅ Container started successfully"
else
    error "❌ Failed to start container"
fi

# Wait for container to be ready
log "Waiting for container to be ready..."
sleep 5

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    error "❌ Container is not running"
fi

log "✅ Container is running"
echo ""

# Step 3: Check container logs for permission setup
log "3. Checking container startup logs..."
docker logs "$CONTAINER_NAME" | grep -E "Setting up temp|Directory|permissions|Process running|✓|✗" || log "No setup messages found"
echo ""

# Step 4: Test API availability
log "4. Testing API availability..."
for i in {1..30}; do
    if curl -s http://localhost:3001/ocr/status > /dev/null 2>&1; then
        log "✅ API is responding"
        break
    fi
    if [ $i -eq 30 ]; then
        error "❌ API did not become available within 60 seconds"
    fi
    sleep 2
done
echo ""

# Step 5: Run permission tests
log "5. Running detailed permission tests..."
if bash "$SCRIPT_DIR/test-permissions.sh" http://localhost:3001 "$CONTAINER_NAME"; then
    log "✅ Permission tests passed!"
else
    error "❌ Permission tests failed"
fi
echo ""

# Step 6: Test actual OCR functionality
log "6. Testing OCR functionality..."

# Create a simple test image
if command -v convert &> /dev/null; then
    log "Creating test image..."
    convert -size 400x100 xc:white -font Arial -pointsize 20 -fill black -gravity center -annotate +0+0 "Permission Test" /tmp/permission-test.png
    
    log "Submitting OCR request..."
    response=$(curl -s -X POST -F "image=@/tmp/permission-test.png" http://localhost:3001/ocr/process)
    
    if echo "$response" | jq -r '.jobId' > /dev/null 2>&1; then
        job_id=$(echo "$response" | jq -r '.jobId')
        log "✅ OCR request accepted, job ID: $job_id"
        
        # Wait a bit for processing
        sleep 10
        
        # Check if any files were left in temp directory
        log "Checking temp directory cleanup..."
        temp_files=$(docker exec "$CONTAINER_NAME" sh -c "ls -la /tmp/tesseract-api/ 2>/dev/null | wc -l" || echo "0")
        if [ "$temp_files" -le 2 ]; then  # Should only have . and ..
            log "✅ Temp directory is clean"
        else
            warn "⚠ Temp directory has leftover files:"
            docker exec "$CONTAINER_NAME" sh -c "ls -la /tmp/tesseract-api/ 2>/dev/null" || true
        fi
    else
        error "❌ OCR request failed: $response"
    fi
    
    # Cleanup test image
    rm -f /tmp/permission-test.png
else
    warn "⚠ ImageMagick not available, skipping OCR functionality test"
fi

echo ""
log "🎉 All permission tests completed successfully!"
log "The container is working correctly with proper permissions."

# Don't cleanup automatically - let user inspect if needed
trap - EXIT
log "Container '$CONTAINER_NAME' is still running for inspection."
log "To stop and cleanup: docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME && docker rmi $IMAGE_NAME"

exit 0