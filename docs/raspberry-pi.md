# Raspberry Pi Deployment Guide

This guide provides detailed instructions for deploying the Tesseract-API OCR microservice on Raspberry Pi devices, with specific optimizations for different Pi models and use cases.

## Raspberry Pi Models Support

### Supported Models
- **Raspberry Pi 5** (8GB) - Recommended for production
- **Raspberry Pi 5** (4GB) - Good for light to moderate usage
- **Raspberry Pi 4** (8GB) - Suitable with performance tuning
- **Raspberry Pi 4** (4GB) - Basic functionality with resource limits

### Performance Expectations

| Model | RAM | Processing Time* | Concurrent Requests |
|-------|-----|------------------|-------------------|
| Pi 5 (8GB) | 8GB | 3-8 seconds | 1-2 |
| Pi 5 (4GB) | 4GB | 4-10 seconds | 1 |
| Pi 4 (8GB) | 8GB | 5-12 seconds | 1 |
| Pi 4 (4GB) | 4GB | 6-15 seconds | 1 |

*For typical document images (1-3MB)

## Prerequisites

### System Requirements
- **64-bit Raspberry Pi OS** (Bookworm or later recommended)
- **Docker** and **Docker Compose** installed
- **At least 2GB free storage** for Docker images and temporary files
- **Stable internet connection** for initial setup and image pulls
- **MicroSD card** Class 10 or better (U3 recommended for better performance)

### Operating System Setup

#### Install Raspberry Pi OS
```bash
# Use Raspberry Pi Imager to install 64-bit OS
# Enable SSH and configure WiFi during imaging
# Or configure after first boot:

sudo raspi-config
# Enable SSH, expand filesystem, set memory split to 16MB
```

#### System Optimization
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git htop iotop

# Optimize for Docker workloads
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf

# Increase file limits for Docker
echo '* soft nofile 65536' | sudo tee -a /etc/security/limits.conf
echo '* hard nofile 65536' | sudo tee -a /etc/security/limits.conf

# Reboot to apply changes
sudo reboot
```

### Docker Installation

#### Install Docker
```bash
# Install Docker using official script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Enable Docker to start on boot
sudo systemctl enable docker

# Reboot to apply group changes
sudo reboot
```

#### Verify Docker Installation
```bash
# Check Docker version
docker --version
docker compose version

# Test Docker installation
docker run hello-world
```

## Deployment Methods

### Method 1: Deployment Package (Recommended)

This method creates a complete deployment package on your development machine and transfers it to the Pi.

#### On Development Machine
```bash
# Create deployment package
cd tesseract-api/scripts/build
./create-package.sh

# This creates: tesseract-api-deploy-YYYYMMDD-HHMMSS.tar.gz
```

#### Transfer to Raspberry Pi
```bash
# Transfer package (replace with your Pi's IP)
scp tesseract-api-deploy-*.tar.gz pi@192.168.1.100:~/

# Or use USB drive
cp tesseract-api-deploy-*.tar.gz /media/usb/
```

#### On Raspberry Pi
```bash
# Extract deployment package
cd ~
tar -xzf tesseract-api-deploy-*.tar.gz
cd tesseract-api-deploy-*/

# Deploy the service
cd scripts/deploy
chmod +x deploy.sh
./deploy.sh build
./deploy.sh start
```

### Method 2: Git Clone Deployment

#### Direct Git Clone
```bash
# On Raspberry Pi
git clone <your-repository-url> tesseract-api
cd tesseract-api

# Deploy using scripts
cd scripts/deploy
chmod +x deploy.sh
./deploy.sh build
./deploy.sh start
```

### Method 3: Docker Compose Direct

#### Using Production Compose
```bash
# On Raspberry Pi with project files
cd tesseract-api/docker
docker-compose -f docker-compose.prod.yml up -d
```

## Pi-Specific Configuration

### Resource Optimization by Model

#### Raspberry Pi 5 (8GB) - High Performance
```yaml
# docker/docker-compose.prod.yml modifications
services:
  tesseract-api:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '3.0'
        reservations:
          memory: 1G
          cpus: '1.5'
    environment:
      - NODE_OPTIONS=--max-old-space-size=1536
```

#### Raspberry Pi 5 (4GB) - Balanced
```yaml
# docker/docker-compose.prod.yml modifications
services:
  tesseract-api:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '2.0'
        reservations:
          memory: 512M
          cpus: '1.0'
    environment:
      - NODE_OPTIONS=--max-old-space-size=768
```

#### Raspberry Pi 4 (4GB) - Conservative
```yaml
# docker/docker-compose.prod.yml modifications
services:
  tesseract-api:
    deploy:
      resources:
        limits:
          memory: 768M
          cpus: '1.5'
        reservations:
          memory: 384M
          cpus: '0.75'
    environment:
      - NODE_OPTIONS=--max-old-space-size=512
```

### Temperature Management

#### Monitor Temperature
```bash
# Check CPU temperature
vcgencmd measure_temp

# Monitor during OCR processing
watch -n 1 'vcgencmd measure_temp && docker stats tesseract-api --no-stream'
```

#### Cooling Recommendations
- **Passive cooling**: Heat sinks on CPU and RAM
- **Active cooling**: Fan for continuous operation
- **Case selection**: Cases with good airflow
- **Throttling monitoring**: Watch for thermal throttling during heavy loads

### Storage Optimization

#### MicroSD Card Optimization
```bash
# Check SD card performance
sudo hdparm -t /dev/mmcblk0

# Optimize mount options (add to /etc/fstab)
# /dev/mmcblk0p2 / ext4 defaults,noatime,nodiratime 0 1
```

#### External Storage (Recommended for Production)
```bash
# Use USB 3.0 SSD for better performance
# Mount external storage for Docker data
sudo mkdir -p /mnt/external
sudo mount /dev/sda1 /mnt/external

# Move Docker data directory
sudo systemctl stop docker
sudo mv /var/lib/docker /mnt/external/
sudo ln -s /mnt/external/docker /var/lib/docker
sudo systemctl start docker
```

## Deployment Commands

### Standard Deployment Operations
```bash
# Navigate to deployment directory
cd tesseract-api/scripts/deploy

# Build the Docker image (takes 5-15 minutes on Pi)
./deploy.sh build

# Start the service
./deploy.sh start

# Check service status
./deploy.sh status

# View logs
./deploy.sh logs

# Restart service
./deploy.sh restart

# Stop service
./deploy.sh stop

# Clean up (removes containers and images)
./deploy.sh cleanup
```

### Pi-Specific Deployment Options

#### Memory-Constrained Deployment
```bash
# Set environment variables for low-memory operation
export NODE_OPTIONS="--max-old-space-size=256"
export DOCKER_MEMORY_LIMIT="512m"

# Deploy with constraints
./deploy.sh build
./deploy.sh start
```

#### Performance Monitoring During Deployment
```bash
# Monitor resources during build
watch -n 1 'free -h && echo "---" && vcgencmd measure_temp' &
./deploy.sh build
kill %1  # Stop monitoring
```

## Testing and Validation

### Comprehensive Testing Suite

#### Run Full Test Suite
```bash
# Navigate to test directory
cd tesseract-api/scripts/test

# Run comprehensive deployment tests
./test-deployment.sh

# Test OCR functionality specifically
./test-ocr.sh

# Test API endpoints
./test-api.sh

# Test system permissions and setup
./test-permissions.sh
```

#### Performance Testing
```bash
# Test with different image sizes
cd scripts/test

# Small image test (< 1MB)
./test-ocr.sh small-test-image.png

# Medium image test (1-3MB)  
./test-ocr.sh medium-test-image.jpg

# Large image test (3-10MB)
./test-ocr.sh large-test-image.png
```

#### Load Testing
```bash
# Simple load test script
#!/bin/bash
# save as load-test.sh
for i in {1..10}; do
    echo "Test $i/10"
    time curl -X POST -F "image=@test-image.jpg" http://localhost:8600/ocr/process
    sleep 5  # Wait between requests
done
```

### Monitoring Pi Performance

#### Real-time Monitoring
```bash
# Monitor system resources during OCR
#!/bin/bash
# save as monitor-pi.sh
while true; do
    clear
    echo "=== Raspberry Pi Performance Monitor ==="
    echo "Temperature: $(vcgencmd measure_temp)"
    echo "CPU Frequency: $(vcgencmd measure_clock arm)"
    echo "Memory Split: $(vcgencmd get_mem arm) / $(vcgencmd get_mem gpu)"
    echo ""
    free -h
    echo ""
    docker stats tesseract-api --no-stream 2>/dev/null || echo "Container not running"
    sleep 2
done
```

#### Performance Logging
```bash
# Log performance data
#!/bin/bash
# save as log-performance.sh
LOG_FILE="pi-performance-$(date +%Y%m%d).log"
while true; do
    echo "$(date),$(vcgencmd measure_temp | cut -d= -f2),$(free | grep Mem | awk '{print $3/$2 * 100.0}')" >> $LOG_FILE
    sleep 60
done
```

## Testing Commands

### Step 1: Prepare the Test Environment (Shared Machine Safe)

```bash
# Check if Docker is already installed (don't reinstall on shared machine)
docker --version

# If Docker is not installed, ask system administrator to install it
# OR install Docker in user space (rootless mode - safer for shared machines)

# Check if user is in docker group
groups $USER | grep docker

# If not in docker group, ask administrator or use rootless Docker
# For rootless Docker installation (no sudo required):
curl -fsSL https://get.docker.com/rootless | sh

# Add to PATH for current session
export PATH=$HOME/bin:$PATH

# Add to shell profile for persistence
echo 'export PATH=$HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Step 1a: Rootless Docker Setup (Recommended for Shared Machines)

```bash
# Install rootless Docker (safer for shared environments)
curl -fsSL https://get.docker.com/rootless | sh

# Configure systemd for user services
systemctl --user enable docker
systemctl --user start docker

# Set environment variables
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock

# Make permanent
echo 'export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock' >> ~/.bashrc
```

### Step 2: Navigate to Isolated Test Directory

```bash
# Navigate to the isolated test environment
cd ~/testing/tesseract-api
```

### Step 3: Make Scripts Executable

```bash
# Make deployment scripts executable
chmod +x deploy/deploy.sh
chmod +x deploy/test-deployment.sh
```

### Step 4: Configure for Shared Machine

```bash
# Set environment variables for shared machine (optional)
export TEST_PORT=3001  # Use different port if 3000 is taken
export USER=$(whoami)  # Ensure unique container names

# Check for port conflicts
netstat -tuln | grep :3001 || echo "Port 3001 is available"
```

### Step 5: Test Local Build (Optional but Recommended)

```bash
# Test the build process locally first (faster than Docker build)
chmod +x test-build.sh
./test-build.sh
```

### Step 6: Build and Test

```bash
# Navigate to deploy directory
cd deploy

# Build the Docker image for testing (this will take several minutes on Pi)
./deploy.sh build

# Start the test service
./deploy.sh start
```

### Step 7: Verify Test Deployment

```bash
# Check service status
./deploy.sh status

# Run comprehensive tests
./test-deployment.sh

# View logs if needed
./deploy.sh logs
```

## Expected Test Output

### Successful Test Build Output

```
[2024-01-XX XX:XX:XX] Checking system requirements...
[2024-01-XX XX:XX:XX] System requirements check completed.
[2024-01-XX XX:XX:XX] Building Tesseract-API for ARM64 architecture...
[+] Building 45.2s (XX/XX) FINISHED
[2024-01-XX XX:XX:XX] Build completed successfully.
```

### Successful Test Start Output

```
[2024-01-XX XX:XX:XX] Starting Tesseract-API test service...
[+] Running 2/2
 ✔ Network deploy_default           Created
 ✔ Container tesseract-api          Started
[2024-01-XX XX:XX:XX] Waiting for service to be ready...
[2024-01-XX XX:XX:XX] Tesseract-API test instance is running successfully!
[2024-01-XX XX:XX:XX] Test service available at: http://localhost:8600
[2024-01-XX XX:XX:XX] API status: http://localhost:8600/ocr/status
```

### Successful Test Output

```
[TEST] Starting Tesseract-API deployment tests...
[TEST] ✓ Status endpoint responding correctly
[TEST] ✓ Container is healthy
[TEST] ✓ Container resource usage:
[TEST] All tests completed successfully! 🎉
[TEST] Tesseract-API testing completed successfully!
```

## Test Service Management Commands

### Testing Operations

```bash
# Check if service is running
./deploy.sh status

# View real-time logs
./deploy.sh logs

# Restart service (if needed)
./deploy.sh restart

# Stop service
./deploy.sh stop
```

### Available Testing Tools

The deployment includes several testing utilities:

#### 1. `test-deployment.sh` - Comprehensive System Test
- Tests all API endpoints
- Validates Docker health checks
- Monitors resource usage
- Includes OCR processing with SSE monitoring

#### 2. `test-ocr-complete.sh` - Full OCR Workflow Test
- Creates test image automatically (or uses provided image)
- Submits OCR request
- Monitors complete SSE progress stream
- Saves results to JSON file
- Handles cleanup automatically

#### 3. `test-sse-client.js` - SSE Stream Monitor
- Real-time progress visualization
- Detailed event logging
- Automatic result extraction
- Connection management
- Pretty-printed output

#### 4. `test-api-simple.sh` - Quick Connectivity Test
- Basic endpoint validation
- Simple status checks
- Manual testing instructions

### Test Cleanup Commands

```bash
# Stop test service
./deploy.sh stop

# Clean up test Docker resources
./deploy.sh cleanup

# Rebuild for testing (after code changes)
./deploy.sh build
./deploy.sh start
```

## Testing the API Functionality

### Quick API Test

```bash
# Run simple API connectivity test
cd deploy
chmod +x test-api-simple.sh
./test-api-simple.sh

# Or specify different URL
./test-api-simple.sh http://192.168.1.100:8600
```

### Complete OCR Test with SSE Monitoring

```bash
# Run complete OCR test with automatic image creation and SSE monitoring
cd deploy
chmod +x test-ocr-complete.sh
./test-ocr-complete.sh

# Or test with your own image
./test-ocr-complete.sh /path/to/your/image.jpg

# Or test against remote API
./test-ocr-complete.sh /path/to/image.jpg http://192.168.1.100:8600
```

### Manual Testing Steps

#### 1. Basic Status Check
```bash
# Check service status
curl http://localhost:8600/ocr/status

# Expected response:
{
  "service": "tesseract-api",
  "status": "ready",
  "processing": false
}
```

#### 2. Submit OCR Request
```bash
# Test with an image file
curl -X POST \
  -F "image=@/path/to/your/image.jpg" \
  http://localhost:8600/ocr/process

# Expected response:
{
  "jobId": "abc-123-def-456",
  "message": "OCR processing started",
  "progressUrl": "/ocr/progress/abc-123-def-456"
}
```

#### 3. Monitor Progress with SSE

**Option A: Using the SSE Test Client (Recommended)**
```bash
# Monitor with detailed progress display
node test-sse-client.js abc-123-def-456

# Or specify different API URL
node test-sse-client.js abc-123-def-456 http://192.168.1.100:8600
```

**Option B: Using curl (Basic)**
```bash
# Monitor progress with curl
curl -N -H "Accept: text/event-stream" \
  http://localhost:8600/ocr/progress/abc-123-def-456
```

### SSE Test Client Features

The Node.js SSE client (`test-sse-client.js`) provides:
- **Real-time progress bar** with percentage
- **Detailed event logging** with timestamps
- **Automatic result saving** to JSON file
- **Error handling** and connection management
- **Clean output formatting** for easy reading

Example output:
```
🔗 Connecting to SSE stream: http://localhost:8600/ocr/progress/abc-123
📡 Listening for progress updates...

[2024-01-20T10:30:15.123Z] Event #1
📝 Type: progress
📈 Progress: [████░░░░░░░░░░░░░░░░] 20%
💬 Message: Starting Tesseract OCR...

[2024-01-20T10:30:18.456Z] Event #5
📝 Type: complete
📈 Progress: [████████████████████] 100%
✅ Result received:
   📄 Words: 42
   📝 Lines: 6
   📋 Paragraphs: 2
   📦 Blocks: 1
   🔤 Sample text: "Hello World Test OCR Processing..."
   💾 Full result saved to: ocr-result-abc-123.json
```

## Troubleshooting

### Common Issues and Solutions

#### Docker Permission Denied

```bash
# If you get permission denied errors:
sudo usermod -aG docker $USER
# Then logout and login again, or reboot
```

#### Service Won't Start

```bash
# Check Docker daemon
sudo systemctl status docker

# Check available memory
free -h

# Check disk space
df -h

# View detailed logs
./deploy.sh logs
```

#### Out of Memory Errors

```bash
# Check current memory usage
docker stats tesseract-api

# If needed, reduce memory limits in docker-compose.prod.yml:
# Change memory limit from 1G to 768M or 512M
```

#### Build Fails

```bash
# Clean Docker cache and retry
docker system prune -f
./deploy.sh build
```

### Performance Monitoring

```bash
# Monitor system resources during OCR processing
htop

# Monitor Docker container resources
watch -n 1 'docker stats tesseract-api --no-stream'

# Check system temperature (important for Pi)
vcgencmd measure_temp
```

## File Permissions (Shared Machine Safe)

Ensure proper file permissions after copying (user-space only):

```bash
# Set correct permissions for the project (user-only access)
chmod -R 755 ~/testing/tesseract-api

# Make scripts executable
chmod +x ~/testing/tesseract-api/deploy/*.sh

# Ensure proper ownership (no sudo needed in user space)
chown -R $USER:$USER ~/testing/tesseract-api

# Restrict access to test directory (security on shared machine)
chmod 700 ~/testing
```

## Network Access

### Local Access

- Service runs on port 8600
- Access via: `http://localhost:8600` or `http://raspberry-pi-ip:8600`

### Firewall Configuration (Shared Machine Considerations)

```bash
# Check if port 8600 is available (avoid conflicts)
netstat -tuln | grep :8600

# If port is in use, modify docker-compose.prod.yml to use different port
# Example: change "8600:8600" to "8601:8600"

# For firewall (ask system administrator on shared machines)
# sudo ufw allow 3000  # Only if you have admin rights

# Alternative: Use SSH tunneling for remote access
ssh -L 8600:localhost:8600 user@raspberry-pi-ip
```

## Test Environment Notes

### Testing vs Production

- This setup is for **testing only** - not for production use
- Production deployment will use Docker registry and orchestration
- Test containers should be stopped after testing: `./deploy.sh stop`
- Clean up test resources when done: `./deploy.sh cleanup`

### Shared Machine Best Practices

#### Resource Isolation
- **User-space only:** All files in `~/testing/` directory
- **Rootless Docker:** No system-wide Docker installation required
- **Port management:** Check for port conflicts before starting
- **Resource limits:** Configured to not overwhelm shared system

#### System Pollution Prevention
- **No global installations:** Everything contained in user directory
- **No system modifications:** No sudo commands for core functionality
- **Clean shutdown:** Always stop and cleanup after testing
- **Temporary files:** All temp files in user-controlled directories

#### Conflict Avoidance
```bash
# Check for port conflicts before starting
netstat -tuln | grep :8600

# Check system resources before testing
free -h
df -h ~/

# Monitor resource usage during testing
htop  # Check if other processes are affected
```

#### Respectful Testing Guidelines
- **Test during off-peak hours** when possible
- **Monitor system resources** - stop if system becomes overloaded
- **Clean up immediately** after testing
- **Use resource limits** to prevent system impact
- **Communicate with other users** if sharing the machine

## Test Performance Expectations

### Raspberry Pi 5 Test Performance

- **Build time:** 3-5 minutes (first time)
- **Startup time:** 30-60 seconds
- **OCR processing:** 2-10 seconds per image (depending on size/complexity)
- **Memory usage:** 200-500MB during processing
- **CPU usage:** 50-100% during OCR processing

### Testing Tips

- Use smaller test images when possible (< 2MB recommended)
- Test with various image sizes and formats
- Monitor temperature during extended testing
- Test concurrent request rejection functionality
- Verify progress reporting via SSE streams

### Production Deployment Notes

- **This is a test environment only**
- Production will use:
  - Docker registry for image distribution
  - Container orchestration (Docker Swarm/Kubernetes)
  - Load balancing and scaling
  - Proper monitoring and logging infrastructure
  - Security hardening and secrets management

## Support

If you encounter issues:

1. **Check the logs:** `./deploy.sh logs`
2. **Verify system resources:** `./deploy.sh status`
3. **Run the test suite:** `./test-deployment.sh`
4. **Check Docker status:** `docker ps -a`
5. **Review system logs:** `sudo journalctl -u docker`

The service is designed to be robust and self-recovering, but monitoring during testing is recommended to validate functionality before production deployment.

## After Testing

### Cleanup Test Environment (Shared Machine Safe)

```bash
# Stop the test service
./deploy.sh stop

# Remove test containers and images (only our test containers)
./deploy.sh cleanup

# Clean only our test data (don't affect other users)
docker system prune -f --filter "label=project=tesseract-api-test"

# Remove test directory when completely done
cd ~
rm -rf ~/testing/tesseract-api

# For rootless Docker, clean user-specific data only
docker system prune -a -f  # Only affects current user's containers
```

### Next Steps for Production

1. **Validate test results** - Ensure all functionality works as expected
2. **Performance benchmarking** - Document Pi 5 performance characteristics
3. **Production deployment** - Will be handled via Docker registry and orchestration
4. **Monitoring setup** - Production monitoring and alerting configuration
5. **Security review** - Production security hardening and compliance
