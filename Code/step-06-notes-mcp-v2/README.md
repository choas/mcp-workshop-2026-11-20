# Step 06: Notes MCP on SDK v2 (spec 2026-07-28)

The Notes server from `step-02-notes-mcp/complete`, migrated to the TypeScript
SDK v2 (`@modelcontextprotocol/server` 2.4.0). Solution for Block 7.

## Run

```bash
npm install
npm run test:client   # stdio: one server, three clients (auto, pinned 2026-07-28, legacy)
npm run http          # stateless Streamable HTTP on http://localhost:3005/mcp
npm run test:http     # in a second terminal
```

Expected `test:client` output: `era= modern` for the `auto` and pinned clients,
`era= legacy` for the default client. Notes go into the same database as
step 01 (`step-01-notes-app/data/notes.db`).

## How it was migrated

1. `npx @modelcontextprotocol/codemod@latest v1-to-v2 .` (22 changes in 9 files)
2. `zod` 3.25.76 → 4.6.7 (v2 needs >= 4.2.0)
3. Type annotations the codemod does not add: `Tool[]`, `CallToolResult`,
   `PromptMessage` (v2 handlers need literal types like `type: "text"`)
4. `src/index.ts`: a `createServer()` factory + `serveStdio(...)`, so the
   server answers both 2025-era and 2026-07-28 clients
5. `src/http.ts`: `createMcpHandler(() => createServer())` for stateless HTTP

Compare with `git diff --no-index ../step-02-notes-mcp/complete/src src`.
