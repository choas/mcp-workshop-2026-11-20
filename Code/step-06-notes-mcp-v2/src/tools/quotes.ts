// Quote tool for MCP server
import type { CallToolResult, Tool } from "@modelcontextprotocol/server";

import { getRandomQuote } from '../external-apis.js';

// Tool definition for quotes
export const quoteToolDefinition: Tool = {
  name: "get_quote",
  description: "Get a random inspirational quote",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

// Tool handler for quotes
export async function handleGetQuote(): Promise<CallToolResult> {
  try {
    const quote = await getRandomQuote();
    const text = `"${quote.content}"\n\n— ${quote.author}`;
    return {
      content: [{ type: "text", text }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: "text", text: `API error: ${message}` }],
      isError: true
    };
  }
}
