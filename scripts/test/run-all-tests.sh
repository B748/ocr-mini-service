#!/bin/bash

# Master Test Runner for Tesseract-API
# Runs all test scripts and reports overall success/failure
# Usage: ./run-all-tests.sh [api-url]

set -e

API_URL="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILED_TESTS=0
TOTAL_TESTS=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[RUNNER] $1${NC}"
}

error() {
    echo -e "${RED}[RUNNER] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[RUNNER] $1${NC}"
}

info() {
    echo -e "${BLUE}[RUNNER] $1${NC}"
}

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_script="$2"
    local test_args="${3:-}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log "Running test: $test_name"
    echo "─────────────────────────────────────────────────────────────"
    
    if [ -f "$SCRIPT_DIR/$test_script" ]; then
        if bash "$SCRIPT_DIR/$test_script" $test_args; then
            log "✅ $test_name: PASSED"
        else
            error "❌ $test_name: FAILED"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        error "❌ $test_name: SCRIPT NOT FOUND ($test_script)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
    echo ""
}

# Function to check if API is available
check_api_availability() {
    log "Checking API availability at $API_URL..."
    
    local retries=0
    local max_retries=30
    
    while [ $retries -lt $max_retries ]; do
        if curl -s -f "$API_URL/ocr/status" > /dev/null 2>&1; then
            log "✅ API is available"
            return 0
        fi
        
        retries=$((retries + 1))
        if [ $retries -lt $max_retries ]; then
            warn "API not ready, waiting... (attempt $retries/$max_retries)"
            sleep 2
        fi
    done
    
    error "❌ API is not available after $max_retries attempts"
    return 1
}

# Main execution
main() {
    log "Starting Tesseract-API Test Suite"
    log "API URL: $API_URL"
    log "Test Directory: $SCRIPT_DIR"
    echo ""
    
    # Check API availability first
    if ! check_api_availability; then
        error "Cannot proceed with tests - API is not available"
        exit 1
    fi
    
    echo ""
    
    # Run individual tests
    run_test "API Basic Tests" "test-api.sh" "$API_URL"
    run_test "Container Permissions" "test-permissions.sh" "$API_URL"
    run_test "SSE Progress Monitoring" "test-sse-client.sh" "$API_URL"
    run_test "Deployment Validation" "test-deployment.sh"
    run_test "Complete OCR Processing" "test-ocr.sh" "" "$API_URL"
    
    # Summary
    echo "═════════════════════════════════════════════════════════════"
    log "TEST SUITE SUMMARY"
    echo "═════════════════════════════════════════════════════════════"
    
    info "Total Tests: $TOTAL_TESTS"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log "Passed: $TOTAL_TESTS"
        log "Failed: 0"
        echo ""
        log "🎉 ALL TESTS PASSED! Tesseract-API is working correctly."
        exit 0
    else
        local passed_tests=$((TOTAL_TESTS - FAILED_TESTS))
        log "Passed: $passed_tests"
        error "Failed: $FAILED_TESTS"
        echo ""
        error "❌ $FAILED_TESTS test(s) failed. Please check the output above."
        exit 1
    fi
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files..."
    rm -f /tmp/test-*.json /tmp/test-*.log /tmp/ocr-result-*.json
}

# Set trap for cleanup
trap cleanup EXIT

# Check dependencies
missing_deps=()

if ! command -v curl &> /dev/null; then
    missing_deps+=("curl")
fi

if ! command -v docker &> /dev/null; then
    missing_deps+=("docker")
fi

if [ ${#missing_deps[@]} -gt 0 ]; then
    error "Missing required dependencies: ${missing_deps[*]}"
    error "Please install the missing dependencies and try again"
    exit 1
fi

# Optional dependencies
if ! command -v jq &> /dev/null; then
    warn "jq not found - JSON output will be less formatted"
fi

if ! command -v node &> /dev/null; then
    warn "Node.js not found - SSE monitoring will use curl fallback"
fi

# Run main function
main "$@"