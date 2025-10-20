#!/bin/bash

# Tesseract-API Testing Script for Raspberry Pi (Shared Machine Safe)
# Usage: ./deploy.sh [build|start|stop|restart|logs|status]

set -e

PROJECT_NAME="tesseract-api-test"
COMPOSE_FILE="../../docker/docker-compose.prod.yml"

# Shared machine configuration
export TEST_PORT=${TEST_PORT:-3000}
export USER=${USER:-$(whoami)}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

check_requirements() {
    log "Checking system requirements for shared machine..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. On shared machines, ask administrator or use rootless Docker."
    fi

    # Check if Docker Compose is available
    if ! docker compose version &> /dev/null; then
        error "Docker Compose is not available. Please install Docker Compose."
    fi

    # Check if port is available
    if netstat -tuln 2>/dev/null | grep -q ":${TEST_PORT:-3000} "; then
        warn "Port ${TEST_PORT:-3000} is in use. Set TEST_PORT environment variable to use different port."
        warn "Example: export TEST_PORT=3001"
    fi

    # Check available memory (should have at least 1GB free)
    available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [ "$available_mem" -lt 1000 ]; then
        warn "Available memory is ${available_mem}MB. Testing with reduced resource limits."
    fi

    # Create user-space directories with proper permissions
    mkdir -p ../testing/docker-data/tmp
    mkdir -p ../testing/docker-data/tesseract-data
    
    # Set permissions to allow container user (1001) to write
    chmod -R 755 ../testing/docker-data
    
    # Try to set ownership if possible (may fail on some systems, that's OK)
    if command -v chown >/dev/null 2>&1; then
        chown -R 1001:1001 ../testing/docker-data 2>/dev/null || {
            warn "Could not set ownership to 1001:1001, using current user ownership"
            # Make directories world-writable as fallback
            chmod -R 777 ../testing/docker-data/tmp
        }
    else
        # Make temp directory world-writable as fallback
        chmod 777 ../testing/docker-data/tmp
    fi

    # Check for other containers that might conflict
    running_containers=$(docker ps --format "table {{.Names}}" | grep -c tesseract || echo "0")
    # Convert to integer to avoid leading zero issues
    running_containers=$((running_containers + 0))
    if [ "$running_containers" -gt 0 ]; then
        warn "Other tesseract containers are running. This might cause conflicts."
    fi

    log "System requirements check completed for shared machine."
}

build() {
    log "Building Tesseract-API for ARM64 architecture..."
    docker compose -f $COMPOSE_FILE build --no-cache
    log "Build completed successfully."
}

start() {
    log "Starting Tesseract-API service..."
    docker compose -f $COMPOSE_FILE up -d

    # Wait for service to be ready
    log "Waiting for service to be ready..."
    sleep 10

    # Check if service is healthy
    if docker compose -f $COMPOSE_FILE ps | grep -q "healthy\|Up"; then
        log "Tesseract-API is running successfully!"
        log "Service available at: http://localhost:3000"
        log "API status: http://localhost:3000/ocr/status"
    else
        error "Service failed to start properly. Check logs with: ./deploy.sh logs"
    fi
}

stop() {
    log "Stopping Tesseract-API service..."
    docker compose -f $COMPOSE_FILE down
    log "Service stopped."
}

restart() {
    log "Restarting Tesseract-API service..."
    stop
    sleep 5
    start
}

logs() {
    log "Showing service logs (press Ctrl+C to exit)..."
    docker compose -f $COMPOSE_FILE logs -f
}

status() {
    log "Service status:"
    docker compose -f $COMPOSE_FILE ps

    echo ""
    log "Container stats:"
    docker stats --no-stream tesseract-api 2>/dev/null || echo "Container not running"

    echo ""
    log "Health check:"
    curl -s http://localhost:3000/ocr/status 2>/dev/null | jq . || echo "Service not responding"
}

cleanup() {
    log "Cleaning up Docker resources..."
    docker compose -f $COMPOSE_FILE down -v
    docker system prune -f
    log "Cleanup completed."
}

# Check if we're in the right directory structure
if [ ! -d "../testing" ]; then
    warn "Not in expected testing directory structure. Creating directories..."
    mkdir -p ../testing/docker-data
fi



case "$1" in
    build)
        check_requirements
        build
        ;;
    start)
        check_requirements
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    cleanup)
        cleanup
        ;;
    *)
        echo "Usage: $0 {build|start|stop|restart|logs|status|cleanup}"
        echo ""
        echo "Commands:"
        echo "  build    - Build the Docker image"
        echo "  start    - Start the service"
        echo "  stop     - Stop the service"
        echo "  restart  - Restart the service"
        echo "  logs     - Show service logs"
        echo "  status   - Show service status and health"
        echo "  cleanup  - Stop service and clean up Docker resources"
        exit 1
        ;;
esac