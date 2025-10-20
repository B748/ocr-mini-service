@echo off
REM Create deployment package for Raspberry Pi (Batch version)
REM This script packages everything needed for deployment

setlocal enabledelayedexpansion

REM Generate timestamp for package name
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "timestamp=!dt:~0,8!-!dt:~8,6!"
set "PACKAGE_NAME=tesseract-api-deploy-!timestamp!"
set "TEMP_DIR=%TEMP%\!PACKAGE_NAME!"
set "OUTPUT_FILE=!PACKAGE_NAME!.zip"

echo [%date% %time%] Creating deployment package: !PACKAGE_NAME!
echo [%date% %time%] Output location: !OUTPUT_FILE!

REM Create temporary directory
echo [%date% %time%] Creating temporary directory...
if exist "!TEMP_DIR!" rmdir /s /q "!TEMP_DIR!"
mkdir "!TEMP_DIR!"

REM Navigate to project root
cd /d "%~dp0..\.."
set "PROJECT_ROOT=%CD%"
echo [%date% %time%] Project root: !PROJECT_ROOT!

REM Copy essential files and directories
echo [%date% %time%] Copying application files...

REM Copy directories
if exist "src" (
    echo [%date% %time%] Copying directory: src
    xcopy "src" "!TEMP_DIR!\src" /e /i /q
)

if exist "docker" (
    echo [%date% %time%] Copying directory: docker
    xcopy "docker" "!TEMP_DIR!\docker" /e /i /q
)

if exist "scripts" (
    echo [%date% %time%] Copying directory: scripts
    xcopy "scripts" "!TEMP_DIR!\scripts" /e /i /q
)

if exist "docs" (
    echo [%date% %time%] Copying directory: docs
    xcopy "docs" "!TEMP_DIR!\docs" /e /i /q
)

REM Copy individual files
set "FILES=package.json package-lock.json tsconfig.json nest-cli.json .prettierrc .dockerignore README.md"

for %%f in (!FILES!) do (
    if exist "%%f" (
        echo [%date% %time%] Copying file: %%f
        copy "%%f" "!TEMP_DIR!\" >nul
    ) else (
        echo [%date% %time%] Warning: %%f not found, skipping...
    )
)

REM Create deployment instructions
echo [%date% %time%] Creating deployment instructions...
(
echo # Quick Deployment Instructions
echo.
echo ## On Raspberry Pi:
echo.
echo 1. Extract this package:
echo    ```bash
echo    unzip !PACKAGE_NAME!.zip
echo    cd !PACKAGE_NAME!
echo    ```
echo.
echo 2. Make scripts executable:
echo    ```bash
echo    chmod +x scripts/deploy/*.sh
echo    chmod +x scripts/test/*.sh
echo    ```
echo.
echo 3. Deploy the service:
echo    ```bash
echo    cd scripts/deploy
echo    ./deploy.sh build
echo    ./deploy.sh start
echo    ```
echo.
echo 4. Test the deployment:
echo    ```bash
echo    cd scripts/test
echo    ./test-deployment.sh
echo    ```
echo.
echo 5. Check service status:
echo    ```bash
echo    ./deploy.sh status
echo    ```
echo.
echo ## Service URLs:
echo - Status: http://localhost:3000/ocr/status
echo - Debug: http://localhost:3000/ocr/debug
echo - API: http://localhost:3000/ocr/process
echo.
echo ## Management Commands:
echo - View logs: `./deploy.sh logs`
echo - Restart: `./deploy.sh restart`
echo - Stop: `./deploy.sh stop`
echo - Cleanup: `./deploy.sh cleanup`
echo.
echo ## Testing Tools:
echo - Complete OCR test: `cd scripts/test ^&^& ./test-ocr.sh`
echo - SSE monitoring: `cd scripts/test ^&^& node test-sse-client.js ^<job-id^>`
echo - Permission test: `cd scripts/test ^&^& ./test-permissions.sh`
echo - API test: `cd scripts/test ^&^& ./test-api.sh`
echo.
echo See docs/deployment.md for detailed documentation.
echo.
echo ## Package Information:
echo - Created: %date% %time%
echo - From: %COMPUTERNAME%
echo - User: %USERNAME%
echo - Platform: Windows
) > "!TEMP_DIR!\DEPLOY.md"

REM Create package info
echo [%date% %time%] Creating package information...
(
echo {
echo   "packageName": "!PACKAGE_NAME!",
echo   "createdDate": "%date% %time%",
echo   "createdBy": "%USERNAME%@%COMPUTERNAME%",
echo   "platform": "Windows",
echo   "targetPlatform": "Raspberry Pi (ARM64/Linux)",
echo   "method": "Batch Script"
echo }
) > "!TEMP_DIR!\package-info.json"

REM Create ZIP package using PowerShell (more reliable than other methods)
echo [%date% %time%] Creating ZIP package...
if exist "!OUTPUT_FILE!" del "!OUTPUT_FILE!"

powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('!TEMP_DIR!', '!OUTPUT_FILE!')"

if exist "!OUTPUT_FILE!" (
    REM Get file size
    for %%A in ("!OUTPUT_FILE!") do set "SIZE=%%~zA"
    set /a "SIZE_MB=!SIZE! / 1048576"
    
    echo [%date% %time%] Deployment package created successfully!
    echo [%date% %time%] Package: !OUTPUT_FILE!
    echo [%date% %time%] Size: !SIZE_MB! MB
    
    echo.
    echo === Transfer Instructions ===
    echo.
    echo To deploy on Raspberry Pi:
    echo 1. Transfer: scp "!OUTPUT_FILE!" pi@^<pi-ip^>:~/
    echo 2. Extract: unzip "!PACKAGE_NAME!.zip"
    echo 3. Deploy: cd "!PACKAGE_NAME!/scripts/deploy" ^&^& ./deploy.sh build ^&^& ./deploy.sh start
    echo.
    echo Alternative transfer methods:
    echo - USB drive: Copy ZIP file to USB, then extract on Pi
    echo - Network share: Place on shared network location
    echo - Email/Cloud: Upload to cloud service and download on Pi
    echo.
) else (
    echo [%date% %time%] ERROR: Failed to create ZIP package
    goto :cleanup
)

:cleanup
REM Cleanup temporary directory
if exist "!TEMP_DIR!" (
    echo [%date% %time%] Cleaning up temporary files...
    rmdir /s /q "!TEMP_DIR!"
)

echo [%date% %time%] Deployment package creation completed!
pause
goto :eof