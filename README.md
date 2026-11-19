# Build Your Own MCP Server and Develop AI Agents from Scratch

**VibeKode Berlin 2026 Workshop**
**Friday, November 20, 2026**

Welcome! In this full-day hands-on workshop, you'll learn how to develop MCP (Model Context Protocol) servers and use them to build powerful AI agents.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/choas/mcp-workshop-2026-11-20.git
cd mcp-workshop-2026-11-20/Code

# 2. Start the Notes App (Step 01)
cd step-01-notes-app
npm install
npm run dev

# 3. Open in browser
open http://localhost:3001
```

## Workshop Structure

| Folder | Description |
|--------|-------------|
| `Code/step-01-notes-app/` | Notes REST API + WebUI (pre-built, trainer explains) |
| `Code/step-02-notes-mcp/` | Notes MCP server (build incrementally) |
| `Code/step-03-weather-mcp/` | Weather + geocoding MCP servers the LLM composes |
| `Code/step-05-mcp-client/` | Own MCP client + tiny agent (appendix) |
| `Code/step-06-notes-mcp-v2/` | Notes server migrated to SDK v2 / spec 2026-07-28, stdio + stateless HTTP |
| `Code/step-07-webmcp-agent/` | Notes app as a WebMCP page + its own agent for LM Studio, Ollama or OpenAI |

### Step 02 Incremental Phases

```
step-02-notes-mcp/
├── phase-1-scaffold/    # Empty MCP server
├── phase-2-tools/       # Add CRUD tools
├── phase-3-resources/   # Add resources
├── phase-4-prompts/     # Add prompts
└── complete/            # Full implementation
```

### Step 03 Phases

```
step-03-weather-mcp/
├── phase-1-weather/     # weather-mcp (Open-Meteo, needs coordinates)
└── phase-2-geocoding/   # geocoding-mcp (Nominatim, place name -> coordinates)
```

## Workshop Flow

1. **Opening Demo** - See all MCP servers in action
2. **Step 01** - Explore the Notes App (API + WebUI)
3. **Step 02** - Build MCP server incrementally (tools -> resources -> prompts)
4. **Step 03** - Wrap external APIs with MCP and compose two servers (weather + geocoding)
5. **Integration** - Connect servers to LLM clients + explore community MCP servers
6. **Agents** - Put the tools in a loop to build an autonomous agent
7. **Security** - Defend the agent (lethal trifecta, human-in-the-loop) before shipping
8. **MCP v2** - What spec 2026-07-28 changed and why; migrate the Notes server to SDK v2
9. **Production** - Tool design, context cost, auth, gateways, evals; capstone on a real use case

### What changed since the June 2026 run

- New Block 7 (MCP v2) and Block 8 (production patterns + capstone) raise the level in the afternoon
- "Two speeds": experienced participants can fast-track Blocks 2-3
- [use-cases.md](use-cases.md): MCP use cases with risk notes, input for the capstone
- SSE transport replaced by Streamable HTTP; model IDs updated

## Prerequisites

- Node.js 22+ and npm 10+ (Node 22 is required for the built-in `node:sqlite` module)
- Access to an LLM with tool calling (Claude, GPT, Gemini, or a local model) and an
  MCP host (Claude Desktop, VS Code, ...). Bring your own; there is no shared gateway
- Git
- Code editor (VS Code recommended)
- Curiosity!

## Useful Commands

### MCP Inspector (test without LLM)

```bash
cd Code/step-02-notes-mcp/phase-2-tools
npm install
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

### Reset Database

All steps share the database of the Notes App:

```bash
cd Code/step-01-notes-app
rm data/notes.db
npm run dev  # Recreates automatically
```

## Optional Add-Ons

- [Build Your Own MCP Client](Presentation/appendix-mcp-client.md) — build the *other* half of
  the protocol; the clearest way to see how MCP works on the wire
- [Extension Challenges](EXTENSION_CHALLENGES.md) — bonus exercises if you finish early
- [Use Cases](use-cases.md) — what to build with MCP, and what to watch out for
- [MCP v2 Clients](mcp-v2-clients.md) — which hosts and SDKs speak spec 2026-07-28

## Resources

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [Spec 2026-07-28 release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [TypeScript SDK v2 docs and migration](https://ts.sdk.modelcontextprotocol.io/v2/)
- [VibeKode Conference](https://vibekode.it)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Reference MCP Servers](https://github.com/modelcontextprotocol/servers)
- [Awesome MCP Servers](https://github.com/wong2/awesome-mcp-servers)
- [Try MCP in your browser](https://try-mcp.dev)

## Trainer

**Lars Gregori**
Senior AI Engineer, appliedAI Initiative GmbH

- Blog: [larsgregori.de](https://larsgregori.de)
- LinkedIn: [/in/larsgregori](https://linkedin.com/in/larsgregori)

---

*Happy Vibe Coding!*
