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

# INSTALL ALL DEPENDENCIES (INCLUDING DEV DEPENDENCIES FOR BUILD)
# USE SPECIFIC FLAGS FOR ARM64 COMPATIBILITY AND DISABLE PROBLEMATIC FEATURES
RUN --mount=type=cache,target=/tmp/.npm \
    npm ci --no-optional --ignore-scripts

# COPY SOURCE CODE
COPY src/ ./src/

# BUILD APPLICATION USING NESTJS CLI
RUN npx nest build

# CLEAN UP DEV DEPENDENCIES AFTER BUILD TO REDUCE IMAGE SIZE
RUN npm prune --production && \
    npm cache clean --force

# PRODUCTION STAGE
FROM node:20-alpine AS production

# INSTALL TESSERACT AND LANGUAGE PACKS
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-deu \
    tesseract-ocr-data-eng \
    && rm -rf /var/cache/apk/*

# CREATE APP USER FOR SECURITY
RUN addgroup -g 1001 -S nodejs && \
    adduser -S tesseract -u 1001 -G nodejs

WORKDIR /app

# COPY BUILT APPLICATION AND DEPENDENCIES
COPY --from=builder --chown=tesseract:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=tesseract:nodejs /app/dist ./dist
COPY --from=builder --chown=tesseract:nodejs /app/package*.json ./

# COPY ENTRYPOINT SCRIPT
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