FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Run headless
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Default command
ENTRYPOINT ["node", "src/scripts/tldr.js"]
