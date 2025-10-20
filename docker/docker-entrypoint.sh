#!/bin/sh

# Docker entrypoint script for Tesseract-API
# Ensures proper permissions and starts the application

set -e

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Check and fix temp directory permissions
setup_temp_directory() {
    TEMP_DIR="/tmp/tesseract-api"
    
    log "Setting up temp directory: $TEMP_DIR"
    
    # Check current permissions and ownership
    if [ -d "$TEMP_DIR" ]; then
        CURRENT_PERMS=$(stat -c "%a" "$TEMP_DIR" 2>/dev/null || echo "unknown")
        CURRENT_OWNER=$(stat -c "%u:%g" "$TEMP_DIR" 2>/dev/null || echo "unknown")
        log "Directory exists - permissions: $CURRENT_PERMS, owner: $CURRENT_OWNER"
    else
        log "Directory does not exist, creating..."
        if ! mkdir -p "$TEMP_DIR" 2>/dev/null; then
            log "Failed to create directory as user, trying alternative..."
        fi
    fi
    
    log "Process running as: $(id)"
    
    # Try to fix permissions if we're running as root
    if [ "$(id -u)" = "0" ]; then
        log "Running as root, fixing permissions..."
        mkdir -p "$TEMP_DIR"
        chown tesseract:nodejs "$TEMP_DIR"
        chmod 775 "$TEMP_DIR"
        log "Fixed permissions: $(stat -c "%a %u:%g" "$TEMP_DIR")"
    else
        # Test if we can write to the directory
        if touch "$TEMP_DIR/test-write" 2>/dev/null; then
            rm -f "$TEMP_DIR/test-write"
            log "✓ Temp directory is writable"
        else
            log "✗ Cannot write to temp directory $TEMP_DIR"
            log "Directory info: $(ls -ld $TEMP_DIR 2>/dev/null || echo 'Directory not accessible')"
            
            # Try to create alternative directory in user-writable location
            ALT_TEMP_DIR="/tmp/ocr-$(id -u)"
            log "Trying alternative temp directory: $ALT_TEMP_DIR"
            
            if mkdir -p "$ALT_TEMP_DIR" 2>/dev/null && touch "$ALT_TEMP_DIR/test-write" 2>/dev/null; then
                rm -f "$ALT_TEMP_DIR/test-write"
                log "✓ Using alternative temp directory: $ALT_TEMP_DIR"
                export TESSERACT_TEMP_DIR="$ALT_TEMP_DIR"
            else
                log "ERROR: No writable temp directory available"
                log "Attempted directories:"
                log "  - $TEMP_DIR (failed)"
                log "  - $ALT_TEMP_DIR (failed)"
                exit 1
            fi
        fi
    fi
}

# Check Tesseract installation
check_tesseract() {
    log "Checking Tesseract installation..."
    
    if ! command -v tesseract >/dev/null 2>&1; then
        log "ERROR: Tesseract is not installed or not in PATH"
        exit 1
    fi
    
    TESSERACT_VERSION=$(tesseract --version 2>&1 | head -1)
    log "Tesseract version: $TESSERACT_VERSION"
    
    # Check available languages
    log "Available languages:"
    tesseract --list-langs 2>/dev/null | tail -n +2 | while read lang; do
        log "  - $lang"
    done
}

# Main setup
main() {
    log "Starting Tesseract-API container setup..."
    
    setup_temp_directory
    check_tesseract
    
    log "Setup completed, starting application..."
    
    # Execute the main command
    exec "$@"
}

# Run main function
main "$@"