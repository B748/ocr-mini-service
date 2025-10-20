#!/bin/bash

# Test script to verify container permissions
# Usage: ./test-permissions.sh

set -e

API_URL="${1:-http://localhost:8600}"
CONTAINER_NAME="${2:-tesseract-api-test-${USER:-testuser}}"
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

echo "=== Container Permission Test ==="
echo "API URL: $API_URL"
echo "Container: $CONTAINER_NAME"
echo ""

# Test 1: Check debug info
log "1. Checking debug information..."
if response=$(curl -s -w "%{http_code}" -o /tmp/debug_perm.json "$API_URL/ocr/debug" 2>/dev/null); then
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log "✓ Debug endpoint accessible"
        cat /tmp/debug_perm.json | jq . 2>/dev/null || cat /tmp/debug_perm.json
    else
        warn "⚠ Debug endpoint failed (HTTP $http_code)"
    fi
else
    warn "⚠ Could not connect to debug endpoint"
fi
echo ""

# Test 2: Check container logs for permission issues
log "2. Checking recent container logs..."
if docker logs "$CONTAINER_NAME" --tail 30 2>/dev/null > /tmp/container_logs.log; then
    log "✓ Container logs accessible"
    
    # Check for permission-related issues
    if grep -i "permission\|denied\|cannot write\|failed to setup" /tmp/container_logs.log > /tmp/perm_errors.log; then
        if [ -s /tmp/perm_errors.log ]; then
            error "✗ Found permission-related messages in logs:"
            cat /tmp/perm_errors.log
        else
            log "✓ No permission errors found in recent logs"
        fi
    else
        log "✓ No permission errors detected in logs"
    fi
    
    # Show recent setup messages
    log "Recent container setup messages:"
    grep -E "Setting up temp|Directory|permissions|Process running" /tmp/container_logs.log | tail -5 || log "No setup messages found"
else
    warn "⚠ Could not access container logs"
fi
echo ""

# Test 3: Execute commands inside container to check permissions
log "3. Testing permissions inside container..."
if docker exec "$CONTAINER_NAME" sh -c "
    echo 'Container user info:'
    id
    echo ''
    echo 'Temp directory info:'
    ls -la /tmp/tesseract-api 2>/dev/null || echo 'Temp directory does not exist'
    echo ''
    echo 'Write test:'
    mkdir -p /tmp/tesseract-api 2>/dev/null
    if touch /tmp/tesseract-api/test-write 2>/dev/null; then
        echo 'Write test: SUCCESS'
        rm -f /tmp/tesseract-api/test-write 2>/dev/null
        exit 0
    else
        echo 'Write test: FAILED'
        exit 1
    fi
" 2>/dev/null; then
    log "✓ Container permissions are working correctly"
else
    error "✗ Container permission test failed"
fi
echo ""

# Test 4: Check environment variables
log "4. Checking environment variables..."
if docker exec "$CONTAINER_NAME" sh -c "env | grep -E '(TESSERACT|TEMP|TMP)'" 2>/dev/null > /tmp/env_vars.log; then
    if [ -s /tmp/env_vars.log ]; then
        log "✓ Environment variables found:"
        cat /tmp/env_vars.log
    else
        log "✓ No specific OCR environment variables (using defaults)"
    fi
else
    warn "⚠ Could not check environment variables"
fi

# Cleanup
rm -f /tmp/debug_perm.json /tmp/perm_errors.log /tmp/env_vars.log /tmp/container_logs.log

echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    log "✅ All permission tests passed!"
    echo "=== Permission Test Complete ==="
    exit 0
else
    error "❌ $FAILED_TESTS permission test(s) failed"
    echo "=== Permission Test Complete ==="
    exit 1
fi