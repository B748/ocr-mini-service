# Test script to validate deployment package contents
param(
    [switch]$SkipCleanup = $false
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green
}

function Write-TestError {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: $Message" -ForegroundColor Red
    exit 1
}

function Write-Success {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ✓ $Message" -ForegroundColor Cyan
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Log "Testing deployment package creation..."
Write-Log "Script directory: $ScriptDir"
Write-Log "Project root: $ProjectRoot"

try {
    Set-Location $ScriptDir

    Write-Log "Creating test package..."
    & ".\create-package.ps1" -PackageName "test-validation-package"

    $PackageFile = "test-validation-package.zip"
    if (-not (Test-Path $PackageFile)) {
        Write-TestError "Package file not found: $PackageFile"
    }

    Write-Log "Found package: $PackageFile"

    $TempDir = Join-Path $env:TEMP "test-package-validation"
    if (Test-Path $TempDir) {
        Remove-Item $TempDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

    Write-Log "Extracting package for validation..."
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($PackageFile, $TempDir)

    $ExtractedDir = Get-ChildItem $TempDir -Directory | Where-Object { $_.Name -like "test-validation-package*" } | Select-Object -First 1
    if (-not $ExtractedDir) {
        Write-TestError "No extracted directory found"
    }

    Set-Location $ExtractedDir.FullName
    Write-Log "Validating package contents in: $(Get-Location)"

    # Check required directories
    $RequiredDirs = @("src", "docker", "scripts", "docs")
    foreach ($dir in $RequiredDirs) {
        if (-not (Test-Path $dir -PathType Container)) {
            Write-TestError "Missing required directory: $dir"
        }
        Write-Success "Directory found: $dir"
    }

    # Check required files
    $RequiredFiles = @("package.json", "tsconfig.json", "nest-cli.json", "README.md", "DEPLOY.md")
    foreach ($file in $RequiredFiles) {
        if (-not (Test-Path $file -PathType Leaf)) {
            Write-TestError "Missing required file: $file"
        }
        Write-Success "File found: $file"
    }

    # Check Docker files
    $DockerFiles = @("docker/Dockerfile", "docker/Dockerfile.pi", "docker/docker-compose.yml", "docker/docker-compose.prod.yml")
    foreach ($file in $DockerFiles) {
        if (-not (Test-Path $file -PathType Leaf)) {
            Write-TestError "Missing Docker file: $file"
        }
        Write-Success "Docker file found: $file"
    }

    # Check source code structure
    if (-not (Test-Path "src/main.ts" -PathType Leaf)) {
        Write-TestError "Missing main application file: src/main.ts"
    }
    if (-not (Test-Path "src/types/ocr.types.ts" -PathType Leaf)) {
        Write-TestError "Missing types file: src/types/ocr.types.ts"
    }
    Write-Success "Source code structure validated"

    # Validate DEPLOY.md content
    $DeployContent = Get-Content "DEPLOY.md" -Raw
    if ($DeployContent -notmatch "scripts/deploy") {
        Write-TestError "DEPLOY.md does not contain correct script paths"
    }
    Write-Success "DEPLOY.md contains correct paths"

    # Check package size
    Set-Location $ScriptDir
    $PackageSize = (Get-Item $PackageFile).Length
    $PackageSizeMB = [math]::Round($PackageSize / 1MB, 2)
    if ($PackageSizeMB -gt 50) {
        Write-TestError "Package size too large: ${PackageSizeMB}MB"
    }
    Write-Success "Package size acceptable: ${PackageSizeMB}MB"

    Write-Log "✅ Package validation completed successfully!"
    exit 0

} catch {
    Write-TestError "Package validation failed: $($_.Exception.Message)"
} finally {
    Set-Location $ScriptDir
    if (-not $SkipCleanup) {
        if (Test-Path $TempDir) {
            Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path "test-validation-package.zip") {
            Remove-Item "test-validation-package.zip" -Force -ErrorAction SilentlyContinue
        }
        Write-Log "Cleanup completed"
    }
}