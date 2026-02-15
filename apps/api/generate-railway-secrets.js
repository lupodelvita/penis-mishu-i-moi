#!/usr/bin/env node

/**
 * Generate secure secrets for Railway deployment
 * Run: node generate-railway-secrets.js
 */

const crypto = require('crypto');

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

console.log('');
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║     Railway Environment Variables Generator           ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log('');
console.log('Copy these to Railway Dashboard → Variables:');
console.log('');
console.log('# Core Secrets (REQUIRED)');
console.log(`JWT_SECRET=${generateSecret(32)}`);
console.log(`SESSION_SECRET=${generateSecret(32)}`);
console.log(`MASTER_KEY=${generateSecret(32)}`);
console.log('');
console.log('# Server Config (REQUIRED)');
console.log('PORT=4000');
console.log('NODE_ENV=production');
console.log('');
console.log('# Database (REQUIRED - use existing Neon or Railway PostgreSQL)');
console.log('DATABASE_URL=postgresql://user:pass@host:5432/nodeweaver?sslmode=require');
console.log('');
console.log('# Optional OSINT API Keys (add if you have them)');
console.log('# SHODAN_API_KEY=your_key_here');
console.log('# VIRUSTOTAL_API_KEY=your_key_here');
console.log('# HUNTER_API_KEY=your_key_here');
console.log('# HIBP_API_KEY=your_key_here');
console.log('# SECURITYTRAILS_API_KEY=your_key_here');
console.log('');
console.log('✅ Done! Paste these into Railway Variables');
console.log('');
