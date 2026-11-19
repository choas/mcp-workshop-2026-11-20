// Resource registration for MCP server
import type { Server } from "@modelcontextprotocol/server";
import type { DatabaseSync } from 'node:sqlite';
import { noteResources, noteResourceTemplates, readNoteResource } from './notes.js';
import { quoteResources, readQuoteResource } from './quotes.js';

// Combine all static resources
const allResources = [
  ...noteResources,
  ...quoteResources,
];

// Combine all resource templates
const allResourceTemplates = [
  ...noteResourceTemplates,
];

export function registerResources(server: Server, db: DatabaseSync): void {
  // Handle resources/list request - returns static resources
  server.setRequestHandler('resources/list', async () => {
    return { resources: allResources };
  });

  // Handle resources/templates/list request - returns resource templates
  server.setRequestHandler('resources/templates/list', async () => {
    return { resourceTemplates: allResourceTemplates };
  });

  // Handle resources/read request
  server.setRequestHandler('resources/read', async (request) => {
    const { uri } = request.params;

    // Route to appropriate handler based on URI scheme
    if (uri.startsWith('notes://')) {
      return readNoteResource(db, uri);
    }

    if (uri.startsWith('quotes://')) {
      return await readQuoteResource(uri);
    }

    throw new Error(`Unknown resource URI scheme: ${uri}`);
  });
}
