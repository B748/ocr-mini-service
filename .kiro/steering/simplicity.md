# Code Simplicity Guidelines

## Core Principle
**Absolute Minimalism:** Every code change must serve a direct, essential purpose. No feature creep, no "nice-to-have" additions.

## Implementation Rules

### Before Adding Any Code
- **Question necessity:** Is this feature absolutely required for the current goal?
- **Seek clarification:** If a feature seems optional, ask the user before implementing
- **Choose simplest solution:** Always pick the most straightforward approach

### Code Change Standards
- **Minimal viable implementation:** Write only what's needed to solve the problem
- **No premature optimization:** Don't add complexity for theoretical future needs
- **No defensive programming:** Don't add error handling for unlikely scenarios unless explicitly requested
- **Single responsibility:** Each change should address exactly one concern

### Feature Addition Process
1. **Identify core requirement:** What exactly needs to be solved?
2. **Propose minimal solution:** Present the simplest approach first
3. **Confirm scope:** Verify with user before adding any non-essential features
4. **Implement minimally:** Write the least code possible to achieve the goal

### What to Avoid
- **Utility functions** unless used multiple times in the same change
- **Configuration options** unless specifically requested
- **Error handling** beyond basic requirements
- **Logging** unless debugging a specific issue
- **Comments** unless the code is genuinely complex
- **Abstractions** unless there's clear duplication

## Examples

**Good:** Add single endpoint that processes image and returns OCR result
**Bad:** Add endpoint + validation middleware + custom error types + logging + configuration options

**Good:** Use existing Tesseract with hardcoded settings
**Bad:** Create configurable OCR engine wrapper with multiple language options

## Decision Framework
When in doubt, ask: "Can this feature be added later without breaking existing functionality?" If yes, don't add it now.