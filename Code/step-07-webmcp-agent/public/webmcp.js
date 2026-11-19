// WebMCP: offer the page's tools to the browser's own agent.
// API per developer.chrome.com/docs/ai/webmcp/imperative-api (origin trial,
// "subject to change"; it already moved from navigator to document).
// Needs Chrome 155+ with chrome://flags/#enable-webmcp-testing and a consuming
// agent, e.g. github.com/GoogleChromeLabs/webmcp-extension.

export async function registerWebMCP(tools) {
  if (!document.modelContext?.registerTool) {
    return { available: false, registered: [] };
  }
  const registered = [];
  for (const tool of tools) {
    try {
      await document.modelContext.registerTool(tool);
      registered.push(tool.name);
    } catch (error) {
      console.error(`WebMCP: could not register ${tool.name}`, error);
    }
  }
  return { available: true, registered };
}
