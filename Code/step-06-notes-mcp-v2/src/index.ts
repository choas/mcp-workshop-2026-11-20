// MCP Server entry point (SDK v2, serves 2025-era and 2026-07-28 clients)
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { Server } from '@modelcontextprotocol/server';
import { initDatabase } from './database.js';
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

const db = initDatabase();

// Factory: the SDK builds one server per connection (stdio) or per request (HTTP).
function createServer(): Server {
  const server = new Server(
    { name: 'personal-knowledge-assistant', version: '2.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
  registerTools(server, db);
  registerResources(server, db);
  registerPrompts(server, db);
  return server;
}

export { createServer };
if (!process.env.MCP_HTTP) await serveStdio(() => createServer());
