// LayoutOS Dev Server — node server.js
// Serves C:\VORA_IX\layoutos on localhost:3000
// Opens shed-quote.html in browser on start

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // Strip query string and decode
  const rawPath = req.url.split('?')[0];
  const decoded = decodeURIComponent(rawPath);
  const target  = decoded === '/' ? '/apps/shed/shed-quote.html' : decoded;
  const filePath = path.join(ROOT, target);

  // Prevent directory traversal outside ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not found: ${target}`);
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log('');
  console.log('  LayoutOS Dev Server');
  console.log('  ──────────────────────────────');
  console.log(`  Running → ${url}`);
  console.log(`  Root    → ${ROOT}`);
  console.log('  Ctrl+C to stop');
  console.log('');
  exec(`start ${url}/apps/shed/shed-quote.html`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} already in use. Kill the process or change PORT in server.js.\n`);
  } else {
    console.error('\n  Server error:', err.message, '\n');
  }
  process.exit(1);
});
