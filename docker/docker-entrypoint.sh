#!/bin/sh

# DOCKER ENTRYPOINT SCRIPT FOR TESSERACT-API
# ENSURES PROPER PERMISSIONS AND STARTS THE APPLICATION

set -e

# FUNCTION TO LOG MESSAGES
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# SETUP TEMP DIRECTORY
setup_temp_directory() {
    TEMP_DIR="/tmp/tesseract-api"

    log "Setting up temp directory: $TEMP_DIR"

    if [ -d "$TEMP_DIR" ]; then
        CURRENT_PERMS=$(stat -c "%a" "$TEMP_DIR" 2>/dev/null || echo "unknown")
        CURRENT_OWNER=$(stat -c "%u:%g" "$TEMP_DIR" 2>/dev/null || echo "unknown")
        log "Directory exists - permissions: $CURRENT_PERMS, owner: $CURRENT_OWNER"
    else
        log "Directory does not exist, creating..."
        mkdir -p "$TEMP_DIR" || true
    fi

    log "Process running as: $(id)"

    if [ "$(id -u)" = "0" ]; then
        log "Running as root, fixing permissions..."
        mkdir -p "$TEMP_DIR"
        chown tesseract:nodejs "$TEMP_DIR"
        chmod 775 "$TEMP_DIR"
        log "Fixed permissions: $(stat -c "%a %u:%g" "$TEMP_DIR")"
    else
        if touch "$TEMP_DIR/test-write" 2>/dev/null; then
            rm -f "$TEMP_DIR/test-write"
            log "✓ Temp directory is writable"
        else
            ALT_TEMP_DIR="/tmp/ocr-$(id -u)"
            log "Trying alternative temp directory: $ALT_TEMP_DIR"

            if mkdir -p "$ALT_TEMP_DIR" 2>/dev/null && touch "$ALT_TEMP_DIR/test-write" 2>/dev/null; then
                rm -f "$ALT_TEMP_DIR/test-write"
                log "✓ Using alternative temp directory: $ALT_TEMP_DIR"
                export TESSERACT_TEMP_DIR="$ALT_TEMP_DIR"
            else
                log "ERROR: No writable temp directory available"
                exit 1
            fi
        fi
    fi
}

# CHECK TESSERACT INSTALLATION
check_tesseract() {
    log "Checking Tesseract installation..."

    if ! command -v tesseract >/dev/null 2>&1; then
        log "ERROR: Tesseract is not installed or not in PATH"
        exit 1
    fi

    TESSERACT_VERSION=$(tesseract --version 2>&1 | head -1)
    log "Tesseract version: $TESSERACT_VERSION"

    log "Available languages:"
    tesseract --list-langs 2>/dev/null | tail -n +2 | while read lang; do
        log "  - $lang"
    done
}

# MAIN SETUP
main() {
    log "Starting Tesseract-API container setup..."

    setup_temp_directory
    check_tesseract

    log "Setup completed, starting application..."

    # Execute the main command (NestJS)
    exec "$@"
}

# Run main
main "$@"
