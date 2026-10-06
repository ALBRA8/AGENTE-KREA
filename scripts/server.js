#!/usr/bin/env node
// Custom server to keep Next.js alive for preview
const { createServer } = require('http');
const next = require('next');

const app = next({ dev: false, port: 3000 });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });
  
  server.on('error', (err) => {
    console.error('Server error:', err);
  });
  
  server.setTimeout(120000); // 2 min timeout
  
  server.listen(3000, '0.0.0.0', () => {
    console.log('> Krea ready on http://0.0.0.0:3000');
  });
  
  // Keep process alive
  process.on('SIGTERM', () => { console.log('SIGTERM received, keeping alive'); });
  process.on('SIGINT', () => { console.log('SIGINT received, keeping alive'); });
});
