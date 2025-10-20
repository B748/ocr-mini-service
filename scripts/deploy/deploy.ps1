# Tesseract-API Deployment Script for Raspberry Pi (PowerShell version)
# Usage: .\deploy.ps1 [build|start|stop|restart|logs|status|cleanup]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("build", "start", "stop", "restart", "logs", "status", "cleanup")]
    [string]$Action
)

$ProjectName = "tesseract-api"
$ComposeFile = "docker-compose.prod.yml"

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] WARNING: $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: $Message" -ForegroundColor Red
    exit 1
}

function Check-Requirements {
    Write-Log "Checking system requirements..."
    
    # Check if Docker is installed
    try {
        docker --version | Out-Null
    } catch {
        Write-Error "Docker is not installed or not in PATH."
    }
    
    # Check if Docker Compose is available
    try {
        docker compose version | Out-Null
    } catch {
        Write-Error "Docker Compose is not available."
    }
    
    Write-Log "System requirements check completed."
}

function Build-Service {
    Write-Log "Building Tesseract-API for ARM64 architecture..."
    docker compose -f $ComposeFile build --no-cache
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed."
    }
    Write-Log "Build completed successfully."
}

function Start-Service {
    Write-Log "Starting Tesseract-API service..."
    docker compose -f $ComposeFile up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start service."
    }
    
    # Wait for service to be ready
    Write-Log "Waiting for service to be ready..."
    Start-Sleep -Seconds 10
    
    # Check if service is running
    $status = docker compose -f $ComposeFile ps --format json | ConvertFrom-Json
    if ($status.State -eq "running") {
        Write-Log "Tesseract-API is running successfully!"
        Write-Log "Service available at: http://localhost:3000"
        Write-Log "API status: http://localhost:3000/ocr/status"
    } else {
        Write-Error "Service failed to start properly. Check logs with: .\deploy.ps1 logs"
    }
}

function Stop-Service {
    Write-Log "Stopping Tesseract-API service..."
    docker compose -f $ComposeFile down
    Write-Log "Service stopped."
}

function Restart-Service {
    Write-Log "Restarting Tesseract-API service..."
    Stop-Service
    Start-Sleep -Seconds 5
    Start-Service
}

function Show-Logs {
    Write-Log "Showing service logs (press Ctrl+C to exit)..."
    docker compose -f $ComposeFile logs -f
}

function Show-Status {
    Write-Log "Service status:"
    docker compose -f $ComposeFile ps
    
    Write-Host ""
    Write-Log "Container stats:"
    try {
        docker stats --no-stream tesseract-api
    } catch {
        Write-Host "Container not running"
    }
    
    Write-Host ""
    Write-Log "Health check:"
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/ocr/status" -TimeoutSec 5
        $response | ConvertTo-Json -Depth 3
    } catch {
        Write-Host "Service not responding"
    }
}

function Cleanup-Service {
    Write-Log "Cleaning up Docker resources..."
    docker compose -f $ComposeFile down -v
    docker system prune -f
    Write-Log "Cleanup completed."
}

# Main execution
Set-Location $PSScriptRoot

switch ($Action) {
    "build" {
        Check-Requirements
        Build-Service
    }
    "start" {
        Check-Requirements
        Start-Service
    }
    "stop" {
        Stop-Service
    }
    "restart" {
        Restart-Service
    }
    "logs" {
        Show-Logs
    }
    "status" {
        Show-Status
    }
    "cleanup" {
        Cleanup-Service
    }
}