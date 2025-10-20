# Tesseract-API Documentation

## Overview

Tesseract-API is a lightweight, containerized OCR microservice that provides real-time text extraction from document images with progress reporting. Built with NestJS and Tesseract OCR, it's designed for integration into document management systems.

## Requirements

- **Node.js**: Version 20.0.0 or higher (required for ESM package compatibility with nanoid and other modern packages)
- **npm**: Latest version recommended
- **Docker**: For containerized deployment (optional)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Build for production
npm run build

# Build and run with Docker
cd docker
docker-compose up --build
```

## Documentation Index

### API Documentation
- **[API Reference](api.md)** - Complete REST API documentation with examples
- **[OCR Data Types](../src/types/ocr.types.ts)** - TypeScript interfaces for OCR results

### Deployment Guides
- **[Deployment Guide](deployment.md)** - Comprehensive deployment instructions for all environments
- **[Raspberry Pi Guide](raspberry-pi.md)** - Pi-specific deployment with performance optimizations
- **[Windows Tools](windows-tools.md)** - Windows development and deployment setup

### Development Resources
- **[Project Structure](project-structure.md)** - Detailed file organization and architecture guide
- **[Build Scripts](../scripts/build/)** - Automated build and packaging tools
- **[Deployment Scripts](../scripts/deploy/)** - Automated deployment and management tools
- **[Test Scripts](../scripts/test/)** - Comprehensive testing and validation suite

## Project Structure

```
/
├── src/                       # NestJS application source
│   ├── ocr/                   # OCR module (controllers, services)
│   ├── types/                 # TypeScript type definitions
│   ├── app.module.ts          # Main application module
│   └── main.ts                # Application entry point
├── docker/                    # Docker configuration
│   ├── Dockerfile             # Production Docker image
│   ├── Dockerfile.pi          # Raspberry Pi optimized image
│   ├── docker-compose.yml     # Development compose
│   ├── docker-compose.prod.yml # Production compose
│   └── docker-entrypoint.sh   # Container entrypoint
├── scripts/                   # Build and deployment scripts
│   ├── build/                 # Build and packaging scripts
│   ├── deploy/                # Deployment scripts
│   └── test/                  # Testing scripts
├── docs/                      # Documentation
└── package.json               # Node.js dependencies
```

## Core Features

- **OCR Processing**: Text extraction using Tesseract OCR engine
- **Progress Reporting**: Real-time updates via Server-Sent Events (SSE)
- **Multi-language Support**: German and English language packs
- **Container Ready**: Optimized Docker images for various architectures
- **Resource Efficient**: Designed for low-resource environments

## API Endpoints

### Status Check
```http
GET /ocr/status
```

### Process Image
```http
POST /ocr/process
Content-Type: multipart/form-data

image: [file] (JPEG/PNG, max 10MB)
```

### Progress Monitoring
```http
GET /ocr/progress/{jobId}
Accept: text/event-stream
```

## Development Commands

```bash
# Local Development
npm install               # Install dependencies
npm run start:dev         # Start with hot reload
npm run format           # Format code with Prettier
npm run build            # Build for production

# Docker Development
cd docker
docker-compose up --build         # Development environment with hot reload
docker-compose -f docker-compose.prod.yml up -d  # Production environment

# Testing and Validation
cd scripts/test
./test-deployment.sh     # Comprehensive deployment test
./test-ocr.sh           # OCR functionality test with SSE monitoring
./test-api.sh           # API endpoint validation
./test-permissions.sh   # System permissions and setup validation
```

## Deployment Options

### 1. Quick Docker Deployment
```bash
# Production deployment with Docker Compose
cd docker
docker-compose -f docker-compose.prod.yml up -d

# Development deployment
cd docker
docker-compose up --build
```

### 2. Automated Script Deployment
```bash
# Using deployment scripts (recommended for production)
cd scripts/deploy
./deploy.sh build       # Build optimized Docker image
./deploy.sh start       # Start service with health checks
./deploy.sh status      # Check service status and health
```

### 3. Raspberry Pi Deployment
```bash
# Create and transfer deployment package
cd scripts/build
./create-package.sh     # Creates deployment package

# On Raspberry Pi
cd scripts/deploy
./deploy.sh build       # Uses Pi-optimized Dockerfile
./deploy.sh start       # Starts with Pi-specific resource limits
```

### 4. Standalone Docker
```bash
# Build and run manually
docker build -f docker/Dockerfile -t tesseract-api:latest .
docker run -d -p 8600:8600 --name tesseract-api tesseract-api:latest
```

## Configuration

### Environment Variables
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `TESSERACT_TEMP_DIR` - Temporary directory for OCR processing

### Docker Volumes
- `tesseract-data` - Tesseract language data persistence
- `/tmp/tesseract-api` - Temporary processing files

## Performance

### Resource Requirements
- **Memory**: 256MB minimum, 512MB recommended
- **CPU**: Single core sufficient, multi-core beneficial for concurrent requests
- **Storage**: 100MB for application, additional space for temp files

### Processing Performance
- **Small images** (< 1MB): 2-5 seconds
- **Medium images** (1-5MB): 5-15 seconds
- **Large images** (5-10MB): 15-30 seconds

## Support

For issues and questions:
1. Check the [deployment documentation](deployment.md)
2. Review [API documentation](api.md)
3. Run diagnostic tests with `scripts/test/test-deployment.sh`
4. Check container logs: `docker logs tesseract-api`

## License

This project is licensed under the MIT License.