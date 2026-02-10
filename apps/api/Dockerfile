FROM node:22-alpine

# Install OSINT system dependencies
RUN apk add --no-cache \
    nmap \
    nmap-scripts \
    whois \
    bind-tools \
    curl \
    git

WORKDIR /app


# Copy all source files (.dockerignore will exclude unwanted files)
COPY . .

# Install dependencies (including devDependencies for build)
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
