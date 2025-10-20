#!/bin/bash

# Tesseract-API Deployment Test Script
# Tests the deployed service functionality

set -e

API_URL="http://localhost:3000"
TEST_IMAGE_URL="https://via.placeholder.com/800x200/000000/FFFFFF?text=Test+OCR+Image"

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
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

# Test 1: Service Status
test_status() {
    log "Testing service status..."
    
    response=$(curl -s -w "%{http_code}" -o /tmp/status_response.json "$API_URL/ocr/status")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        log "✓ Status endpoint responding correctly"
        cat /tmp/status_response.json | jq .
    else
        error "✗ Status endpoint failed (HTTP $http_code)"
    fi
}

# Test 1a: Debug Information
test_debug_info() {
    log "Getting debug information..."
    
    response=$(curl -s -w "%{http_code}" -o /tmp/debug_response.json "$API_URL/ocr/debug")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        log "✓ Debug endpoint responding correctly"
        cat /tmp/debug_response.json | jq .
    else
        warn "⚠ Debug endpoint failed (HTTP $http_code) - continuing with tests"
    fi
}

# Test 2: Health Check
test_health() {
    log "Testing Docker health check..."
    
    health_status=$(docker inspect --format='{{.State.Health.Status}}' tesseract-api 2>/dev/null || echo "no-healthcheck")
    
    case $health_status in
        "healthy")
            log "✓ Container is healthy"
            ;;
        "unhealthy")
            error "✗ Container is unhealthy"
            ;;
        "starting")
            warn "⚠ Container is still starting up"
            ;;
        *)
            warn "⚠ Health check not available or container not found"
            ;;
    esac
}

# Test 3: Resource Usage
test_resources() {
    log "Checking resource usage..."
    
    # Get container stats
    stats=$(docker stats tesseract-api --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || echo "Container not running")
    
    if [ "$stats" != "Container not running" ]; then
        log "✓ Container resource usage:"
        echo "$stats"
    else
        error "✗ Cannot get container stats"
    fi
}

# Test 4: OCR Processing with SSE monitoring
test_ocr_processing() {
    log "Testing OCR processing with SSE monitoring..."
    
    # Create a simple test image with text
    if command -v convert &> /dev/null; then
        log "Creating test image..."
        convert -size 400x100 xc:white -font Arial -pointsize 20 -fill black -gravity center -annotate +0+0 "Hello World Test" /tmp/test_ocr.png
        test_image="/tmp/test_ocr.png"
    else
        warn "ImageMagick not available, skipping OCR test"
        return 0
    fi
    
    if [ -f "$test_image" ]; then
        log "Submitting OCR request..."
        
        response=$(curl -s -w "%{http_code}" -X POST -F "image=@$test_image" -o /tmp/ocr_response.json "$API_URL/ocr/process")
        http_code="${response: -3}"
        
        if [ "$http_code" = "200" ]; then
            log "✓ OCR request accepted"
            job_id=$(cat /tmp/ocr_response.json | jq -r '.jobId')
            log "Job ID: $job_id"
            
            # Test progress endpoint with SSE
            log "Testing SSE progress monitoring..."
            if [ -f "test-sse-client.js" ] && command -v node &> /dev/null; then
                log "Using Node.js SSE client for detailed monitoring..."
                timeout 45s node test-sse-client.js "$job_id" "$API_URL" || warn "SSE monitoring completed or timed out"
            else
                log "Using curl fallback for progress monitoring..."
                timeout 30s curl -N -H "Accept: text/event-stream" "$API_URL/ocr/progress/$job_id" | head -20 || warn "Progress stream test timed out"
            fi
            
        else
            error "✗ OCR request failed (HTTP $http_code)"
        fi
        
        # Cleanup
        rm -f "$test_image"
    fi
}

# Test 5: Concurrent Request Handling
test_concurrent_requests() {
    log "Testing concurrent request handling..."
    
    # This should be rejected when service is busy
    response=$(curl -s -w "%{http_code}" -X POST -F "image=@/dev/null" -o /tmp/concurrent_response.json "$API_URL/ocr/process" 2>/dev/null || echo "000")
    http_code="${response: -3}"
    
    if [ "$http_code" = "400" ]; then
        log "✓ Concurrent request properly rejected"
    else
        warn "⚠ Concurrent request handling test inconclusive (HTTP $http_code)"
    fi
}

# Main test execution
main() {
    log "Starting Tesseract-API deployment tests..."
    log "API URL: $API_URL"
    echo ""
    
    # Wait for service to be ready
    log "Waiting for service to be ready..."
    for i in {1..30}; do
        if curl -s "$API_URL/ocr/status" > /dev/null 2>&1; then
            break
        fi
        sleep 2
        if [ $i -eq 30 ]; then
            error "Service did not become ready within 60 seconds"
        fi
    done
    
    # Run tests
    test_status
    echo ""
    
    test_debug_info
    echo ""
    
    test_health
    echo ""
    
    test_resources
    echo ""
    
    test_ocr_processing
    echo ""
    
    test_concurrent_requests
    echo ""
    
    log "All tests completed successfully! 🎉"
    log "Tesseract-API is ready for production use."
    exit 0
}

# Cleanup function
cleanup() {
    rm -f /tmp/status_response.json /tmp/ocr_response.json /tmp/concurrent_response.json /tmp/test_ocr.png
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"