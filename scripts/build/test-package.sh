#!/bin/bash

# Test script to validate deployment package contents
# This script creates a package and verifies its contents

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
    exit 1
}

log "Testing deployment package creation..."
log "Script directory: $SCRIPT_DIR"
log "Project root: $PROJECT_ROOT"

# Change to script directory
cd "$SCRIPT_DIR"

# Create test package
log "Creating test package..."
./create-package.sh

# Find the created package
PACKAGE_FILE=$(ls -t tesseract-api-deploy-*.tar.gz | head -n1)
if [ -z "$PACKAGE_FILE" ]; then
    error "No package file found"
fi

log "Found package: $PACKAGE_FILE"

# Create temporary directory for extraction
TEMP_DIR="/tmp/test-package-validation"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Extract package
log "Extracting package for validation..."
cd "$TEMP_DIR"
tar -xzf "$SCRIPT_DIR/$PACKAGE_FILE"

# Find extracted directory
EXTRACTED_DIR=$(ls -d tesseract-api-deploy-* | head -n1)
if [ -z "$EXTRACTED_DIR" ]; then
    error "No extracted directory found"
fi

cd "$EXTRACTED_DIR"
log "Validating package contents in: $(pwd)"

# Check required directories
REQUIRED_DIRS=("src" "docker" "scripts" "docs")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        error "Missing required directory: $dir"
    fi
    log "✓ Directory found: $dir"
done

# Check required files
REQUIRED_FILES=("package.json" "tsconfig.json" "nest-cli.json" "README.md" "DEPLOY.md")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        error "Missing required file: $file"
    fi
    log "✓ File found: $file"
done

# Check script executability
SCRIPTS=("scripts/deploy/deploy.sh" "scripts/test/test-deployment.sh" "scripts/test/test-ocr.sh" "scripts/test/test-api.sh")
for script in "${SCRIPTS[@]}"; do
    if [ ! -f "$script" ]; then
        error "Missing script: $script"
    fi
    if [ ! -x "$script" ]; then
        error "Script not executable: $script"
    fi
    log "✓ Executable script found: $script"
done

# Check Docker files
DOCKER_FILES=("docker/Dockerfile" "docker/Dockerfile.pi" "docker/docker-compose.yml" "docker/docker-compose.prod.yml")
for file in "${DOCKER_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        error "Missing Docker file: $file"
    fi
    log "✓ Docker file found: $file"
done

# Check source code structure
if [ ! -f "src/main.ts" ]; then
    error "Missing main application file: src/main.ts"
fi
if [ ! -f "src/types/ocr.types.ts" ]; then
    error "Missing types file: src/types/ocr.types.ts"
fi
if [ ! -d "src/ocr" ]; then
    error "Missing OCR module directory: src/ocr"
fi
log "✓ Source code structure validated"

# Check documentation
DOC_FILES=("docs/README.md" "docs/api.md" "docs/deployment.md" "docs/raspberry-pi.md")
for file in "${DOC_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        error "Missing documentation file: $file"
    fi
    log "✓ Documentation file found: $file"
done

# Validate DEPLOY.md content
if ! grep -q "scripts/deploy" DEPLOY.md; then
    error "DEPLOY.md does not contain correct script paths"
fi
log "✓ DEPLOY.md contains correct paths"

# Check package size (should be reasonable)
PACKAGE_SIZE=$(stat -f%z "$SCRIPT_DIR/$PACKAGE_FILE" 2>/dev/null || stat -c%s "$SCRIPT_DIR/$PACKAGE_FILE" 2>/dev/null)
PACKAGE_SIZE_MB=$((PACKAGE_SIZE / 1024 / 1024))
if [ "$PACKAGE_SIZE_MB" -gt 50 ]; then
    error "Package size too large: ${PACKAGE_SIZE_MB}MB (should be < 50MB)"
fi
log "✓ Package size acceptable: ${PACKAGE_SIZE_MB}MB"

# Cleanup
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"
rm -f "$PACKAGE_FILE"

log "✅ Package validation completed successfully!"
log "All required files and directories are present"
log "All scripts are executable"
log "Package structure is correct"

exit 0