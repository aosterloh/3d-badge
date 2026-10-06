# Production Container for Google Badge 3D Customizer
# Compatible with local Docker and Google Cloud Run
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy application files
COPY package*.json ./
COPY server.js ./
COPY index.html ./
COPY styles.css ./
COPY generator.js ./
COPY app.js ./
COPY test_generator.js ./
COPY libs/ ./libs/
COPY images/ ./images/
COPY assets/ ./assets/

# Expose standard Cloud Run port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/healthz || exit 1

# Start the server
CMD ["node", "server.js"]
