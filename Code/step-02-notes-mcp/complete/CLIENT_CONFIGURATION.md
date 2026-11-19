# MCP Client Configuration Guide

This guide explains how to configure Claude Desktop to connect to the Personal Knowledge Assistant MCP server.

## Prerequisites

Before configuring clients, ensure the MCP server is working:

```bash
cd Code/step-02-notes-mcp/complete
npm install
npm run build
```

Test with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

## Claude Desktop Configuration

### Configuration File Location

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

### Configuration Format

The easiest way: let the script print the entry with your absolute paths
(after `npm install`):

```bash
./get_mcp_configuration.sh --add-mcpServer      # macOS / Linux
./get_mcp_configuration.ps1 --add-mcpServer     # Windows (PowerShell)
```

Or create or edit the configuration file by hand. Point it at the build output
(`npm run build` first):

```json
{
  "mcpServers": {
    "notes-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/Code/step-02-notes-mcp/complete/dist/index.js"]
    }
  }
}
```

### Example (macOS)

```json
{
  "mcpServers": {
    "notes-mcp": {
      "command": "node",
      "args": ["/Users/username/projects/Code/step-02-notes-mcp/complete/dist/index.js"]
    }
  }
}
```

### Running the TypeScript source directly

To skip the build step, load tsx as an import hook. The client starts the
server from its own folder (`/` or `~`), so a bare `--import tsx` fails with
`Cannot find package 'tsx'`. Point `--import` at this project's tsx loader:

```json
{
  "mcpServers": {
    "notes-mcp": {
      "command": "node",
      "args": [
        "--import",
        "file:///absolute/path/to/Code/step-02-notes-mcp/complete/node_modules/tsx/dist/loader.mjs",
        "/absolute/path/to/Code/step-02-notes-mcp/complete/src/index.ts"
      ]
    }
  }
}
```

### After Configuration

1. Save the configuration file
2. Restart Claude Desktop completely (quit and reopen)
3. Look for the MCP server icon in the Claude interface
4. The tools, resources, and prompts should now be available

## Available Features

Once configured, the following MCP primitives are available:

### Tools

| Tool | Description | Required Arguments |
|------|-------------|-------------------|
| `add_note` | Create a new note with optional tags | `content` (string) |
| `search_notes` | Search notes by keyword | `query` (string) |
| `list_notes` | List recent notes | `limit` (optional number) |
| `delete_note` | Delete a note by ID | `id` (number) |
| `get_quote` | Get a random inspirational quote | none |

### Resources

| URI | Description |
|-----|-------------|
| `notes://recent` | The 5 most recent notes |
| `notes://all` | All notes in the database |
| `notes://tags/{tag}` | Notes filtered by a specific tag |
| `notes://search/{query}` | Search notes by keyword |
| `quotes://random` | A random inspirational quote |

### Prompts

| Prompt | Description | Arguments |
|--------|-------------|-----------|
| `daily_summary` | Generate a daily summary with notes and a quote | none |
| `brainstorm_ideas` | Start a brainstorming session on a topic | `topic` (required) |
| `organize_notes` | Analyze notes and suggest better organization | `tag` (optional) |

## Troubleshooting

### Server not connecting

1. Verify the absolute paths in the config are correct (`get_mcp_configuration.sh` prints them)
2. Ensure `npm install` was run in the project directory
3. Check that Node.js and npm are in your PATH
4. Try running the server manually: `npx tsx src/index.ts`

### `Cannot find package 'tsx'`

The config uses a bare `--import tsx`. Use the full `file://.../node_modules/tsx/dist/loader.mjs`
path as shown above, or the built `dist/index.js`.

### Database errors

All steps share one SQLite database: `Code/step-01-notes-app/data/notes.db`. If you encounter database issues:

1. Delete `Code/step-01-notes-app/data/notes.db`
2. Restart the MCP server (it will recreate the database)
3. Run `npm run seed` to populate sample data

### Checking server logs

For debugging, you can run the server with the MCP Inspector:

```bash
cd Code/step-02-notes-mcp/complete
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

This opens a web interface where you can test tools, resources, and prompts manually.
