# Code Style Guidelines

## Documentation Requirements

### JSDoc Standards
- **Every function must have JSDoc documentation** adapted to TypeScript requirements
- Include parameter types, return types, and clear descriptions
- Use `@param` for parameters, `@returns` for return values
- Add `@throws` for potential exceptions when relevant

**Example:**
```typescript
/**
 * Processes an image file and extracts OCR data
 * @param imageBuffer - The image data as a Buffer
 * @param language - OCR language code (e.g., 'eng', 'ger')
 * @returns Promise resolving to structured OCR result data
 * @throws {Error} When image format is unsupported
 */
async function processImage(imageBuffer: Buffer, language: string): Promise<OCRResult> {
  // IMPLEMENTATION HERE
}
```

## Comment Standards

### Code Comments
- **All code comments must be UPPERCASE** (applies to `//` and `/* */` comments)
- **Exception:** Code parts in backticks remain lowercase
- **JSDoc comments are exempt** from this rule

**Examples:**
```typescript
// INITIALIZE OCR ENGINE WITH DEFAULT SETTINGS
const ocrEngine = new TesseractEngine();

/* 
 * PROCESS IMAGE IN CHUNKS TO MANAGE MEMORY USAGE
 * Uses `processChunk()` method for optimal performance
 */
const chunks = splitImageIntoChunks(imageBuffer);
```

### JSDoc Comments
- Use standard casing in JSDoc blocks
- Follow TypeScript documentation conventions
- Keep descriptions clear and concise

## Application Scope
- **Applies to:** All TypeScript/JavaScript files in the project
- **Enforced in:** src/ directory and all subdirectories
- **Tools:** Prettier for formatting, manual review for JSDoc completeness