#!/usr/bin/env node

/**
 * Script to sync REACT_APP_ environment variables from root .env to frontend .env
 * On Vercel (no root .env), writes a placeholder and exits 0 so build continues.
 */

const fs = require('fs');
const path = require('path');

// On Vercel, Root Directory is "frontend" so there is no repo root .env - never fail
if (process.env.VERCEL === '1') {
  const frontendEnvPath = path.resolve(__dirname, '..', '.env');
  const fallbackContent = [
    '# Vercel build - REACT_APP_* are set in Project Settings → Environment Variables',
  ].join('\n') + '\n';
  fs.writeFileSync(frontendEnvPath, fallbackContent, 'utf8');
  console.log('✅ Vercel build: using env vars from Project Settings.');
  process.exit(0);
}

const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');
const frontendEnvPath = path.resolve(__dirname, '..', '.env');

console.log('🔄 Syncing environment variables from root .env to frontend .env...');

if (!fs.existsSync(rootEnvPath)) {
  console.log('⚠️ Root .env not found. Using build environment variables only.');
  const fallbackContent = [
    '# No root .env - set REACT_APP_* in Vercel Project Settings or create root .env for local dev.',
  ].join('\n') + '\n';
  fs.writeFileSync(frontendEnvPath, fallbackContent, 'utf8');
  console.log('✅ Wrote placeholder frontend .env.');
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

