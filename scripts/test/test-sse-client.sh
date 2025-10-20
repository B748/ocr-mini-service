#!/bin/bash

# OCR API SSE Test Client
# TESTS IMAGE UPLOAD AND RESULT VIA SERVER-SENT EVENTS

set -e

# CONFIGURATION
API_BASE_URL="${1:-${API_BASE_URL:-http://localhost:3000}}"
TEST_IMAGE="${TEST_IMAGE:-doc.1.jpg}"
TIMEOUT="${TIMEOUT:-300}"

# COLORS FOR OUTPUT
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # NO COLOR

# LOGGING FUNCTIONS
log_info() {
    echo -e "${BLUE}[-INFO-]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[-DONE-]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[-WARN-]${NC} $1"
}

log_error() {
    echo -e "${RED}[-FAIL-]${NC} $1"
}

# CHECK DEPENDENCIES
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_warning "jq not found - JSON output will not be formatted"
    fi

    log_success "Dependencies check passed"
}

# CHECK IF TEST IMAGE EXISTS
check_test_image() {
    log_info "Checking test image: $TEST_IMAGE"

    if [ ! -f "$TEST_IMAGE" ]; then
        log_error "Test image not found: $TEST_IMAGE"
        log_info "Please ensure the test image exists in the current directory"
        exit 1
    fi

    # Get file size
    local file_size=$(stat -c%s "$TEST_IMAGE" 2>/dev/null || stat -f%z "$TEST_IMAGE" 2>/dev/null || echo "unknown")
    log_success "Test image found (size: $file_size bytes)"
}

# CHECK API HEALTH
check_api_health() {
    log_info "Checking API health at $API_BASE_URL"

    local response=$(curl -s -w "%{http_code}" -o /dev/null "$API_BASE_URL/ocr/status" || echo "000")

    if [ "$response" = "200" ]; then
        log_success "API is healthy"
    else
        log_error "API health check failed (HTTP $response)"
        log_info "Please ensure the OCR service is running at $API_BASE_URL"
        exit 1
    fi
}

# START OCR PROCESSING AND GET JOB ID
start_ocr_processing() {
    log_info "Starting OCR processing..."

    local response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -F "image=@$TEST_IMAGE" \
        "$API_BASE_URL/ocr/process" 2>/dev/null)

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)

    if [ "$http_code" = "201" ]; then
        local job_id=$(echo "$body" | jq -r '.jobId' 2>/dev/null || echo "$body" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
        log_success "OCR processing started (Job ID: $job_id)"

        log_info "Establishing SSE connection..."
        curl -s -N \
            -H "Accept: text/event-stream" \
            -H "Cache-Control: no-cache" \
            "$API_BASE_URL/ocr/progress/$job_id"
    else
        log_error "Failed to start OCR processing (HTTP $http_code)"
        echo "$body"
        exit 1
    fi
}

# MAIN EXECUTION
main() {
    log_info "Starting OCR API SSE Test"
    log_info "API URL: $API_BASE_URL"
    log_info "Test Image: $TEST_IMAGE"
    log_info "Timeout: $TIMEOUT seconds"
    echo
    
    check_dependencies
    check_test_image
#    check_api_health
    
    echo
    start_ocr_processing

    echo
    log_success "OCR API SSE test completed successfully!"
}

# HANDLE SCRIPT ARGUMENTS
case "${1:-}" in
    -h|--help)
        echo "Usage: $0 [api-url] [options]"
        echo
        echo "Arguments:"
        echo "  api-url         API base URL (default: http://localhost:3000)"
        echo
        echo "Environment variables:"
        echo "  API_BASE_URL    API base URL (overridden by first argument)"
        echo "  TEST_IMAGE      Test image path (default: test.1.jpg)"
        echo "  TIMEOUT         Timeout in seconds (default: 300)"
        echo
        echo "Examples:"
        echo "  $0                                    # Use defaults"
        echo "  $0 http://api:3000                   # Custom API URL"
        echo "  API_BASE_URL=http://api:3000 $0      # Custom API URL via env"
        echo "  TEST_IMAGE=my-test.jpg $0            # Custom test image"
        echo "  TIMEOUT=600 $0                       # Custom timeout"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac