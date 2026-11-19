// Stateless Streamable HTTP: any instance can answer any request.
import { createServer as createHttpServer } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';

// Tell index.ts not to start stdio. Set before the import, so it also works
// on Windows (no `MCP_HTTP=1 tsx ...` in package.json).
process.env.MCP_HTTP = '1';
const { createServer } = await import('./index.js');

const handler = toNodeHandler(createMcpHandler(() => createServer())); // fresh server per request

const PORT = Number(process.env.PORT ?? 3005);
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

createHttpServer((req, res) => {
  // Only /mcp, and no requests from other web pages (DNS rebinding).
  if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') {
    res.writeHead(404).end();
    return;
  }
  const origin = req.headers.origin;
  if (origin && !LOCAL_ORIGIN.test(origin)) {
    res.writeHead(403).end();
    return;
  }
  return handler(req, res);
  // 127.0.0.1: reachable from this machine only, not from the conference Wi-Fi.
}).listen(PORT, '127.0.0.1', () =>
  console.error(`notes-mcp on http://127.0.0.1:${PORT}/mcp`)
);
