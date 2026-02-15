FROM node:20-bullseye

# Install OSINT tools and dependencies
RUN apt-get update && apt-get install -y \
    nmap \
    whois \
    dnsutils \
    curl \
    git \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 4000

# Start application
CMD npx prisma migrate deploy && npm start
