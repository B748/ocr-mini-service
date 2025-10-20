# Create deployment package for Raspberry Pi (PowerShell version)
# This script packages everything needed for deployment

param(
    [string]$OutputPath = ".",
    [string]$PackageName = ""
)

# Set error action preference
$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: $Message" -ForegroundColor Red
    exit 1
}

# Generate package name if not provided
if ([string]::IsNullOrEmpty($PackageName)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $PackageName = "tesseract-api-deploy-$timestamp"
}

$TempDir = Join-Path $env:TEMP $PackageName
$OutputFile = Join-Path $OutputPath "$PackageName.zip"

Write-Log "Creating deployment package: $PackageName"
Write-Log "Output location: $OutputFile"

try {
    # Create temporary directory
    Write-Log "Creating temporary directory..."
    if (Test-Path $TempDir) {
        Remove-Item $TempDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

    # Navigate to project root
    $ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    $ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptPath)
    Set-Location $ProjectRoot
    Write-Log "Project root: $ProjectRoot"
    
    # Copy essential files and directories
    Write-Log "Copying application files..."
    
    $FilesToCopy = @(
        @{ Source = "src"; Destination = "src"; Type = "Directory" },
        @{ Source = "docker"; Destination = "docker"; Type = "Directory" },
        @{ Source = "scripts"; Destination = "scripts"; Type = "Directory" },
        @{ Source = "docs"; Destination = "docs"; Type = "Directory" },
        @{ Source = "package.json"; Destination = "package.json"; Type = "File" },
        @{ Source = "package-lock.json"; Destination = "package-lock.json"; Type = "File" },
        @{ Source = "tsconfig.json"; Destination = "tsconfig.json"; Type = "File" },
        @{ Source = "nest-cli.json"; Destination = "nest-cli.json"; Type = "File" },
        @{ Source = ".prettierrc"; Destination = ".prettierrc"; Type = "File" },
        @{ Source = ".dockerignore"; Destination = ".dockerignore"; Type = "File" },
        @{ Source = "README.md"; Destination = "README.md"; Type = "File" }
    )

    foreach ($item in $FilesToCopy) {
        $sourcePath = $item.Source
        $destPath = Join-Path $TempDir $item.Destination
        
        if (Test-Path $sourcePath) {
            if ($item.Type -eq "Directory") {
                Write-Log "Copying directory: $sourcePath"
                Copy-Item $sourcePath -Destination $destPath -Recurse -Force
            } else {
                Write-Log "Copying file: $sourcePath"
                Copy-Item $sourcePath -Destination $destPath -Force
            }
        } else {
            Write-Log "Warning: $sourcePath not found, skipping..."
        }
    }

    # Create deployment instructions
    Write-Log "Creating deployment instructions..."
    $deployInstructions = @"
# Quick Deployment Instructions

## On Raspberry Pi:

1. Extract this package:
   ``````bash
   unzip $PackageName.zip
   cd $PackageName
   ``````

2. Make scripts executable:
   ``````bash
   chmod +x scripts/deploy/*.sh
   chmod +x scripts/test/*.sh
   ``````

3. Deploy the service:
   ``````bash
   cd scripts/deploy
   ./deploy.sh build
   ./deploy.sh start
   ``````

4. Test the deployment:
   ``````bash
   cd scripts/test
   ./test-deployment.sh
   ``````

5. Check service status:
   ``````bash
   ./deploy.sh status
   ``````

## Service URLs:
- Status: http://localhost:8600/ocr/status
- Debug: http://localhost:8600/ocr/debug
- API: http://localhost:8600/ocr/process

## Management Commands:
- View logs: ``./deploy.sh logs``
- Restart: ``./deploy.sh restart``
- Stop: ``./deploy.sh stop``
- Cleanup: ``./deploy.sh cleanup``

## Testing Tools:
- Complete OCR test: ``cd scripts/test && ./test-ocr.sh``
- SSE monitoring: ``cd scripts/test && node test-sse-client.js <job-id>``
- Permission test: ``cd scripts/test && ./test-permissions.sh``
- API test: ``cd scripts/test && ./test-api.sh``

See docs/deployment.md for detailed documentation.

## Package Information:
- Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- From: $env:COMPUTERNAME
- User: $env:USERNAME
- PowerShell Version: $($PSVersionTable.PSVersion)
"@

    $deployInstructions | Out-File -FilePath (Join-Path $TempDir "DEPLOY.md") -Encoding UTF8

    # Create package info file
    Write-Log "Creating package information..."
    $packageInfo = @{
        PackageName = $PackageName
        CreatedDate = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        CreatedBy = "$env:USERNAME@$env:COMPUTERNAME"
        PowerShellVersion = $PSVersionTable.PSVersion.ToString()
        Platform = "Windows"
        TargetPlatform = "Raspberry Pi (ARM64/Linux)"
        Contents = $FilesToCopy | ForEach-Object { $_.Source }
    }

    $packageInfo | ConvertTo-Json -Depth 3 | Out-File -FilePath (Join-Path $TempDir "package-info.json") -Encoding UTF8

    # Create the ZIP package
    Write-Log "Creating ZIP package..."
    if (Test-Path $OutputFile) {
        Remove-Item $OutputFile -Force
        Write-Log "Removed existing package file"
    }

    # Use .NET compression for better compatibility
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($TempDir, $OutputFile)

    # Get package size
    $packageSize = (Get-Item $OutputFile).Length
    $packageSizeMB = [math]::Round($packageSize / 1MB, 2)

    Write-Log "Deployment package created successfully!"
    Write-Log "Package: $OutputFile"
    Write-Log "Size: $packageSizeMB MB"

    # Display transfer instructions
    Write-Host ""
    Write-Host "=== Transfer Instructions ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To deploy on Raspberry Pi:" -ForegroundColor Yellow
    Write-Host "1. Transfer: scp `"$OutputFile`" pi@<pi-ip>:~/" -ForegroundColor White
    Write-Host "2. Extract: unzip `"$PackageName.zip`"" -ForegroundColor White
    Write-Host "3. Deploy: cd `"$PackageName/scripts/deploy`" && ./deploy.sh build && ./deploy.sh start" -ForegroundColor White
    Write-Host ""
    Write-Host "Alternative transfer methods:" -ForegroundColor Yellow
    Write-Host "- USB drive: Copy ZIP file to USB, then extract on Pi" -ForegroundColor White
    Write-Host "- Network share: Place on shared network location" -ForegroundColor White
    Write-Host "- Email/Cloud: Upload to cloud service and download on Pi" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Error "Failed to create deployment package: $($_.Exception.Message)"
} finally {
    # Cleanup temporary directory
    if (Test-Path $TempDir) {
        Write-Log "Cleaning up temporary files..."
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Log "Deployment package creation completed!"