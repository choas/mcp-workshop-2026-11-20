// The page's tools, defined once in the WebMCP shape:
// { name, description, inputSchema, execute, annotations }.
// Two consumers use them: the browser's agent (WebMCP, webmcp.js) and our own
// in-page agent loop (agent.js) with any OpenAI-compatible LLM.
//
// `base` is '' in the browser (same origin) and http://localhost:3007 in Node tests.

export function createNoteTools(base = '') {
  async function api(path, options) {
    const res = await fetch(`${base}${path}`, options);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data;
  }

  return [
    {
      name: 'list_notes',
      description: "List the user's most recent notes (newest first). Returns JSON with id, content, tags.",
      inputSchema: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'How many notes (default 10)' } },
      },
      execute: async ({ limit = 10 } = {}) => JSON.stringify(await api(`/notes?limit=${Number(limit) || 10}`)),
      // Note content is written by people: untrusted for the model (Block 6).
      annotations: { readOnlyHint: true, untrustedContentHint: true },
    },
    {
      name: 'search_notes',
      description: "Search the user's notes by keyword in the content. Returns matching notes as JSON.",
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Keyword, e.g. "MCP"' } },
        required: ['query'],
      },
      execute: async ({ query }) =>
        JSON.stringify(await api(`/notes/search?q=${encodeURIComponent(query)}`)),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
    },
    {
      name: 'add_note',
      description: 'Create a new note for the user.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Note text' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
        },
        required: ['content'],
      },
      execute: async ({ content, tags }) => {
        const note = await api('/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, tags }),
        });
        return `Added note ${note.id}.`;
      },
      annotations: { readOnlyHint: false },
    },
    {
      name: 'delete_note',
      description: 'Delete one note by ID. Irreversible. Get IDs from list_notes or search_notes.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'number', description: 'Note ID' } },
        required: ['id'],
      },
      execute: async ({ id }) => {
        await api(`/notes/${Number(id)}`, { method: 'DELETE' });
        return `Deleted note ${id}.`;
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
  ];
}
