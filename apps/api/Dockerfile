FROM node:22-bullseye-slim

# Install OSINT system dependencies and OpenSSL for Prisma
RUN apt-get update && apt-get install -y \
    nmap \
    whois \
    dnsutils \
    curl \
    git \
    openssl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all source files
COPY . .

# Install dependencies
RUN npm install

# Build TypeScript
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD curl -f http://localhost:4000/health || exit 1

# Run migrations and start server
CMD npx prisma migrate deploy && npm start
