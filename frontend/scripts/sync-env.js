#!/usr/bin/env node

/**
 * Script to sync REACT_APP_ environment variables from root .env to frontend .env
 * This ensures the frontend has access to all environment variables from the unified root .env
 */

const fs = require('fs');
const path = require('path');

const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');
const frontendEnvPath = path.resolve(__dirname, '..', '.env');

console.log('🔄 Syncing environment variables from root .env to frontend .env...');

// On Vercel (or when root .env is missing), skip sync - CRA uses env vars from the build environment
if (!fs.existsSync(rootEnvPath)) {
  console.log('⚠️ Root .env not found (e.g. Vercel). Using build environment variables only.');
  const fallbackContent = [
    '# Frontend env - no root .env (e.g. Vercel). Set REACT_APP_* in Vercel Project Settings.',
    '# REACT_APP_API_URL=https://your-api.com/api/v1',
    '# REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id',
  ].join('\n') + '\n';
  fs.writeFileSync(frontendEnvPath, fallbackContent, 'utf8');
  console.log('✅ Wrote placeholder frontend .env. Build will use Vercel env vars.');
  process.exit(0);
}

// Read root .env file
const rootEnvContent = fs.readFileSync(rootEnvPath, 'utf8');
const lines = rootEnvContent.split('\n');

// Filter and collect REACT_APP_ variables
const reactAppVars = [];
const otherVars = [];

lines.forEach(line => {
  const trimmed = line.trim();
  
  // Skip comments and empty lines
  if (!trimmed || trimmed.startsWith('#')) {
    // Preserve comments and empty lines
    reactAppVars.push(line);
    return;
  }
  
  // Check if it's a REACT_APP_ variable
  if (trimmed.startsWith('REACT_APP_')) {
    reactAppVars.push(line);
  } else if (trimmed.includes('=')) {
    // Keep other variables for reference (commented out)
    otherVars.push(`# ${line}`);
  } else {
    reactAppVars.push(line);
  }
});

// Create frontend .env content
const frontendEnvContent = [
  '# ============================================',
  '# Frontend Environment Variables',
  '# ============================================',
  '# This file is auto-generated from root .env',
  '# DO NOT EDIT MANUALLY - Edit root .env instead',
  '# ============================================',
  '',
  ...reactAppVars,
  '',
  '# ============================================',
  '# Other variables from root .env (for reference)',
  '# ============================================',
  ...otherVars.slice(0, 5), // Show first 5 as reference
  '',
].join('\n');

// Write to frontend .env
fs.writeFileSync(frontendEnvPath, frontendEnvContent, 'utf8');

console.log('✅ Successfully synced environment variables!');
console.log(`   Root .env: ${rootEnvPath}`);
console.log(`   Frontend .env: ${frontendEnvPath}`);
console.log(`   Synced ${reactAppVars.filter(l => l.trim().startsWith('REACT_APP_')).length} REACT_APP_ variables`);

