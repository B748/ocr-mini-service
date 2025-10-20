#!/bin/bash

# Test build script to verify compilation works before Docker build
# Usage: ./test-build.sh

set -e

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1"
    exit 1
}

log "Testing local build process..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    error "Node.js is not installed"
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    error "npm is not installed"
fi

log "Node.js version: $(node --version)"
log "npm version: $(npm --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    log "Installing dependencies..."
    npm install
else
    log "Dependencies already installed"
fi

# Clean previous build
if [ -d "dist" ]; then
    log "Cleaning previous build..."
    rm -rf dist
fi

# Test TypeScript compilation
log "Testing TypeScript compilation..."
if npx tsc --noEmit; then
    log "✓ TypeScript compilation successful"
else
    error "✗ TypeScript compilation failed"
fi

# Test NestJS build
log "Testing NestJS build..."
if npx nest build; then
    log "✓ NestJS build successful"
    log "Build output:"
    ls -la dist/
else
    error "✗ NestJS build failed"
fi

# Test if main.js exists and is executable
if [ -f "dist/main.js" ]; then
    log "✓ Main application file created: dist/main.js"
else
    error "✗ Main application file not found"
fi

log "Local build test completed successfully!"
log "Docker build should now work correctly."