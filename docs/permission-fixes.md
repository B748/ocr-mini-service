# Permission Fixes for Tesseract-API

## Problem Description

The container was experiencing permission issues where the `/tmp/tesseract-api` directory was being created with root ownership, but the application runs as user `tesseract` (uid=1001). This caused OCR processing to fail because the application couldn't write temporary files.

## Root Cause

1. **Directory Creation Timing**: The `TesseractService` constructor calls `fs.mkdir()` during application startup, which could happen before proper user switching
2. **Docker Layer Ordering**: The temp directory was being created after switching to the non-root user, but something was recreating it as root
3. **Entrypoint Script Limitations**: The entrypoint script couldn't fix permissions when running as non-root user

## Fixes Applied

### 1. Dockerfile Changes

**Before:**
```dockerfile
# Switch to non-root user
USER tesseract

# Create temp directory as the tesseract user (after USER switch)
RUN mkdir -p /tmp/tesseract-api && \
    chmod 755 /tmp/tesseract-api
```

**After:**
```dockerfile
# Create temp directory with proper ownership before switching user
RUN mkdir -p /tmp/tesseract-api && \
    chown tesseract:nodejs /tmp/tesseract-api && \
    chmod 775 /tmp/tesseract-api

# Switch to non-root user
USER tesseract
```

### 2. Enhanced Entrypoint Script

- **Better Permission Checking**: More detailed logging of directory permissions and ownership
- **Fallback Directory**: Creates alternative temp directory if main one fails
- **Improved Error Handling**: Clearer error messages and troubleshooting info
- **Write Test Validation**: Actually tests write permissions before proceeding

### 3. Enhanced Test Scripts

#### test-permissions.sh
- **Return Codes**: Now properly returns 0 for success, 1 for failure
- **Detailed Logging**: Shows permission bits, ownership, and write test results
- **Container Log Analysis**: Checks container logs for permission-related errors
- **Environment Variable Check**: Validates OCR-related environment variables

#### New Test Scripts
- **test-permission-fix.sh**: Comprehensive test that rebuilds container and validates fixes
- **test-permission-fix.ps1**: PowerShell version for Windows users

## Testing the Fixes

### Quick Test
```bash
# Run the permission fix test
./scripts/test/test-permission-fix.sh
```

### Manual Verification
```bash
# Build and run container
docker build -f docker/Dockerfile -t tesseract-api:test .
docker run -d --name tesseract-test -p 3000:3000 tesseract-api:test

# Check permissions
docker exec tesseract-test ls -la /tmp/tesseract-api
docker exec tesseract-test id

# Test write permissions
docker exec tesseract-test touch /tmp/tesseract-api/test-file
```

### API Debug Endpoint
```bash
curl http://localhost:3000/ocr/debug | jq .tempDirectory
```

Expected output:
```json
{
  "path": "/tmp/tesseract-api",
  "exists": true,
  "contents": [],
  "permissions": "40775",
  "owner": {
    "uid": 1001,
    "gid": 1001
  },
  "writeTest": "success"
}
```

## Key Changes Summary

1. **Directory Ownership**: Temp directory is now created with correct ownership from the start
2. **Permission Bits**: Changed from 755 to 775 to allow group write access
3. **Fallback Strategy**: Application can use alternative temp directory if main one fails
4. **Better Testing**: Comprehensive test suite validates all permission scenarios
5. **Improved Logging**: Detailed logs help troubleshoot permission issues

## Verification Checklist

- [ ] Container starts without permission errors
- [ ] Temp directory has correct ownership (tesseract:nodejs)
- [ ] Temp directory has correct permissions (775)
- [ ] Application can write to temp directory
- [ ] OCR processing completes successfully
- [ ] Temporary files are cleaned up after processing
- [ ] Debug endpoint shows "writeTest": "success"

## Troubleshooting

If permission issues persist:

1. **Check Container Logs**: `docker logs <container-name>`
2. **Verify User Context**: `docker exec <container> id`
3. **Check Directory**: `docker exec <container> ls -la /tmp/tesseract-api`
4. **Run Debug Endpoint**: `curl http://localhost:3000/ocr/debug`
5. **Use Permission Test**: `./scripts/test/test-permissions.sh`

The fixes ensure that the Tesseract-API container works correctly across different deployment scenarios while maintaining security best practices.