# Tesseract-API

OCR Microservice using Tesseract with real-time progress reporting via Server-Sent Events.

## Requirements

- **Node.js**: Version 20.0.0 or higher (required for ESM package compatibility)
- **npm**: Latest version recommended

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Or use Docker
cd docker
docker-compose up --build
```

The API will be available at `http://localhost:3000`

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
│   └── docker-compose.prod.yml # Production compose
├── scripts/                   # Build and deployment scripts
│   ├── build/                 # Build and packaging scripts
│   ├── deploy/                # Deployment scripts
│   └── test/                  # Testing scripts
├── docs/                      # Documentation
│   ├── README.md              # Complete documentation
│   ├── api.md                 # API reference
│   ├── deployment.md          # Deployment guide
│   └── raspberry-pi.md        # Pi-specific deployment
└── package.json               # Node.js dependencies
```

## API Overview

### Core Endpoints
- `POST /ocr/process` - Submit image for OCR processing
- `GET /ocr/progress/{jobId}` - Monitor progress via SSE
- `GET /ocr/status` - Check service status

### Example Usage
```bash
# Submit OCR request
curl -X POST -F "image=@image.jpg" http://localhost:3000/ocr/process

# Monitor progress
curl -N -H "Accept: text/event-stream" http://localhost:3000/ocr/progress/{jobId}
```

## Development

```bash
# Development commands
npm run start:dev             # Start with hot reload
npm run format               # Format code with Prettier
npm run build                # Build for production

# Docker development
cd docker
docker-compose up            # Development environment
```

## Deployment

### Docker Deployment
```bash
cd docker
docker-compose -f docker-compose.prod.yml up -d
```

### Raspberry Pi Deployment
```bash
cd scripts/deploy
./deploy.sh build
./deploy.sh start
```

### Create Deployment Package
```bash
cd scripts/build
./create-package.sh
```

## Scripts and Automation

### Build Scripts
```bash
cd scripts/build
./create-package.sh      # Create deployment package
./test-build.sh         # Test build process
```

### Deployment Scripts  
```bash
cd scripts/deploy
./deploy.sh build       # Build Docker image
./deploy.sh start       # Start service
./deploy.sh status      # Check service health
./deploy.sh logs        # View service logs
./deploy.sh stop        # Stop service
./deploy.sh cleanup     # Clean up resources
```

### Testing Scripts
```bash
cd scripts/test
./test-deployment.sh    # Comprehensive deployment test
./test-ocr.sh          # OCR functionality with SSE monitoring
./test-api.sh          # API endpoint validation
./test-permissions.sh  # System setup validation
```

## Documentation

- **[📚 Complete Documentation](docs/README.md)** - Comprehensive project documentation and guides
- **[🔌 API Reference](docs/api.md)** - Detailed REST API documentation with examples
- **[🚀 Deployment Guide](docs/deployment.md)** - Complete deployment instructions for all environments
- **[🥧 Raspberry Pi Guide](docs/raspberry-pi.md)** - Pi-specific deployment with performance optimizations

## Features

- **OCR Processing**: Text extraction using Tesseract OCR engine
- **Progress Reporting**: Real-time updates via Server-Sent Events (SSE)
- **Multi-language Support**: German and English language packs
- **Container Ready**: Optimized Docker images for various architectures
- **Resource Efficient**: Designed for low-resource environments
- **Hierarchical Output**: Words, lines, paragraphs, and blocks with bounding boxes