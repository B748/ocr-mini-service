# Project Structure

## Directory Organization

### Minimal OCR Microservice Structure
```
/
├── .kiro/                 # Kiro AI assistant configuration
│   ├── steering/          # AI guidance rules
│   └── specs/             # Feature specifications
├── src/                   # NestJS API source code
│   ├── ocr/               # OCR module (controllers, services)
│   ├── common/            # Shared utilities
│   └── main.ts            # Application entry point
├── ocr-engine/            # C++ OCR engine (if compilation needed)
│   ├── src/               # C++ source files
│   ├── include/           # Header files
│   └── CMakeLists.txt     # Build configuration
├── docs/                  # Documentation
│   ├── api.md             # REST API documentation
│   ├── ocr-engine.md      # C++ OCR engine documentation
│   └── deployment.md     # Docker deployment guide
├── docker/                # Docker configuration
│   ├── Dockerfile         # Multi-stage build
│   └── docker-compose.yml # Local development (optional)
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── .prettierrc            # Prettier formatting rules
└── README.md              # Setup and usage guide
```

### Simplified Structure (if Tesseract via Alpine packages)
```
/
├── .kiro/                 # Kiro AI assistant configuration
├── src/                   # NestJS API source code
├── docs/                  # Markdown documentation only
├── Dockerfile             # Single Docker configuration
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── .prettierrc            # Prettier formatting
└── README.md              # Complete setup guide
```

### File Naming Conventions
- **TypeScript/NestJS:** camelCase for files: `ocrController.ts`, `progressService.ts`
- **C++ (if needed):** snake_case: `ocr_processor.cpp`, `progress_reporter.h`
- **Documentation:** kebab-case: `api-reference.md`, `deployment-guide.md`
- **Docker:** Standard names: `Dockerfile`, `docker-compose.yml`
- **Configuration:** Standard names: `package.json`, `tsconfig.json`, `.prettierrc`

### Code Organization Principles
- **Minimal complexity:** Keep structure as flat as possible
- **Single responsibility:** Each module handles one concern
- **No unnecessary abstractions:** Direct, simple implementations
- **Docker-first:** Structure optimized for containerized deployment

### Configuration Strategy
- **No config files by default:** Hardcoded sensible defaults
- **Environment variables only:** For host-specific performance tuning
- **Runtime configuration:** Via API parameters when needed
- **Volume mounts:** For Tesseract language files persistence

### Documentation Structure
- **README.md:** Complete setup, build, and deployment instructions
- **docs/api.md:** REST endpoints, SSE streams, request/response schemas
- **docs/ocr-engine.md:** C++ implementation details (if separate compilation)
- **docs/deployment.md:** Docker deployment scenarios (Pi to server)

### Docker Volume Strategy
```
volumes:
  - tesseract-data:/usr/share/tesseract-ocr/4.00/tessdata/
```

## Best Practices
- **Minimize dependencies:** Only essential packages
- **Keep it simple:** Avoid over-engineering
- **Docker-optimized:** Structure supports multi-stage builds
- **Performance-aware:** Separate concerns for optimal resource usage
- **Deployment-ready:** Everything needed for production deployment
- **Documentation-driven:** Clear setup instructions for any skill level