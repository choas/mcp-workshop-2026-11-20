// Tool registration for MCP server
import type { Server } from "@modelcontextprotocol/server";
import type { DatabaseSync } from 'node:sqlite';
import {
  noteToolDefinitions,
  handleAddNote,
  handleSearchNotes,
  handleListNotes,
  handleDeleteNote,
} from './notes.js';

import { quoteToolDefinition, handleGetQuote } from './quotes.js';

// Combine all tool definitions
const allTools = [
  ...noteToolDefinitions,
  quoteToolDefinition,
];

export function registerTools(server: Server, db: DatabaseSync): void {
  // Handle tools/list request
  server.setRequestHandler('tools/list', async () => {
    return { tools: allTools };
  });

  // Handle tools/call request
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args = {} } = request.params;

    switch (name) {
      case 'add_note':
        return handleAddNote(db, args as { content?: string; tags?: string[] });

      case 'search_notes':
        return handleSearchNotes(db, args as { query?: string });

      case 'list_notes':
        return handleListNotes(db, args as { limit?: number });

      case 'delete_note':
        return handleDeleteNote(db, args as { id?: number });

      case 'get_quote':
        return await handleGetQuote();

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });
}
