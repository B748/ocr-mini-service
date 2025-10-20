# Technology Stack

## Core Architecture

**OCR Microservice with REST API**

- **Purpose:** Document text extraction service for document management systems
- **Deployment:** Docker container optimized for low-resource environments (Raspberry Pi to high-end servers)
- **Concurrency:** Single request processing with queue rejection for additional requests

## Primary Technologies

### API Server

- **Language:** TypeScript
- **Framework:** NestJS
- **Code Quality:** Prettier for formatting
- **Communication:** RESTful API with Server-Sent Events (SSE) for progress reporting

### OCR Engine

- **Language:** C++
- **OCR Library:** Tesseract
- **Architecture:** Separate process with IPC communication via named pipes/sockets
- **Languages:** German (GER), English (ENG) - extensible
- **Output:** Text extraction, bounding boxes, confidence scores

### Container & Deployment

- **Container:** Multi-stage Docker build
- **Base Image:** Alpine Linux for minimal footprint
- **Optimization:** Slim image optimized for performance on low-resource systems

## Build System & Package Management

- **Node.js:** npm/yarn for NestJS dependencies
- **C++:** CMake build system for OCR engine
- **Docker:** Multi-stage builds for optimal image size

## Development Environment

- Kiro AI assistant for code generation and assistance
- Windows development environment with PowerShell/CMD support
- Cross-platform Docker development

## Input/Output Specifications

- **Input Formats:** JPEG, PNG (< 10MB)
- **Processing:** No image preprocessing (extensible later)
- **Output Format:** Structured JSON with hierarchical OCR data
- **Configuration:** API-configurable OCR parameters (placeholder for future iteration)

### OCR Response Data Model

**Base Dimension Interface:**
```typescript
export interface DimensionData<T = void> {
    left: number;
    top: number;
    width: number;
    height: number;
    baseline?: number;
    data?: T;
}
```

**Content Type Interfaces:**
```typescript
export interface DataContent {
    id: string;
    content: string;
    type: 'QR_CODE' | 'BAR_CODE' | 'OTHER' | string;
}

export interface StructureContent {
    id: string;
    type: 'H_BAR' | 'V_BAR' | 'IMAGE' | string;
}

export interface TextContent {
    id: string;
    text: string;
    confidence?: number;
}
```

**OCR Result Structure:**
```typescript
interface OCRResult {
    words: DimensionData<TextContent>[];          // Individual recognized words
    lines: OCRHierarchyElement[];                 // Text lines containing words
    paragraphs: OCRHierarchyElement[];            // Paragraphs containing lines
    blocks: OCRHierarchyElement[];                // Text blocks containing paragraphs
}

interface OCRHierarchyElement extends DimensionData<StructureContent> {
    childIds: string[];                           // References to child element IDs
}
```

**Hierarchy Relationships:**
- **Words:** Base text elements with individual bounding boxes and confidence scores
- **Lines:** Contain `childIds` referencing word IDs that belong to this line
- **Paragraphs:** Contain `childIds` referencing line IDs that belong to this paragraph  
- **Blocks:** Contain `childIds` referencing paragraph IDs that belong to this block
- **Traversal:** Flexible navigation from any hierarchy level to children via ID references
- **Efficiency:** Flat arrays with ID-based relationships for optimal memory usage and lookup performance

## Communication Architecture

- **Client ↔ API:** HTTP REST + Server-Sent Events (SSE)
- **API ↔ OCR Engine:** Named pipes/Unix sockets for progress reporting
- **Progress Updates:** Real-time via SSE stream

## Common Commands

### Development

```bash
# Install API dependencies
npm install

# Build OCR engine
cmake --build build --config Release

# Start development server
npm run start:dev

# Build Docker image
docker build -t ocr-microservice .
```

### Deployment

```bash
# Build production Docker image
docker build --target production -t ocr-microservice:latest .

# Run container
docker run -p 8600:8600 ocr-microservice:latest

# Deploy to registry
docker push ocr-microservice:latest
```

## Performance Considerations

- **Memory:** Optimized for low-resource environments
- **Processing:** Single-threaded OCR with progress reporting
- **Response Time:** No strict limits, focus on progress visibility
- **Resource Usage:** Minimal Docker image with only essential dependencies

## Best Practices

- Use semantic versioning
- Write clear commit messages
- Document API changes
- Keep dependencies minimal for container size
- Use environment variables for OCR configuration
- Implement proper error handling for OCR failures
- Log performance metrics for optimization
