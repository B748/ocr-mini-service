# Tesseract-API Deployment Guide

This comprehensive guide covers deployment options for the Tesseract-API OCR microservice across different environments, from development to production.

## Quick Start

### Development Deployment
```bash
# Clone and setup
git clone <repository-url>
cd tesseract-api
npm install

# Start with Docker (recommended)
cd docker
docker-compose up --build

# Or start locally
npm run start:dev
```

### Production Deployment
```bash
# Build and deploy with Docker
cd docker
docker-compose -f docker-compose.prod.yml up -d

# Or use deployment scripts
cd scripts/deploy
./deploy.sh build
./deploy.sh start
```

## Deployment Methods

### 1. Docker Compose (Recommended)

#### Development Environment
```bash
cd docker
docker-compose up --build
```

**Features:**
- Hot reload for development
- Volume mounts for code changes
- Development-optimized settings
- Automatic container restart

**Configuration:** Uses `docker/docker-compose.yml`

#### Production Environment
```bash
cd docker
docker-compose -f docker-compose.prod.yml up -d
```

**Features:**
- Optimized production image
- Health checks and restart policies
- Resource limits and security settings
- Persistent volume for Tesseract data

**Configuration:** Uses `docker/docker-compose.prod.yml`

### 2. Deployment Scripts

The project includes automated deployment scripts for different scenarios:

#### Standard Deployment
```bash
cd scripts/deploy
./deploy.sh build    # Build Docker image
./deploy.sh start    # Start service
./deploy.sh status   # Check status
```

#### Available Commands
```bash
./deploy.sh build     # Build the Docker image
./deploy.sh start     # Start the service
./deploy.sh stop      # Stop the service
./deploy.sh restart   # Restart the service
./deploy.sh logs      # Show service logs
./deploy.sh status    # Show service status and health
./deploy.sh cleanup   # Stop service and clean up resources
```

### 3. Standalone Docker

#### Build and Run
```bash
# Build production image
docker build -f docker/Dockerfile -t tesseract-api:latest .

# Run container
docker run -d \
  --name tesseract-api \
  -p 3000:3000 \
  --restart unless-stopped \
  tesseract-api:latest
```

#### Raspberry Pi Optimized
```bash
# Build Pi-optimized image
docker build -f docker/Dockerfile.pi -t tesseract-api:pi .

# Run with resource limits
docker run -d \
  --name tesseract-api \
  -p 3000:3000 \
  --memory=512m \
  --cpus=1.0 \
  --restart unless-stopped \
  tesseract-api:pi
```

## Environment-Specific Deployment

### Local Development

#### Prerequisites
- Node.js 18+ installed
- Docker and Docker Compose installed
- Git for cloning repository

#### Setup
```bash
# Clone repository
git clone <repository-url>
cd tesseract-api

# Install dependencies
npm install

# Start development server
npm run start:dev

# Or use Docker for development
cd docker
docker-compose up --build
```

### Production Server

#### Prerequisites
- Docker and Docker Compose installed
- Sufficient system resources (1GB RAM minimum)
- Network access for Docker image pulls

#### Deployment
```bash
# Method 1: Using deployment scripts
cd scripts/deploy
./deploy.sh build
./deploy.sh start

# Method 2: Using Docker Compose directly
cd docker
docker-compose -f docker-compose.prod.yml up -d

# Method 3: Using deployment package
cd scripts/build
./create-package.sh
# Transfer package to production server and extract
```

### Raspberry Pi Deployment

For detailed Raspberry Pi deployment instructions, see [Raspberry Pi Guide](raspberry-pi.md).

#### Quick Pi Setup
```bash
# Create deployment package
cd scripts/build
./create-package.sh

# Transfer to Raspberry Pi
scp tesseract-api-deploy-*.tar.gz pi@<pi-ip>:~/

# On Raspberry Pi
tar -xzf tesseract-api-deploy-*.tar.gz
cd tesseract-api-deploy-*/scripts/deploy
chmod +x deploy.sh
./deploy.sh build
./deploy.sh start
```

### Cloud Deployment

#### Docker Registry Deployment
```bash
# Build and tag
docker build -f docker/Dockerfile -t your-registry/tesseract-api:latest .

# Push to registry
docker push your-registry/tesseract-api:latest

# Deploy on target machine
docker pull your-registry/tesseract-api:latest
docker run -d --name tesseract-api -p 3000:3000 your-registry/tesseract-api:latest
```

#### Container Orchestration

**Kubernetes Example:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tesseract-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tesseract-api
  template:
    metadata:
      labels:
        app: tesseract-api
    spec:
      containers:
      - name: tesseract-api
        image: your-registry/tesseract-api:latest
        ports:
        - containerPort: 3000
        resources:
          limits:
            memory: "1Gi"
            cpu: "1000m"
          requests:
            memory: "256Mi"
            cpu: "250m"
        livenessProbe:
          httpGet:
            path: /ocr/status
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: tesseract-api-service
spec:
  selector:
    app: tesseract-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

**Docker Swarm Example:**
```yaml
version: '3.8'
services:
  tesseract-api:
    image: your-registry/tesseract-api:latest
    ports:
      - "3000:3000"
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 256M
          cpus: '0.25'
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/ocr/status"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `TESSERACT_TEMP_DIR` | `/tmp/tesseract-api` | Temporary directory for OCR processing |
| `NODE_OPTIONS` | - | Node.js runtime options (e.g., `--max-old-space-size=512`) |

### Docker Environment Configuration

#### Using Docker Run
```bash
docker run -d \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e TESSERACT_TEMP_DIR=/tmp/tesseract-api \
  -e NODE_OPTIONS="--max-old-space-size=512" \
  -p 3000:3000 \
  tesseract-api:latest
```

#### Using Docker Compose
```yaml
# docker/docker-compose.prod.yml
services:
  tesseract-api:
    environment:
      - NODE_ENV=production
      - PORT=3000
      - TESSERACT_TEMP_DIR=/tmp/tesseract-api
      - NODE_OPTIONS=--max-old-space-size=512
```

#### Using Environment File
Create `.env` file in the `docker/` directory:
```bash
NODE_ENV=production
PORT=3000
TESSERACT_TEMP_DIR=/tmp/tesseract-api
NODE_OPTIONS=--max-old-space-size=512
```

## Volumes and Persistence

### Tesseract Language Data
```bash
# Create named volume for language data persistence
docker volume create tesseract-data

# Mount in container
docker run -d \
  -v tesseract-data:/usr/share/tesseract-ocr/4.00/tessdata/ \
  tesseract-api:latest
```

### Temporary Files Management
```bash
# Mount host directory for temp files (optional)
docker run -d \
  -v /host/tmp/tesseract:/tmp/tesseract-api \
  tesseract-api:latest
```

### Docker Compose Volumes
```yaml
# docker/docker-compose.prod.yml
services:
  tesseract-api:
    volumes:
      - tesseract-data:/usr/share/tesseract-ocr/4.00/tessdata/
      - /host/tmp:/tmp/tesseract-api

volumes:
  tesseract-data:
    driver: local
```

## Health Checks and Monitoring

### Built-in Health Checks

The Docker images include comprehensive health checks:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ocr/status || exit 1
```

### Manual Health Verification

#### Service Status Check
```bash
curl http://localhost:3000/ocr/status

# Expected response:
{
  "service": "tesseract-api",
  "status": "ready",
  "processing": false
}
```

#### Debug Information
```bash
curl http://localhost:3000/ocr/debug

# Returns system information including:
# - Tesseract version and available languages
# - Temporary directory status
# - System resources
# - Node.js version
```

### Container Health Monitoring
```bash
# Check Docker health status
docker inspect --format='{{.State.Health.Status}}' tesseract-api

# Monitor container statistics
docker stats tesseract-api

# View health check logs
docker inspect tesseract-api | jq '.[0].State.Health'
```

### Automated Testing
```bash
# Run comprehensive deployment tests
cd scripts/test
./test-deployment.sh

# Test OCR functionality specifically
./test-ocr.sh

# Test API endpoints
./test-api.sh
```

## Security Considerations

### Container Security
- **Non-root execution**: Runs as user `tesseract` (UID 1001)
- **Minimal base image**: Alpine Linux with only essential packages
- **No shell access**: Production images don't include shell utilities
- **Read-only filesystem**: Can be configured for additional security

#### Enhanced Security Configuration
```bash
# Run with additional security options
docker run -d \
  --name tesseract-api \
  --user 1001:1001 \
  --read-only \
  --tmpfs /tmp \
  --tmpfs /var/tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  -p 127.0.0.1:3000:3000 \
  tesseract-api:latest
```

### Network Security
```bash
# Create custom network
docker network create --driver bridge tesseract-net

# Run container in custom network
docker run -d \
  --network tesseract-net \
  --name tesseract-api \
  tesseract-api:latest

# Expose only to localhost
docker run -d -p 127.0.0.1:3000:3000 tesseract-api:latest
```

### Resource Limits and Protection
```bash
# Production resource limits
docker run -d \
  --memory=1g \
  --memory-swap=1g \
  --cpus=1.0 \
  --pids-limit=100 \
  --ulimit nofile=1024:1024 \
  tesseract-api:latest
```

## Performance Tuning

### Resource Optimization

#### Memory-Constrained Environments
```bash
# Optimize for low-memory systems (e.g., Raspberry Pi)
docker run -d \
  --memory=512m \
  --memory-swap=512m \
  --oom-kill-disable=false \
  -e NODE_OPTIONS="--max-old-space-size=256" \
  tesseract-api:pi
```

#### High-Performance Environments
```bash
# Optimize for high-performance systems
docker run -d \
  --memory=2g \
  --cpus=2.0 \
  -e NODE_OPTIONS="--max-old-space-size=1536" \
  tesseract-api:latest
```

### Tesseract Optimization
- **Language selection**: Only install required language packs
- **Image preprocessing**: Optimize images before OCR processing
- **Parallel processing**: Run multiple instances for concurrent requests

### Container Optimization
- **Multi-stage builds**: Already implemented for minimal image size
- **Layer caching**: Optimize Dockerfile for better build caching
- **Base image updates**: Regularly update base images for security and performance

## Scaling and Load Balancing

### Horizontal Scaling

Since the service processes one request at a time per instance, scale by running multiple instances:

#### Docker Compose Scaling
```bash
# Scale to 3 instances
cd docker
docker-compose -f docker-compose.prod.yml up -d --scale tesseract-api=3
```

#### Manual Instance Management
```bash
# Run multiple instances on different ports
docker run -d -p 3001:3000 --name tesseract-api-1 tesseract-api:latest
docker run -d -p 3002:3000 --name tesseract-api-2 tesseract-api:latest
docker run -d -p 3003:3000 --name tesseract-api-3 tesseract-api:latest
```

### Load Balancer Configuration

#### Nginx Load Balancer
```nginx
upstream tesseract_backend {
    least_conn;
    server localhost:3001 max_fails=3 fail_timeout=30s;
    server localhost:3002 max_fails=3 fail_timeout=30s;
    server localhost:3003 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name tesseract-api.example.com;
    
    location / {
        proxy_pass http://tesseract_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE support
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
    }
    
    location /ocr/status {
        proxy_pass http://tesseract_backend;
        # Health check endpoint - faster timeout
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
}
```

#### HAProxy Configuration
```haproxy
global
    daemon
    maxconn 4096

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend tesseract_frontend
    bind *:80
    default_backend tesseract_backend

backend tesseract_backend
    balance leastconn
    option httpchk GET /ocr/status
    server api1 localhost:3001 check
    server api2 localhost:3002 check
    server api3 localhost:3003 check
```

## Backup and Recovery

### Data Backup Strategies

#### Application Data
```bash
# Backup Tesseract language data
docker run --rm \
  -v tesseract-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/tesseract-data-$(date +%Y%m%d).tar.gz -C /data .

# Backup configuration files
tar czf config-backup-$(date +%Y%m%d).tar.gz \
  docker/ \
  scripts/ \
  docs/ \
  package*.json \
  tsconfig.json \
  nest-cli.json
```

#### Container Images
```bash
# Save Docker image
docker save tesseract-api:latest | gzip > tesseract-api-image-$(date +%Y%m%d).tar.gz

# Load Docker image
gunzip -c tesseract-api-image-20241019.tar.gz | docker load
```

#### Application Logs
```bash
# Export container logs
docker logs tesseract-api > tesseract-api-logs-$(date +%Y%m%d).txt

# Export system logs (if using systemd)
journalctl -u docker > docker-logs-$(date +%Y%m%d).txt
```

### Recovery Procedures

#### Data Recovery
```bash
# Restore Tesseract data
docker run --rm \
  -v tesseract-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/tesseract-data-20241019.tar.gz -C /data

# Restore configuration
tar xzf config-backup-20241019.tar.gz
```

#### Service Recovery
```bash
# Stop current service
cd scripts/deploy
./deploy.sh stop

# Restore from backup
docker load < tesseract-api-image-20241019.tar.gz

# Restart service
./deploy.sh start
```

#### Disaster Recovery
```bash
# Complete system recovery
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Restore application files
tar xzf config-backup-20241019.tar.gz

# 3. Restore Docker image
docker load < tesseract-api-image-20241019.tar.gz

# 4. Restore data volumes
docker volume create tesseract-data
docker run --rm -v tesseract-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/tesseract-data-20241019.tar.gz -C /data

# 5. Start service
cd scripts/deploy
./deploy.sh start
```

## Troubleshooting

### Common Issues and Solutions

#### Service Won't Start
```bash
# Check Docker daemon status
sudo systemctl status docker

# Check system resources
free -h
df -h

# Check Docker logs
docker logs tesseract-api

# Check deployment script logs
cd scripts/deploy
./deploy.sh logs
```

#### OCR Processing Fails
```bash
# Check debug information
curl http://localhost:3000/ocr/debug

# Verify Tesseract installation
docker exec tesseract-api tesseract --version

# Check available languages
docker exec tesseract-api tesseract --list-langs

# Test with simple image
curl -X POST -F "image=@simple-text.png" http://localhost:3000/ocr/process
```

#### Performance Issues
```bash
# Monitor resource usage
docker stats tesseract-api

# Check system load
htop
iostat -x 1

# Analyze processing times
cd scripts/test
./test-ocr.sh  # Includes timing information
```

#### Memory Issues
```bash
# Check memory usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Reduce memory limits if needed
docker update --memory=512m tesseract-api

# Check for memory leaks
docker exec tesseract-api ps aux
```

#### Network Issues
```bash
# Check port availability
netstat -tuln | grep 3000

# Test network connectivity
curl -v http://localhost:3000/ocr/status

# Check firewall settings
sudo ufw status
```

### Log Analysis

#### Application Logs
```bash
# Follow logs in real-time
docker logs -f tesseract-api

# Search for errors
docker logs tesseract-api 2>&1 | grep -i error

# Filter by timestamp
docker logs tesseract-api --since="2024-01-01T00:00:00"

# Export logs for analysis
docker logs tesseract-api > /tmp/tesseract-api-$(date +%Y%m%d).log
```

#### System Logs
```bash
# Docker daemon logs
journalctl -u docker -f

# System resource logs
dmesg | grep -i memory
dmesg | grep -i oom
```

### Performance Monitoring

#### Real-time Monitoring
```bash
# Monitor container performance
watch -n 1 'docker stats tesseract-api --no-stream'

# Monitor system performance
watch -n 1 'free -h && echo "---" && df -h'

# Monitor OCR processing
cd scripts/test
watch -n 5 './test-api.sh'
```

#### Historical Analysis
```bash
# Collect performance data
docker stats tesseract-api --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" > performance-$(date +%Y%m%d).log

# Analyze trends
grep tesseract-api performance-*.log | awk '{print $2, $3}' > cpu-memory-usage.csv
```

## Deployment Checklist

### Pre-deployment Checklist
- [ ] **System Requirements**
  - [ ] Docker installed and running
  - [ ] Docker Compose available
  - [ ] Sufficient RAM (1GB minimum, 2GB recommended)
  - [ ] Sufficient storage (2GB minimum for images and temp files)
  - [ ] Network ports available (3000 by default)

- [ ] **Security Preparation**
  - [ ] Firewall configured appropriately
  - [ ] SSL/TLS certificates ready (if using HTTPS)
  - [ ] User permissions configured
  - [ ] Backup strategy planned

### Deployment Checklist
- [ ] **Build and Deploy**
  - [ ] Source code downloaded/cloned
  - [ ] Docker image builds successfully
  - [ ] Container starts without errors
  - [ ] Health check passes
  - [ ] All required ports are accessible

- [ ] **Functional Testing**
  - [ ] API status endpoint responds correctly
  - [ ] OCR processing works with test image
  - [ ] SSE progress monitoring functions
  - [ ] Error handling works correctly
  - [ ] Resource limits are respected

### Post-deployment Checklist
- [ ] **Monitoring and Maintenance**
  - [ ] Log rotation configured
  - [ ] Monitoring alerts set up
  - [ ] Backup procedures tested
  - [ ] Documentation updated with deployment-specific details
  - [ ] Team trained on operational procedures

- [ ] **Performance Validation**
  - [ ] Load testing completed
  - [ ] Performance benchmarks established
  - [ ] Resource usage within acceptable limits
  - [ ] Scaling procedures tested

## Support and Maintenance

### Regular Maintenance Tasks

#### Weekly Tasks
```bash
# Check service health
cd scripts/test
./test-deployment.sh

# Review logs for errors
docker logs tesseract-api --since="7 days ago" | grep -i error

# Check resource usage trends
docker stats tesseract-api --no-stream
```

#### Monthly Tasks
```bash
# Update base images
docker pull node:18-alpine
cd docker
docker-compose build --no-cache

# Clean up unused resources
docker system prune -f

# Backup configuration and data
# (See Backup and Recovery section)
```

#### Quarterly Tasks
```bash
# Update dependencies
npm audit fix
npm update

# Review and update documentation
# Review security settings
# Performance optimization review
```

### Monitoring and Alerting

#### Basic Monitoring Setup
```bash
# Simple health check script
#!/bin/bash
# save as monitor-tesseract.sh
if ! curl -f http://localhost:3000/ocr/status > /dev/null 2>&1; then
    echo "ALERT: Tesseract-API is not responding"
    # Add notification logic here (email, Slack, etc.)
fi
```

#### Advanced Monitoring
Consider integrating with monitoring solutions like:
- **Prometheus + Grafana** for metrics and dashboards
- **ELK Stack** for log aggregation and analysis
- **Docker monitoring tools** like Portainer or Watchtower
- **Cloud monitoring** services (AWS CloudWatch, Google Cloud Monitoring, etc.)

### Getting Help

For additional support:
1. **Check documentation**: [API Documentation](api.md), [Raspberry Pi Guide](raspberry-pi.md)
2. **Run diagnostic tests**: `scripts/test/test-deployment.sh`
3. **Check logs**: `docker logs tesseract-api`
4. **Review system resources**: `docker stats tesseract-api`
5. **Verify configuration**: `curl http://localhost:3000/ocr/debug`

### Contributing to Documentation

If you find issues with this documentation or have improvements:
1. Update the relevant documentation files in `docs/`
2. Test your changes with actual deployments
3. Submit improvements via your version control system
4. Keep documentation in sync with code changes