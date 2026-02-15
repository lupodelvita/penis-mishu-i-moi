FROM node:22-bullseye-slim

# Install OSINT system dependencies, OpenSSL for Prisma, and Python for node-gyp
RUN apt-get update && apt-get install -y \
    nmap \
    whois \
    dnsutils \
    curl \
    git \
    openssl \
    libssl-dev \
    python3 \
    make \
    g++ \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code and Prisma schema
COPY src ./src
COPY prisma ./prisma
COPY tsconfig.json ./

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript (only API, not monorepo)
RUN npx tsc --project ./tsconfig.json

# Remove devDependencies after build
RUN npm prune --production

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD curl -f http://localhost:4000/health || exit 1

# Run migrations and start server
CMD npx prisma migrate deploy && npm start
