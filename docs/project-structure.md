# Project Structure Guide

This document provides a detailed overview of the Tesseract-API project structure and organization principles.

## Overview

The Tesseract-API project follows a clean, modular structure that separates concerns and provides clear organization for development, deployment, and documentation.

## Directory Structure

```
tesseract-api/
├── .kiro/                     # Kiro AI assistant configuration
│   └── steering/              # AI guidance and project rules
├── src/                       # NestJS application source code
│   ├── ocr/                   # OCR module (controllers, services)
│   │   ├── ocr.controller.ts  # REST API endpoints
│   │   ├── ocr.service.ts     # Business logic and orchestration
│   │   ├── ocr.module.ts      # NestJS module definition
│   │   └── tesseract.service.ts # Tesseract OCR engine integration
│   ├── types/                 # TypeScript type definitions
│   │   └── ocr.types.ts       # OCR data interfaces and types
│   ├── app.module.ts          # Main application module
│   └── main.ts                # Application entry point
├── docker/                    # Docker configuration and files
│   ├── Dockerfile             # Production Docker image
│   ├── Dockerfile.pi          # Raspberry Pi optimized image
│   ├── docker-compose.yml     # Development environment
│   ├── docker-compose.prod.yml # Production environment
│   └── docker-entrypoint.sh   # Container startup script
├── scripts/                   # Automation and utility scripts
│   ├── build/                 # Build and packaging scripts
│   │   ├── create-package.sh  # Unix/Linux package creation
│   │   ├── create-package.ps1 # Windows PowerShell package creation
│   │   ├── create-package.bat # Windows batch package creation
│   │   └── test-build.sh      # Build testing and validation
│   ├── deploy/                # Deployment and management scripts
│   │   ├── deploy.sh          # Unix/Linux deployment script
│   │   └── deploy.ps1         # Windows PowerShell deployment script
│   └── test/                  # Testing and validation scripts
│       ├── test-api.sh        # API endpoint testing
│       ├── test-deployment.sh # Comprehensive deployment testing
│       ├── test-ocr.sh        # OCR functionality testing
│       ├── test-permissions.sh # System permissions testing
│       └── test-sse-client.js # SSE client testing utility
├── docs/                      # Project documentation
│   ├── README.md              # Main project documentation
│   ├── api.md                 # Complete API reference
│   ├── deployment.md          # Deployment guide for all environments
│   ├── raspberry-pi.md        # Raspberry Pi specific deployment
│   ├── windows-tools.md       # Windows development and deployment
│   └── project-structure.md   # This file - project organization guide
├── package.json               # Node.js dependencies and scripts
├── tsconfig.json              # TypeScript compiler configuration
├── nest-cli.json              # NestJS CLI configuration
├── .prettierrc                # Code formatting configuration
├── .dockerignore              # Docker build ignore patterns
└── README.md                  # Quick start guide and overview
```

## Design Principles

### 1. Separation of Concerns
Each directory has a specific, well-defined purpose:
- **Source code** (`src/`) - Application logic only
- **Docker configuration** (`docker/`) - All containerization files
- **Scripts** (`scripts/`) - Automation and utility tools
- **Documentation** (`docs/`) - All project documentation

### 2. Environment Separation
Clear separation between development and production configurations:
- Development: `docker-compose.yml`, hot reload, debugging
- Production: `docker-compose.prod.yml`, optimized images, resource limits

### 3. Platform Support
Multi-platform support with specific optimizations:
- **Standard Docker**: General Linux/x64 deployments
- **Raspberry Pi**: ARM64 optimized builds (`Dockerfile.pi`)
- **Windows**: PowerShell and batch scripts for Windows development

### 4. Modular Architecture
The application follows NestJS modular architecture:
- **OCR Module**: Self-contained OCR functionality
- **Types Module**: Shared type definitions
- **Main Module**: Application bootstrap and configuration

## File Organization Patterns

### Naming Conventions

#### TypeScript/JavaScript Files
- **camelCase** for files: `ocrController.ts`, `tesseractService.ts`
- **PascalCase** for classes: `OcrController`, `TesseractService`
- **kebab-case** for modules: `ocr.module.ts`, `app.module.ts`

#### Scripts and Configuration
- **kebab-case** for scripts: `test-deployment.sh`, `create-package.sh`
- **lowercase** for config: `package.json`, `tsconfig.json`
- **UPPERCASE** for constants: `README.md`, `Dockerfile`

#### Documentation
- **kebab-case** for docs: `raspberry-pi.md`, `project-structure.md`
- **lowercase** for main docs: `readme.md`, `api.md`

### Directory Naming
- **lowercase** for all directories: `src/`, `docker/`, `scripts/`
- **descriptive names** that clearly indicate purpose
- **consistent depth** - avoid deeply nested structures

## Module Architecture

### Source Code Organization (`src/`)

#### OCR Module (`src/ocr/`)
The core OCR functionality is encapsulated in a self-contained NestJS module:

```typescript
// ocr.module.ts - Module definition
@Module({
  controllers: [OcrController],
  providers: [OcrService, TesseractService],
})
export class OcrModule {}
```

**Components:**
- **Controller** (`ocr.controller.ts`) - HTTP endpoints and request handling
- **Service** (`ocr.service.ts`) - Business logic and orchestration
- **Tesseract Service** (`tesseract.service.ts`) - OCR engine integration

#### Types Module (`src/types/`)
Centralized type definitions for consistent data structures:

```typescript
// ocr.types.ts - OCR data interfaces
export interface OCRResult {
  words: DimensionData<TextContent>[];
  lines: OCRHierarchyElement[];
  paragraphs: OCRHierarchyElement[];
  blocks: OCRHierarchyElement[];
}
```

### Docker Configuration (`docker/`)

#### Multi-Stage Builds
Both Dockerfiles use multi-stage builds for optimization:

1. **Builder Stage**: Install dependencies and build application
2. **Production Stage**: Minimal runtime with only necessary files

#### Environment-Specific Configurations
- **Development** (`docker-compose.yml`): Volume mounts, hot reload
- **Production** (`docker-compose.prod.yml`): Optimized settings, resource limits

### Scripts Organization (`scripts/`)

#### Build Scripts (`scripts/build/`)
Automated build and packaging tools:
- **Cross-platform support**: Shell, PowerShell, and Batch versions
- **Consistent output**: All create identical deployment packages
- **Validation**: Built-in testing and verification

#### Deployment Scripts (`scripts/deploy/`)
Environment management and deployment automation:
- **Unified interface**: Same commands across platforms
- **Health monitoring**: Built-in health checks and status reporting
- **Resource management**: Automatic cleanup and resource monitoring

#### Test Scripts (`scripts/test/`)
Comprehensive testing and validation suite:
- **API testing**: Endpoint validation and response verification
- **OCR testing**: Functional testing with real images
- **Deployment testing**: End-to-end deployment validation
- **Performance testing**: Resource usage and performance monitoring

## Configuration Management

### Environment Variables
Centralized configuration through environment variables:
- **Development**: Default values in code
- **Production**: Override via Docker environment or `.env` files
- **Platform-specific**: Optimizations for different deployment targets

### Docker Configuration
Layered configuration approach:
1. **Base configuration**: Common settings in main Dockerfile
2. **Environment overrides**: Compose files for specific environments
3. **Runtime configuration**: Environment variables and volume mounts

## Development Workflow

### Local Development
```bash
# Setup
npm install
npm run start:dev

# Or with Docker
cd docker
docker-compose up --build
```

### Testing
```bash
# Run all tests
cd scripts/test
./test-deployment.sh

# Specific tests
./test-api.sh
./test-ocr.sh
```

### Building and Packaging
```bash
# Create deployment package
cd scripts/build
./create-package.sh

# Test build
./test-build.sh
```

### Deployment
```bash
# Deploy to production
cd scripts/deploy
./deploy.sh build
./deploy.sh start
```

## Extensibility

### Adding New Features
1. **Create module** in `src/` following NestJS patterns
2. **Add types** in `src/types/` for new data structures
3. **Update tests** in `scripts/test/` for new functionality
4. **Document** in `docs/` with usage examples

### Adding New Platforms
1. **Create Dockerfile** in `docker/` for platform-specific optimizations
2. **Add scripts** in `scripts/` for platform-specific deployment
3. **Update documentation** in `docs/` with platform-specific instructions

### Adding New Environments
1. **Create compose file** in `docker/` for environment-specific configuration
2. **Update deployment scripts** to support new environment
3. **Add testing** for new environment validation

## Best Practices

### Code Organization
- **Single responsibility**: Each file has one clear purpose
- **Consistent naming**: Follow established naming conventions
- **Clear dependencies**: Explicit imports and module boundaries
- **Type safety**: Comprehensive TypeScript types

### Configuration Management
- **Environment-based**: Use environment variables for configuration
- **Secure defaults**: Safe default values for all settings
- **Documentation**: Clear documentation for all configuration options

### Testing Strategy
- **Automated testing**: Comprehensive test suite for all functionality
- **Environment testing**: Test in target deployment environments
- **Performance testing**: Monitor resource usage and performance

### Documentation
- **Keep current**: Update documentation with code changes
- **Clear examples**: Provide working examples for all features
- **Multiple audiences**: Documentation for developers, operators, and users

This structure provides a solid foundation for development, deployment, and maintenance while remaining flexible for future enhancements and platform support.