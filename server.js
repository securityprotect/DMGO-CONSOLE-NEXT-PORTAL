/*
 * DMGO Console — local dev server (ZERO dependencies, Node built-ins only).
 *
 * What it does:
 *   1. Serves the static deskapp files (so you can open the console in a browser).
 *   2. Proxies any request whose path starts with /api to the backend, so the
 *      browser talks to the backend SAME-ORIGIN (no CORS in the browser).
 *
 * Usage:
 *   PORT=4040 BACKEND_URL=http://localhost:4030 node server.js
 *
 * Notes:
 *   - In PRODUCTION this file is NOT used. nginx serves the static files and
 *     proxies /api to the backend (see CONSOLE-SETUP.md). That keeps the console
 *     on console.dmgo.in, so the .dmgo.in auth cookie is valid.
 *   - A plain localhost origin cannot receive the .dmgo.in auth cookie, so real
 *     login only works against a backend that allows the origin (a local dev
 *     backend, or on the VPS). Use ?preview=1 for local UI work.
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || '4040', 10);
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:4030').replace(/\/+$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

// ---- /api proxy ----------------------------------------------------------
function proxy(req, res) {
  const target = BACKEND_URL + req.url;
  const isHttps = target.startsWith('https://');
  const lib = isHttps ? https : http;

  const options = {
    method: req.method,
    headers: Object.assign({}, req.headers, { host: new URL(BACKEND_URL).host }),
  };

  const p = lib.request(target, options, (upstream) => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });

  p.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Backend unreachable: ' + err.message, backend: BACKEND_URL }));
  });

  req.pipe(p);
}

// ---- static file serve ---------------------------------------------------
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' ) urlPath = '/login.html';

  // prevent path traversal
  const safePath = path.normalize(path.join(ROOT, urlPath));
  if (!safePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(safePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA-ish fallback: unknown non-file -> 404 page (keep simple)
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404</h1><p>Not found. <a href="login.html">Sign in</a></p>');
      return;
    }
    const ext = path.extname(safePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(safePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0].startsWith('/api')) return proxy(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log('DMGO Console dev server:  http://localhost:' + PORT);
  console.log('Proxying /api  ->  ' + BACKEND_URL);
  console.log('Preview UI without auth:  http://localhost:' + PORT + '/console.html?preview=1');
});
