# MCP Use Cases

What people build with MCP, and what to watch out for. Use it to pick a
capstone topic (Block 8) or a first project at work.

**How to read each entry**

- **Shape**: which MCP primitives and how many tools
- **Where**: local (stdio, on the user's machine) or remote (Streamable HTTP, shared)
- **Trifecta**: which legs of the lethal trifecta (Block 6) the use case has:
  **P** = private data, **U** = untrusted content, **X** = can send data out.
  All three together means human approval on outbound actions, or cut a leg.
- **Examples**: existing servers to look at. Check the current state before you
  rely on one; the ecosystem moves fast.

**Rule for every use case: start read-only. Add write tools one at a time, behind approval.**

---

## Software development

### 1. Code host assistant (issues, PRs, reviews)
- **Do**: summarize PRs, triage issues, draft review comments, link commits to tickets
- **Shape**: read tools (`find_issues`, `get_pr_diff`), write tools (`comment`, `label`) behind approval
- **Where**: remote, OAuth via the code host
- **Trifecta**: P + U + X. Issue and PR text is written by strangers; comments are outbound
- **Examples**: GitHub MCP server, GitLab MCP servers

### 2. Browser automation and UI testing
- **Do**: let the agent open pages, click, fill forms, take screenshots, check accessibility
- **Shape**: few powerful tools (`navigate`, `click`, `snapshot`)
- **Where**: local
- **Trifecta**: U + X, P if logged in. Every web page is untrusted content
- **Examples**: Playwright MCP

### 3. Up-to-date library docs
- **Do**: give the coding agent current docs for a library version instead of training data
- **Shape**: one search tool + resources per doc page
- **Where**: remote, read-only
- **Trifecta**: U only. Low risk
- **Examples**: Context7, vendor docs servers

### 4. Error and incident triage
- **Do**: pull the stack trace and recent deploys for an alert, propose a cause
- **Shape**: read-only tools on the error tracker, logs, deploy history
- **Where**: remote behind a gateway
- **Trifecta**: P + U (log lines can contain attacker input)
- **Examples**: Sentry MCP, observability vendor servers

### 5. Database copilot
- **Do**: answer questions in natural language with SQL on a read replica
- **Shape**: `describe_schema` resource, `run_query` tool with a read-only DB user, row limits
- **Where**: local for dev databases, remote for shared ones
- **Trifecta**: P (+ X if the host can reach the web). Never on the production primary
- **Examples**: Postgres / Supabase MCP servers

---

## Knowledge and documents

### 6. Internal knowledge search
- **Do**: answer "what is our process for X" from wiki, policies, ADRs, with sources
- **Shape**: one `search` tool + resources for documents; respect per-user permissions
- **Where**: remote, OAuth so results match what the user may see
- **Trifecta**: P. Add U if anyone can edit the wiki
- **Examples**: Confluence / Notion / SharePoint MCP servers, an own server on a vector index

### 7. Meeting notes to actions
- **Do**: turn a transcript into decisions, owners and tickets
- **Shape**: read transcript resource, `create_ticket` tool behind approval
- **Where**: remote
- **Trifecta**: P + U + X. Transcripts contain what anyone said in the meeting
- **Examples**: combine a notes/transcript server with a ticketing server

### 8. Personal knowledge assistant (what we built today)
- **Do**: notes, weather, summaries, brainstorming
- **Shape**: CRUD tools + resources + prompts
- **Where**: local
- **Trifecta**: P + U + X (the Block 6 demo)
- **Examples**: `Code/step-02-notes-mcp`, `Code/step-06-notes-mcp-v2`

---

## Business systems

### 9. Ticket and project management
- **Do**: create, update, search tickets; weekly status from the board
- **Shape**: task-shaped tools (`create_bug_from_report`, `weekly_status`), not one per API endpoint
- **Where**: remote, OAuth
- **Trifecta**: P + U + X
- **Examples**: Atlassian (Jira/Confluence) MCP, Linear MCP, Asana MCP

### 10. CRM and sales assistant
- **Do**: account briefing before a call, draft follow-up emails, update deal notes
- **Shape**: read tools on accounts and deals; drafts only, a human sends
- **Where**: remote
- **Trifecta**: P + U + X. Customer emails are untrusted; email is an exfiltration path
- **Examples**: HubSpot / Salesforce MCP servers

### 11. Payments and billing support
- **Do**: look up a customer's invoices, explain a charge, prepare a refund
- **Shape**: read tools; refunds as a draft that a human confirms (MRTR confirm step in v2)
- **Where**: remote, restricted API keys
- **Trifecta**: P + X. Money moves: strict approval
- **Examples**: Stripe MCP

### 12. Workflow automation as tools
- **Do**: expose existing automations ("onboard employee", "create offer PDF") as MCP tools
- **Shape**: one tool per workflow, the workflow engine does the work
- **Where**: remote
- **Trifecta**: depends on the workflow; review each one
- **Examples**: n8n MCP Server Trigger, Zapier MCP

---

## Communication and design

### 13. Team chat assistant
- **Do**: summarize channels, find a decision, draft a reply
- **Shape**: read tools for channels and threads; posting behind approval
- **Where**: remote
- **Trifecta**: P + U + X. Anyone in the channel can plant instructions
- **Examples**: Slack MCP

### 14. Design to code
- **Do**: read a design file and generate components that match it
- **Shape**: resources for frames and tokens, read-only
- **Where**: local or remote
- **Trifecta**: P (+ U for shared files)
- **Examples**: Figma Dev Mode MCP server

---

## Industry and operations

### 15. Ops copilot for infrastructure
- **Do**: "why is service X slow": metrics, logs, recent changes
- **Shape**: read-only first; restarts and scaling as approved actions
- **Where**: remote, behind a gateway with per-tool policy
- **Trifecta**: P + U. Add X only with approval
- **Examples**: cloud provider and Kubernetes MCP servers

### 16. Manufacturing and IoT data
- **Do**: query machine state, OEE, maintenance history in plain language
- **Shape**: read-only tools on the historian / MES; never write to controllers
- **Where**: remote, inside the plant network
- **Trifecta**: P. Keep it that way
- **Examples**: own server on OPC UA / MQTT data

### 17. Regulated domains (health, finance, public sector)
- **Do**: search guidelines, check documents against rules, prepare reports
- **Shape**: read-only, every answer with a source, audit log at the gateway
- **Where**: remote, data residency checked
- **Trifecta**: P. Personal data rules apply before any MCP question
- **Examples**: own servers; public data sources (e.g. PubMed, clinical trials registries)

---

## Building blocks (often combined)

| Server | Gives the agent | Watch out |
|---|---|---|
| Filesystem | read/write files in allowed paths | allow only the paths you need |
| Git | history, diffs, blame | local repos only |
| Fetch | web pages as text | untrusted content + exfiltration path |
| Memory | knowledge graph across sessions | stores whatever the model decides |

Reference servers: `github.com/modelcontextprotocol/servers`

---

## Anti-use-cases: when not to use MCP

- **One app, one model, three functions**: plain function calling is simpler
- **Know-how, not access** (how to write our reports): a Skill or a prompt, not a server
- **Bulk data processing**: a pipeline, not an agent calling a tool 10,000 times
- **Hard real-time control** (machines, trading): an LLM in the loop is the wrong tool
- **No owner**: an MCP server is a production API; if nobody runs it, don't ship it

---

## Capstone template

```text
Use case:
Users:                       (who, how many)
Tools (max 5):               name - description - args
Resources / prompts:
Local or remote:             auth via
Trifecta legs:               P / U / X → which leg do we cut, or where is the approval?
State handles:               (e.g. basket_id)
5 eval requests:             request → expected tool + args
```
