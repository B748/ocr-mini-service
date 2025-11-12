# ARM64 Build Fix Documentation

## Problem
The GitHub Actions workflow was failing during ARM64 builds with the error:
```
qemu: uncaught target signal 4 (Illegal instruction) - core dumped
```

This occurs during `npm ci` when building ARM64 images on x86_64 runners using QEMU emulation.

## Root Cause
- QEMU emulation has limitations when running certain Node.js operations
- Native module compilation can fail under emulation
- npm's cache and script execution can trigger illegal instructions

## Solutions Implemented

### 1. Updated Dockerfile
**Changes made to `docker/Dockerfile`:**
- Removed problematic npm config settings that aren't valid
- Added environment variables for npm configuration
- Added `--ignore-scripts` flag to skip problematic post-install scripts
- Used build cache mounting for better performance
- Simplified platform handling to avoid QEMU issues

### 2. Enhanced GitHub Actions Workflow
**Changes made to `.github/workflows/docker-build.yml`:**
- Added proper QEMU setup with ARM64 platform specification
- Simplified Docker Buildx configuration
- Added build cache configuration
- Added timeout and disabled provenance/SBOM for faster builds

### 3. Alternative Build Strategy
**Created `.github/workflows/docker-build-alternative.yml`:**
- Separate jobs for AMD64 and ARM64 builds
- Manual manifest creation to combine architectures
- Reduced QEMU emulation complexity
- Better error isolation per platform

### 4. ARM64-Specific Dockerfile
**Created `docker/Dockerfile.arm64`:**
- Simplified build process avoiding native compilation
- Requires pre-built `dist/` directory
- Production-only dependencies installation
- Optimized for ARM64 deployment scenarios

## Usage

### Standard Multi-Platform Build
```bash
# Uses the main workflow (fixed)
git push origin main
```

### Alternative Platform-Specific Build
```bash
# Trigger alternative workflow manually
# Choose platform: linux/amd64, linux/arm64, or both
```

### Local ARM64 Testing
```bash
# Build locally for ARM64 (requires Docker Desktop with ARM64 support)
docker buildx build --platform linux/arm64 -f docker/Dockerfile -t tesseract-api:arm64 .

# Or use the ARM64-specific Dockerfile
npm run build  # Build locally first
docker build -f docker/Dockerfile.arm64 -t tesseract-api:arm64-simple .
```

## Key Fixes Applied

1. **Environment Variables**: Use NPM_CONFIG_* environment variables instead of invalid npm config commands
2. **Script Skipping**: Use `--ignore-scripts` to avoid problematic post-install scripts
3. **Cache Optimization**: Mount npm cache to improve build performance
4. **Simplified Platform Handling**: Remove complex cross-platform build arguments
5. **QEMU Setup**: Proper QEMU configuration in GitHub Actions
6. **Build Timeout**: Added 30-minute timeout for ARM64 builds
7. **Disabled Extras**: Disabled provenance and SBOM generation for faster builds

## Verification
After applying these fixes, the ARM64 build should complete successfully without QEMU illegal instruction errors.