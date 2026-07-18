import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const LXRN = {
  name: 'Luxarion Server',
  version: '1.0.0',
  author: 'LXRN Dev Team',
  description: 'Native Node.js HTTP Server'
};

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain'
};

const server = createServer(async (req, res) => {
  const lxrnHeader = `LXRN/${LXRN.version}`;
  res.setHeader('X-Powered-By', lxrnHeader);
  res.setHeader('Server', LXRN.name);

  try {
    let path = req.url === '/' ? '/index.html' : req.url;
    const ext = extname(path);
    const filePath = join(__dirname, 'public', path);

    if (path === '/api/lxrn') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        server: LXRN,
        timestamp: new Date().toISOString(),
        message: `Welcome to ${LXRN.name} v${LXRN.version}`
      }));
      return;
    }

    if (path === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        lxrn: LXRN
      }));
      return;
    }

    const file = await readFile(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(file);

  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>404 - LXRN Not Found</h1><p>The requested resource does not exist on ${LXRN.name}</p></body></html>`);
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        lxrn: LXRN.name
      }));
    }
  }
});

const PORT = process.env.LXRN_PORT || 3000;
const HOST = process.env.LXRN_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`${LXRN.name} v${LXRN.version} is running`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://<your-ip>:${PORT}`);
  console.log(`API Test: http://localhost:${PORT}/api/lxrn`);
  console.log(`Status: http://localhost:${PORT}/api/status`);
  console.log(`LXRN Ready - ${new Date().toISOString()}`);
});
