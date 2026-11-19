# MCP v2 Clients: Who Speaks 2026-07-28?

Status as of **2026-11-12**. This changes every week: check your client's release
notes before the workshop.

**Status values**

- **Default**: negotiates 2026-07-28 out of the box
- **Opt-in**: supports it, but you have to switch it on
- **Legacy**: only the 2025 handshake; still works with our servers, because
  `serveStdio` / `createMcpHandler` answer both eras
- **No evidence**: nothing found in release notes or docs

**How this was checked:** marked ✔ = we ran it ourselves; otherwise from release
notes, changelogs, issues, or by reading the installed package code.

## Hosts (apps you chat or code in)

| Client | Status | Since | Note |
|---|---|---|---|
| **Claude Code** | Default | 2.1.274 (remote HTTP), 2.1.292 (local stdio) | ✔ changelog; ✔ run 2026-11-12: 2.1.322 against step-06 stdio sends `server/discover` with 2026-07-28, no `initialize`. Opt out: `MCP_PROTOCOL_NEGOTIATION=legacy`. Use a current version: stdio fixes up to 2.1.319 |
| **GitHub Copilot CLI** | Default | 1.0.81 (2026-08-27) | release notes |
| **Windsurf / Devin Desktop** | Default | 3.10.67 (2026-10-12) | changelog |
| **OpenAI Codex CLI** | Opt-in | 0.147.0 (2026-08-07) | release notes say "opt-in"; config key not in official docs |
| **Goose** | Partial | 1.48+ | open issues on gaps with 2026-07-28 servers |
| **VS Code (Copilot agent mode)** | Legacy | 1.146 (2026-11-11) | request issue open (microsoft/vscode#329848); may land in the November release |
| **Gemini CLI** | Legacy | 0.67.0 | bundled SDK goes up to 2025-11-25 |
| **Claude Desktop, claude.ai, Claude API MCP connector** | No evidence | - | Anthropic: "being rolled out across Claude products" |
| **ChatGPT, OpenAI Responses API** | No evidence | - | docs mention 2025-03-26 |
| **Zed, JetBrains AI / Junie, Cline, Continue, LM Studio, Kiro, Copilot Studio** | No evidence | - | |

## Agent frameworks (bring your own LLM)

| Framework | Status | Since | Note |
|---|---|---|---|
| **OpenAI Agents SDK (Python)** | Default | 0.20.0 | needs Python `mcp` 2.x installed |
| **OpenAI Agents SDK (JS)** | Default | 0.21.0 | |
| **Vercel AI SDK** (`@ai-sdk/mcp`) | Default | 2.0.33 | tries `server/discover` first |
| **LangChain JS** (`@langchain/mcp-adapters`) | Default | 2.0.x | `"modern"` pins 2026-07-28 |
| **Google ADK (Python)** | Opt-in | 2.11.0 | `ADK_ENABLE_MCP_MODERN_PROTOCOL=1` + `mcp` 2.x |
| **LangChain Python** (`langchain-mcp-adapters`) | Legacy | 0.3.2 | pins `mcp<2` |
| **mcp-use** | Partial | TS 2.12.x | Python version pins `mcp<2` |
| **Spring AI / Java SDK** | Server only | 2.1.0-RC2 / 2.2.0-M1 | "Not yet supported: a modern client" |

## Official SDKs

| SDK | Version with 2026-07-28 | Client default |
|---|---|---|
| **TypeScript** `@modelcontextprotocol/client` | 2.0.0 (2026-07-27), now 2.4.0 | ✔ legacy; `versionNegotiation: { mode: 'auto' }` to opt in |
| **Python** `mcp` | 2.0.0 (2026-07-28) | auto (since 2.3.0) |
| **Go** | v1.7.0 | HTTP servers need `Stateless = true` |
| **C#** | 2.0 (now 2.4.0) | stateless by default |
| **Rust** `rmcp` | 3.0.0 | opt-in via `ClientLifecycleMode::Discover` / `Auto` |
| **FastMCP** (Python) | 4.0.0 | serves both eras |

## Test tools

| Tool | Status | Note |
|---|---|---|
| **MCP Inspector** | Opt-in | ✔ `--protocol-era legacy\|auto\|modern` (tested with 2.14.0), default legacy |

Tested on 2026-11-12 with the Inspector CLI:

```bash
# v1 server (step-02): fails in modern mode
npx @modelcontextprotocol/inspector@2.14.0 --cli --protocol-era modern \
  npx tsx src/index.ts --method tools/list
# → Version negotiation failed: the server did not offer pinned protocol
#   version 2026-07-28 via server/discover (no fallback in pin mode)

# same command with --protocol-era auto: falls back to 2025, lists 5 tools
# v2 server (step-06) with --protocol-era modern: lists 5 tools
```

## What this means for the workshop

- **Every participant can do the v2 hands-on**: `Code/step-06-notes-mcp-v2` brings
  its own client (`npm run test:client`) and the Inspector speaks `modern`.
  No host needed.
- **Seeing v2 inside a host**: Claude Code, GitHub Copilot CLI or Windsurf.
- **VS Code, Gemini CLI, ChatGPT users**: their host talks 2025 to the
  same server. That is the backward compatibility working, not a failure.
- **Re-check VS Code** a few days before 2026-11-20.

## Sources

- Claude Code changelog: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
- Anthropic, "Bringing MCP 2026-07-28 to Claude": https://claude.com/blog/bringing-mcp-2026-07-28-to-claude
- GitHub Copilot CLI releases: https://github.com/github/copilot-cli/releases
- Devin Desktop (Windsurf) changelog: https://docs.devin.ai/desktop/changelog
- OpenAI Codex releases: https://github.com/openai/codex/releases
- OpenAI Agents SDK releases: https://github.com/openai/openai-agents-python/releases
- OpenAI MCP docs: https://developers.openai.com/api/docs/guides/tools-connectors-mcp
- VS Code issue: https://github.com/microsoft/vscode/issues/329848
- Goose issues: https://github.com/aaif-goose/goose/issues/13004, https://github.com/aaif-goose/goose/issues/13055
- Google ADK releases: https://github.com/google/adk-python/releases
- MCP Inspector releases: https://github.com/modelcontextprotocol/inspector/releases
- FastMCP releases: https://github.com/PrefectHQ/fastmcp/releases
- MCP Python SDK releases: https://github.com/modelcontextprotocol/python-sdk/releases
- MCP Go SDK releases: https://github.com/modelcontextprotocol/go-sdk/releases
- MCP Rust SDK releases: https://github.com/modelcontextprotocol/rust-sdk/releases
- C# SDK 2.0: https://devblogs.microsoft.com/dotnet/announcing-v20-of-the-official-mcp-csharp-sdk/
- Claude API MCP connector: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector
- npm and PyPI package metadata for version numbers
