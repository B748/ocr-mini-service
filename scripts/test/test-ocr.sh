#!/bin/bash

# OCR MICROSERVICE TEST SCRIPT
# Tests the OCR microservice by sending an image and displaying results

set -e

# DEFAULT VALUES
SERVER_URL="http://localhost:8600"
RETURN_STRATEGY="polling"
SHOW_HELP=false

# FUNCTION TO SHOW USAGE
show_usage() {
    echo "Usage: $0 <image_path> [server_url] [return_strategy]"
    echo ""
    echo "Arguments:"
    echo "  image_path       Path to image file (JPEG/PNG, < 10MB)"
    echo "  server_url       OCR service URL (default: http://localhost:8600)"
    echo "  return_strategy  'polling' or 'sse' (default: polling)"
    echo ""
    echo "Examples:"
    echo "  $0 test.1.jpg"
    echo "  $0 test.1.jpg http://localhost:8600 sse"
    echo "  $0 ../../docs/document.png http://192.168.1.100:8600 polling"
    echo ""
    exit 1
}

# PARSE ARGUMENTS
if [ $# -eq 0 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_usage
fi

IMAGE_PATH="$1"
if [ $# -ge 2 ]; then
    SERVER_URL="$2"
fi
if [ $# -ge 3 ]; then
    RETURN_STRATEGY="$3"
fi

# VALIDATE RETURN STRATEGY
if [[ ! "$RETURN_STRATEGY" =~ ^(polling|sse)$ ]]; then
    echo "[ERROR] Invalid return strategy: $RETURN_STRATEGY. Use 'polling' or 'sse'" >&2
    exit 1
fi

# VALIDATE INPUT
if [ ! -f "$IMAGE_PATH" ]; then
    echo "[ERROR] Image file not found: $IMAGE_PATH" >&2
    exit 1
fi

# CHECK FILE SIZE (10MB = 10485760 bytes)
FILE_SIZE=$(stat -c%s "$IMAGE_PATH" 2>/dev/null || stat -f%z "$IMAGE_PATH" 2>/dev/null)
MAX_SIZE=10485760

if [ "$FILE_SIZE" -gt "$MAX_SIZE" ]; then
    FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE / 1048576" | bc)
    echo "[ERROR] Image file too large: ${FILE_SIZE_MB}MB (max 10MB)" >&2
    exit 1
fi

# CHECK FILE EXTENSION
EXTENSION=$(echo "${IMAGE_PATH##*.}" | tr '[:upper:]' '[:lower:]')
if [[ ! "$EXTENSION" =~ ^(jpg|jpeg|png)$ ]]; then
    echo "[ERROR] Unsupported file format: .$EXTENSION. Supported: jpg, jpeg, png" >&2
    exit 1
fi

# DETERMINE MIME TYPE
case "$EXTENSION" in
    jpg|jpeg) MIME_TYPE="image/jpeg" ;;
    png) MIME_TYPE="image/png" ;;
    *) MIME_TYPE="image/jpeg" ;;
esac

FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE / 1048576" | bc)

echo "[OCR] Testing OCR Microservice"
echo "[FILE] Image: $IMAGE_PATH (${FILE_SIZE_MB} MB)"
echo "[SERVER] Server: $SERVER_URL"
echo "[MODE] Return strategy: $RETURN_STRATEGY"
echo ""

# CHECK DEPENDENCIES
if ! command -v curl >/dev/null 2>&1; then
    echo "[ERROR] curl is required but not installed" >&2
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "[ERROR] jq is required but not installed" >&2
    exit 1
fi

# CHECK SERVER STATUS
echo "[WAIT] Checking server status..."
if ! STATUS_RESPONSE=$(curl -s -f --connect-timeout 10 "$SERVER_URL/ocr/status"); then
    echo "[ERROR] Cannot connect to OCR server at $SERVER_URL" >&2
    exit 1
fi

echo "[OK] Server is running"

# SEND OCR REQUEST
echo "[SEND] Sending multipart request..."

RESPONSE=$(curl -s -X POST "$SERVER_URL/ocr/process" \
    -F "image=@$IMAGE_PATH;type=$MIME_TYPE" \
    -F "body={\"returnStrategy\":\"$RETURN_STRATEGY\"}" \
    -w "%{http_code}")

# EXTRACT HTTP STATUS CODE (LAST 3 CHARACTERS)
HTTP_CODE="${RESPONSE: -3}"
RESPONSE_BODY="${RESPONSE%???}"

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
    echo "[ERROR] HTTP $HTTP_CODE: $RESPONSE_BODY" >&2
    exit 1
fi

# PARSE RESPONSE
JOB_ID=$(echo "$RESPONSE_BODY" | jq -r '.jobId')
if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
    echo "[ERROR] Invalid response: $RESPONSE_BODY" >&2
    exit 1
fi

echo "[JOB] Started job: $JOB_ID"

if [ "$RETURN_STRATEGY" = "sse" ]; then
    # SSE MODE - LISTEN FOR REAL-TIME PROGRESS
    echo "[SSE] Connecting to progress stream..."
    START_TIME=$(date +%s)
    
    # CREATE TEMPORARY FILE FOR SSE OUTPUT
    SSE_OUTPUT=$(mktemp)
    trap "rm -f $SSE_OUTPUT" EXIT
    
    # START SSE CONNECTION IN BACKGROUND
    curl -s -N --no-buffer "$SERVER_URL/ocr/progress/$JOB_ID" > "$SSE_OUTPUT" &
    CURL_PID=$!
    
    # MONITOR SSE EVENTS
    tail -f "$SSE_OUTPUT" 2>/dev/null | while IFS= read -r line; do
        if [[ "$line" =~ ^data:\ (.*)$ ]]; then
            EVENT_DATA="${BASH_REMATCH[1]}"
            
            # SKIP EMPTY DATA LINES
            if [ -z "$EVENT_DATA" ] || [ "$EVENT_DATA" = " " ]; then
                continue
            fi
            
            # PARSE EVENT DATA
            EVENT_TYPE=$(echo "$EVENT_DATA" | jq -r '.type // "unknown"')
            
            case "$EVENT_TYPE" in
                "progress")
                    STAGE=$(echo "$EVENT_DATA" | jq -r '.stage // "unknown"')
                    PERCENT=$(echo "$EVENT_DATA" | jq -r '.percent // 0')
                    echo "  [PROGRESS] $STAGE: ${PERCENT}%"
                    ;;
                "completed"|"complete")
                    END_TIME=$(date +%s)
                    DURATION=$((END_TIME - START_TIME))
                    
                    echo "[SUCCESS] OCR completed!"
                    echo "[TIME] Duration: $DURATION seconds"
                    echo ""
                    
                    # EXTRACT RESULTS FROM SSE EVENT
                    RESULT=$(echo "$EVENT_DATA" | jq '.result')
                    WORD_COUNT=$(echo "$RESULT" | jq '.words | length')
                    LINE_COUNT=$(echo "$RESULT" | jq '.lines | length')
                    PARAGRAPH_COUNT=$(echo "$RESULT" | jq '.paragraphs | length')
                    BLOCK_COUNT=$(echo "$RESULT" | jq '.blocks | length')
                    
                    echo "[RESULTS] OCR Results Summary:"
                    echo "  Words: $WORD_COUNT"
                    echo "  Lines: $LINE_COUNT"
                    echo "  Paragraphs: $PARAGRAPH_COUNT"
                    echo "  Blocks: $BLOCK_COUNT"
                    
                    if [ "$WORD_COUNT" -gt 0 ]; then
                        echo "[TEXT] Extracted Text:"
                        ALL_TEXT=$(echo "$RESULT" | jq -r '.words[].data.text' | tr '\n' ' ')
                        echo "$ALL_TEXT"
                        echo ""
                    fi
                    
                    # SAVE RESULTS
                    OUTPUT_FILE="ocr-result-$(date +%Y%m%d-%H%M%S).json"
                    echo "$RESULT" | jq '.' > "$OUTPUT_FILE"
                    echo "[SAVE] Results saved to: $OUTPUT_FILE"
                    
                    # CLEANUP AND EXIT
                    kill $CURL_PID 2>/dev/null || true
                    exit 0
                    ;;
                "failed")
                    ERROR_MSG=$(echo "$EVENT_DATA" | jq -r '.error // "Unknown error"')
                    echo "[ERROR] OCR failed: $ERROR_MSG" >&2
                    kill $CURL_PID 2>/dev/null || true
                    exit 1
                    ;;
                "error")
                    ERROR_MSG=$(echo "$EVENT_DATA" | jq -r '.message // "Unknown error"')
                    echo "[ERROR] SSE error: $ERROR_MSG" >&2
                    kill $CURL_PID 2>/dev/null || true
                    exit 1
                    ;;
                *)
                    echo "  [EVENT] $EVENT_TYPE"
                    ;;
            esac
        fi
    done
    
    # IF WE GET HERE, SSE STREAM ENDED WITHOUT COMPLETION
    kill $CURL_PID 2>/dev/null || true
    echo "[ERROR] SSE stream ended unexpectedly" >&2
    exit 1
    
else
    # POLLING MODE - ORIGINAL BEHAVIOR
    echo "[POLL] Waiting for completion..."
    MAX_ATTEMPTS=60
    ATTEMPT=0
    START_TIME=$(date +%s)
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        sleep 3
        ATTEMPT=$((ATTEMPT + 1))
        
        STATUS_RESPONSE=$(curl -s -f "$SERVER_URL/ocr/status/$JOB_ID" || echo '{"status":"error"}')
        STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
        
        echo "  [STATUS] $STATUS (attempt $ATTEMPT)"
        
        if [ "$STATUS" = "completed" ]; then
            END_TIME=$(date +%s)
            DURATION=$((END_TIME - START_TIME))
            
            echo "[SUCCESS] OCR completed!"
            echo "[TIME] Duration: $DURATION seconds"
            echo ""
            
            # EXTRACT RESULTS
            RESULT=$(echo "$STATUS_RESPONSE" | jq '.result')
            WORD_COUNT=$(echo "$RESULT" | jq '.words | length')
            LINE_COUNT=$(echo "$RESULT" | jq '.lines | length')
            PARAGRAPH_COUNT=$(echo "$RESULT" | jq '.paragraphs | length')
            BLOCK_COUNT=$(echo "$RESULT" | jq '.blocks | length')
            
            echo "[RESULTS] OCR Results Summary:"
            echo "  Words: $WORD_COUNT"
            echo "  Lines: $LINE_COUNT"
            echo "  Paragraphs: $PARAGRAPH_COUNT"
            echo "  Blocks: $BLOCK_COUNT"
            
            if [ "$WORD_COUNT" -gt 0 ]; then
                echo "[TEXT] Extracted Text:"
                ALL_TEXT=$(echo "$RESULT" | jq -r '.words[].data.text' | tr '\n' ' ')
                echo "$ALL_TEXT"
                echo ""
            fi
            
            # SAVE RESULTS
            OUTPUT_FILE="ocr-result-$(date +%Y%m%d-%H%M%S).json"
            echo "$RESULT" | jq '.' > "$OUTPUT_FILE"
            echo "[SAVE] Results saved to: $OUTPUT_FILE"
            
            exit 0
            
        elif [ "$STATUS" = "failed" ]; then
            ERROR_MSG=$(echo "$STATUS_RESPONSE" | jq -r '.error // "Unknown error"')
            echo "[ERROR] OCR failed: $ERROR_MSG" >&2
            exit 1
        elif [ "$STATUS" = "error" ]; then
            echo "[ERROR] Failed to get job status" >&2
            exit 1
        fi
    done
    
    echo "[TIMEOUT] OCR processing timed out after $MAX_ATTEMPTS attempts" >&2
    exit 1
fi