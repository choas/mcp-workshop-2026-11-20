#!/usr/bin/env pwsh
#
# get_mcp_configuration.ps1 — print this folder's MCP server configuration.
#
# Copy the output into your MCP client config (Claude Desktop, VS Code, ...).
#
# Usage:
#   ./get_mcp_configuration.ps1 [--use-npx] [--add-mcpServer]
#
# Options:
#   --use-npx        Run the server via `npx tsx` instead of the default
#                    `node --import <this folder>/node_modules/tsx` (needs
#                    `npm install` here first). npx may download its own tsx.
#   --add-mcpServer  Emit a full { "mcpServers": { ... } } document instead of
#                    just the bare { "<name>": { ... } } entry.
#
$ErrorActionPreference = "Stop"

$ServerName = "weather"

$UseNpx = $false
$AddWrapper = $false
foreach ($arg in $args) {
  switch ($arg) {
    "--use-npx" { $UseNpx = $true }
    "--add-mcpServer" { $AddWrapper = $true }
    { $_ -in @("-h", "--help") } {
      Get-Content $PSCommandPath |
        Where-Object { $_ -match "^# " } |
        ForEach-Object { $_ -replace "^# ?", "" }
      exit 0
    }
    default { Write-Error "Unknown option: $arg"; exit 1 }
  }
}

# Absolute path to this folder's MCP entry point (forward slashes work on Windows too).
$ScriptDir = Split-Path -Parent $PSCommandPath
$Entry = (Join-Path $ScriptDir "src/index.ts") -replace "\\", "/"
# The client starts the server from its own folder, so point --import at this
# folder's tsx loader (as a file:// URL, which Node needs on Windows).
$LoaderPath = ((Join-Path $ScriptDir "node_modules/tsx/dist/loader.mjs") -replace "\\", "/") -replace " ", "%20"
if ($LoaderPath -notmatch "^/") { $LoaderPath = "/" + $LoaderPath }  # C:/... -> /C:/...
$Loader = "file://" + $LoaderPath

if ($UseNpx) {
  $Command = "npx"
  $ArgsJson = "`"tsx`", `"$Entry`""
} else {
  $Command = "node"
  $ArgsJson = "`"--import`", `"$Loader`", `"$Entry`""
}

if ($AddWrapper) {
  @"
{
  "mcpServers": {
    "$ServerName": {
      "command": "$Command",
      "args": [$ArgsJson]
    }
  }
}
"@
} else {
  @"
{
  "$ServerName": {
    "command": "$Command",
    "args": [$ArgsJson]
  }
}
"@
}
