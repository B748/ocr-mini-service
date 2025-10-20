#!/bin/bash

# Create deployment package for Raspberry Pi
# This script packages everything needed for deployment

set -e

PACKAGE_NAME="tesseract-api-deploy-$(date +%Y%m%d-%H%M%S)"
TEMP_DIR="/tmp/$PACKAGE_NAME"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Creating deployment package: $PACKAGE_NAME"

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Copy essential files (navigate to project root first)
cd "$(dirname "$0")/../.."
PROJECT_ROOT=$(pwd)
log "Project root: $PROJECT_ROOT"
log "Copying application files..."

# Copy directories
cp -r src/ "$TEMP_DIR/"
cp -r docker/ "$TEMP_DIR/"
cp -r scripts/ "$TEMP_DIR/"
cp -r docs/ "$TEMP_DIR/"

# Copy configuration files
cp package*.json "$TEMP_DIR/"
cp tsconfig.json "$TEMP_DIR/"
cp nest-cli.json "$TEMP_DIR/"
cp .prettierrc "$TEMP_DIR/"
cp README.md "$TEMP_DIR/"

# Copy optional files if they exist
if [ -f ".dockerignore" ]; then
    cp .dockerignore "$TEMP_DIR/"
fi

# Make scripts executable
chmod +x "$TEMP_DIR/scripts/deploy/deploy.sh"
chmod +x "$TEMP_DIR/scripts/test/test-deployment.sh"
chmod +x "$TEMP_DIR/scripts/test/test-ocr.sh"
chmod +x "$TEMP_DIR/scripts/test/test-api.sh"
chmod +x "$TEMP_DIR/scripts/test/test-permissions.sh"

# Create deployment instructions
cat > "$TEMP_DIR/DEPLOY.md" << 'EOF'
# Quick Deployment Instructions

## On Raspberry Pi:

1. Extract this package:
   ```bash
   tar -xzf tesseract-api-deploy-*.tar.gz
   cd tesseract-api-deploy-*
   ```

2. Deploy the service:
   ```bash
   cd scripts/deploy
   ./deploy.sh build
   ./deploy.sh start
   ```

3. Test the deployment:
   ```bash
   cd scripts/test
   ./test-deployment.sh
   ```

4. Check service status:
   ```bash
   ./deploy.sh status
   ```

## Service URLs:
- Status: http://localhost:3000/ocr/status
- API: http://localhost:3000/ocr/process

## Management:
- View logs: `./deploy.sh logs`
- Restart: `./deploy.sh restart`
- Stop: `./deploy.sh stop`

See docs/deployment.md for detailed documentation.
EOF

# Create the package
log "Creating tar.gz package..."
cd /tmp
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME/"

# Move to current directory
mv "$PACKAGE_NAME.tar.gz" "$OLDPWD/"

# Cleanup
rm -rf "$TEMP_DIR"

log "Deployment package created: $PACKAGE_NAME.tar.gz"
log "Package size: $(du -h "$PACKAGE_NAME.tar.gz" | cut -f1)"

echo ""
echo "To deploy on Raspberry Pi:"
echo "1. Transfer: scp $PACKAGE_NAME.tar.gz pi@<pi-ip>:~/"
echo "2. Extract: tar -xzf $PACKAGE_NAME.tar.gz"
echo "3. Deploy: cd $PACKAGE_NAME/scripts/deploy && ./deploy.sh build && ./deploy.sh start"