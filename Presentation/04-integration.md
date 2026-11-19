# Block 4: Integration

---

## What We Built

- **Notes MCP Server** (tools, resources, prompts)
- **Weather + Geocoding MCP Servers** (external API wrappers)

Now: **Connect to LLM clients!**

---

## MCP Client Options

| Client | Description |
|--------|-------------|
| Claude Desktop | Anthropic's desktop app |
| Cline (VS Code) | VS Code extension |
| Gemini CLI | Google's CLI tool |
| Custom | Build your own! (see appendix) |

> **Want to build the client side too?** The optional
> [Build Your Own MCP Client](appendix-mcp-client.md) appendix walks through it
> and makes the protocol concrete.

---

## Configuration Pattern

Build once (`npm run build`), then point the client at the compiled output:

```json
{
  "mcpServers": {
    "notes-mcp": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

Running `node dist/index.js` starts faster and more reliably than spawning `npx tsx` on every launch.

---

## How It Works

1. Client spawns server process
2. Connects via stdio
3. Discovers capabilities (tools, resources, prompts)
4. Makes them available to LLM

---

## "Available to LLM" - How?

The LLM never talks to your server directly.

The host puts the discovered tools into the **`tools` property** of
every request it sends to the model.

```mermaid
flowchart LR
  S["MCP Server<br/>tools/list"] --> H["Host"]
  H -- "tools: [...]" --> LLM["LLM"]
```

The model sees a menu of tools - and picks from it.

---

## The `tools` Property

Each request to the model carries the tool definitions:

```json
{
  "model": "claude-opus-5-5",
  "messages": [{ "role": "user", "content": "What's the weather in Munich?" }],
  "tools": [
    {
      "name": "get_forecast",
      "description": "Get the weather forecast for a location",
      "input_schema": {
        "type": "object",
        "properties": {
          "latitude": { "type": "number" },
          "longitude": { "type": "number" }
        },
        "required": ["latitude", "longitude"]
      }
    }
  ]
}
```

---

## What the Model Does With It

- **`name`**: the model returns this to say *which* tool to run
- **`description`**: the model reads this to decide *when* to use it
- **`input_schema`**: constrains the *arguments* the model generates

> Same three fields you defined on the MCP server - the host just
> forwards them. Good descriptions = good tool choices.

---

## MCP → LLM: Same Fields, Different Names

The host translates each MCP tool into the model's tool format:

| MCP (`tools/list`) | Claude API (`tools`) |
|--------------------|----------------------|
| `name` | `name` |
| `description` | `description` |
| `inputSchema` | `input_schema` |

The host owns this mapping - you just define the tool **once**.

---

## The Round Trip

```mermaid
sequenceDiagram
  participant LLM
  box rgb(200, 230, 232)
    participant H as Host
  end
  participant S as MCP Server
  H->>LLM: messages + tools: [...]
  LLM-->>H: tool_use: get_forecast(48.14, 11.58)
  H->>S: tools/call
  S-->>H: 11°C, overcast
  H->>LLM: tool_result: "11°C, overcast"
  LLM-->>H: "It's 11°C and overcast in Munich"
```

`tools` advertises; `tool_use` selects; `tools/call` executes.

---

## Claude Desktop Config

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

---

## Claude Desktop Example

```json
{
  "mcpServers": {
    "notes-mcp": {
      "command": "node",
      "args": ["/full/path/to/Code/step-02-notes-mcp/complete/dist/index.js"]
    },
    "weather-mcp": {
      "command": "node",
      "args": ["/full/path/to/Code/step-03-weather-mcp/phase-1-weather/dist/index.js"]
    },
    "geocoding-mcp": {
      "command": "node",
      "args": ["/full/path/to/Code/step-03-weather-mcp/phase-2-geocoding/dist/index.js"]
    }
  }
}
```

Run `npm run build` in each server folder first, then restart Claude Desktop after changes!

---

## Add a Server from the CLI

In `Code/step-02-notes-mcp/complete`, after `npm run build`:

```bash
claude mcp add -s user notes -- node $PWD/dist/index.js   # Claude Code
codex mcp add notes -- node $PWD/dist/index.js            # Codex
gemini mcp add -s user notes node $PWD/dist/index.js      # Gemini CLI
# VS Code
code --add-mcp '{"name":"notes","command":"node","args":["'$PWD'/dist/index.js"]}'
```

**VS Code** also: **MCP: Add Server** in the Command Palette.
In `.vscode/mcp.json` the key is `servers`, not `mcpServers`.

---

## Live Demo

### Natural Language Interaction

1. "What's the weather in Munich?"
2. "Add a note about the workshop"
3. "Show me my recent notes"
4. "Summarize my notes"

---

## What Just Happened?

```mermaid
sequenceDiagram
  participant U as User
  participant L as LLM Client
  participant G as geocoding-mcp
  participant W as weather-mcp
  U->>L: "What's the weather in Munich?"
  L->>G: search_location("Munich")
  G-->>L: 48.14, 11.58
  L->>W: get_forecast(48.14, 11.58)
  W-->>L: 11°C, overcast
  L-->>U: "11°C, overcast"
```

LLM chose the right tools - across **two** servers - automatically!

---

## External MCP Servers

### Community Servers

Browse: https://github.com/modelcontextprotocol/servers

Examples:
- **Filesystem** - Read/write files
- ~~**GitHub** - Issues, PRs, repos~~ (archived)
- ~~**Slack** - Send messages~~ (archived)
- ~~**PostgreSQL** - Database queries~~ (archived)

https://try-mcp.dev

---

## Try an External Server

### Filesystem MCP

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allow"]
    }
  }
}
```

---

## Explore More Servers

**Your choice!** Pick an official reference server to explore:

- **Filesystem** - Read/write files with access controls
- **Git** - Read, search & manipulate repos
- **Memory** - Knowledge-graph persistent memory
- **Fetch** - Pull & convert web content

Browse them all → [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)

---

## Multi-Server Setup

```json
{
  "mcpServers": {
    "notes": { "command": "..." },
    "weather": { "command": "..." },
    "geocoding": { "command": "..." },
    "filesystem": { "command": "..." }
  }
}
```

LLM can use tools from **all** servers!

---

## Production Considerations

### Before you ship

- **Validation** - Never trust LLM arguments (next slide)
- **Logging** - Observe what your tools actually do
- **Security** - The real threats get their own block → **Block 6**
- **Tool design, cost, auth, gateways** → **Block 8**

---

## Production: Validation

```typescript
if (typeof args.id !== 'number' || args.id < 0) {
  return {
    content: [{ type: 'text', text: 'Invalid note ID' }],
    isError: true
  };
}
```

---

## Production: Logging

```typescript
console.error('Tool called:', {
  tool: name,
  args,
  timestamp: new Date().toISOString()
});
```

Use stderr (stdout is for MCP protocol).

---

## Advanced: Remote Servers

For remote deployment use **Streamable HTTP** (one `/mcp` endpoint).

- The old **HTTP+SSE** transport is deprecated (spec 2026-07-28) and
  **removed** in SDK v2 - don't start new servers on it
- Spec 2026-07-28 makes remote MCP **stateless**: no sessions, any instance
  answers any request

We build a stateless HTTP server in **Block 7**, and look at auth and
gateways in **Block 8**.

---

## What We Covered

1. **MCP Protocol** - The USB-C for AI
2. **Tools** - Actions LLMs can call
3. **Resources** - Read-only data access
4. **Prompts** - Reusable templates
5. **Integration** - Connecting to clients

Now: put these tools in a loop → **Agents**

---

## Key Takeaways

1. **MCP standardizes AI integrations**

2. **Build incrementally** - Scaffold → Tools → Resources → Prompts

3. **MCP Inspector** - Test without LLM

---

## More Takeaways

4. **Same protocol, different sources** - Database or API

5. **Multi-server** - LLMs can use many servers at once

6. **Production needs security** - Always validate!

---

## Your Materials

```
Code/
├── step-01-notes-app/    # REST API + WebUI
├── step-02-notes-mcp/    # MCP Server (4 phases)
├── step-03-weather-mcp/  # External API wrappers
├── step-05-mcp-client/   # Own client + tiny agent (appendix)
├── step-06-notes-mcp-v2/ # Notes server on SDK v2 (Block 7)
└── step-07-webmcp-agent/ # WebMCP page + own agent (Block 8)
```

---

## Keep Building!

Ideas for your own MCP servers:

- **Calendar** - Events and reminders
- **Email** - Inbox management
- **Git** - Repository operations
- **Database** - Custom queries
- **API wrapper** - Any service!

---

## Resources

- **MCP Spec**: https://modelcontextprotocol.io/specification
- **SDK Docs**: https://modelcontextprotocol.io/docs
- **Reference servers**: https://github.com/modelcontextprotocol/servers
- **Awesome MCP servers**: https://github.com/wong2/awesome-mcp-servers
- https://try-mcp.dev

---

## From plumbing to autonomy

You can build MCP servers. You can connect them to a client.

So far the LLM takes **one step at a time**. Next we close the loop:
let the model call these tools repeatedly, on its own, until the goal
is met - that's an **agent**.

*Next: [Block 5 - AI Agents: From Tools to Autonomy](05-agents.md)*
