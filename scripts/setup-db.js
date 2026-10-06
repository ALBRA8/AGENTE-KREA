#!/usr/bin/env node
// Ensure database exists before starting the app
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'db', 'custom.db');
const dbDir = path.dirname(dbPath);

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Generate Prisma client if needed
try {
  execSync('npx prisma generate', { stdio: 'pipe' });
  console.log('✓ Prisma client generated');
} catch (e) {
  console.log('⚠ Prisma generate failed, continuing anyway');
}

// Push schema to database if db doesn't exist
if (!fs.existsSync(dbPath)) {
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'pipe' });
    console.log('✓ Database schema pushed');
  } catch (e) {
    console.log('⚠ Prisma db push failed, continuing anyway');
  }
} else {
  console.log('✓ Database exists at', dbPath);
}

console.log('✓ Setup complete');
