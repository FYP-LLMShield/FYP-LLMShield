#!/usr/bin/env node

/**
 * Sync REACT_APP_ from root .env to frontend/.env for local dev.
 * When root .env is missing (e.g. Vercel), write placeholder and exit 0 so build never fails.
 */

const fs = require('fs');
const path = require('path');

const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');
const frontendEnvPath = path.resolve(__dirname, '..', '.env');

// If no root .env (Vercel, or local without root .env), write placeholder and succeed
if (!fs.existsSync(rootEnvPath)) {
  fs.writeFileSync(
    frontendEnvPath,
    '# No root .env - REACT_APP_* come from Vercel env or create repo root .env for local dev.\n',
    'utf8'
  );
  console.log('sync-env: no root .env, using env from Vercel or shell.');
  process.exit(0);
}

// Root .env exists: sync REACT_APP_ vars into frontend/.env
console.log('Syncing REACT_APP_ from root .env to frontend/.env...');
const rootEnvContent = fs.readFileSync(rootEnvPath, 'utf8');
const lines = rootEnvContent.split('\n');
const reactAppVars = [];
const otherVars = [];

lines.forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    reactAppVars.push(line);
    return;
  }
  if (trimmed.startsWith('REACT_APP_')) {
    reactAppVars.push(line);
  } else if (trimmed.includes('=')) {
    otherVars.push(`# ${line}`);
  } else {
    reactAppVars.push(line);
  }
});

const content = [
  '# Auto-generated from root .env - edit root .env, not this file.',
  '',
  ...reactAppVars,
  '',
  ...otherVars.slice(0, 5),
  '',
].join('\n');

fs.writeFileSync(frontendEnvPath, content, 'utf8');
console.log('Synced', reactAppVars.filter((l) => l.trim().startsWith('REACT_APP_')).length, 'REACT_APP_ vars.');
