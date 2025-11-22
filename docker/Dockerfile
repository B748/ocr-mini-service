# Multi-stage build for optimal image size
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

# Set environment variables for better ARM64 compatibility
ENV NPM_CONFIG_CACHE=/tmp/.npm
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

# Install all dependencies (including dev dependencies for build)
# Use specific flags for ARM64 compatibility and disable problematic features
RUN --mount=type=cache,target=/tmp/.npm \
    npm ci --no-optional --ignore-scripts

# Copy source code
COPY src/ ./src/

# Build application using NestJS CLI
RUN npx nest build

# Clean up dev dependencies after build to reduce image size
RUN npm prune --production && \
    npm cache clean --force

# Production stage
FROM node:20-alpine AS production

# Install Tesseract, ZXing, and language packs
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-deu \
    tesseract-ocr-data-eng \
    zxing-cpp \
    && rm -rf /var/cache/apk/*

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S tesseract -u 1001 -G nodejs

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=tesseract:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=tesseract:nodejs /app/dist ./dist
COPY --from=builder --chown=tesseract:nodejs /app/package*.json ./

# Copy entrypoint script
COPY --chown=tesseract:nodejs docker/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create temp directory with proper ownership before switching user
RUN mkdir -p /tmp/tesseract-api && \
    chown tesseract:nodejs /tmp/tesseract-api && \
    chmod 775 /tmp/tesseract-api

# Switch to non-root user
USER tesseract

# Expose port
EXPOSE 8600

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8600/ocr/status || exit 1

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start application
CMD ["node", "dist/main.js"]