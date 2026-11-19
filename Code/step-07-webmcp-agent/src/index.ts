// Step 07: the Notes app as a WebMCP page plus its own in-page agent.
// Serves public/, the notes REST API (same as step 01, same database) and a
// small proxy to an OpenAI-compatible LLM (LM Studio, Ollama, OpenAI).
import http, { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env if there is one (Node 22 built-in, no dotenv needed).
// Before importing llm.ts, which reads process.env.
try {
  process.loadEnvFile();
} catch {
  // no .env: use the defaults
}

const { initDatabase, addNote, searchNotes, listNotes, deleteNote } = await import('./database.js');
const llm = await import('./llm.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3007;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

const db = initDatabase();

type Note = { id: number; content: string; tags: string | null; created_at: string; updated_at: string };

function formatNote(note: Note): object {
  return {
    id: note.id,
    content: note.content,
    tags: note.tags ? note.tags.split(',') : [],
    created_at: note.created_at,
    updated_at: note.updated_at,
  };
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function serveStatic(res: ServerResponse, pathname: string): void {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, relativePath);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
    res.end(data);
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  // Only this page may use the API: other web pages could otherwise call the
  // LLM with your key or delete your notes (cross-site requests).
  const origin = req.headers.origin;
  if (origin && !LOCAL_ORIGIN.test(origin)) {
    sendJson(res, 403, { error: 'Forbidden origin' });
    return;
  }

  // ---- LLM proxy -------------------------------------------------------
  if (segments[0] === 'api' && segments[1] === 'llm') {
    // GET /api/llm/config - providers, default models, no keys
    if (method === 'GET' && segments[2] === 'config') {
      sendJson(res, 200, llm.publicConfig());
      return;
    }
    // GET /api/llm/models?provider=lmstudio - models the provider offers
    if (method === 'GET' && segments[2] === 'models') {
      try {
        const provider = llm.getProvider(url.searchParams.get('provider'));
        sendJson(res, 200, { models: await llm.listModels(provider) });
      } catch (error) {
        sendJson(res, 502, { error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
    // POST /api/llm/chat {provider, model, messages, tools} - one model call
    if (method === 'POST' && segments[2] === 'chat') {
      const body = await readJsonBody(req);
      try {
        const provider = llm.getProvider(body.provider);
        const model = typeof body.model === 'string' && body.model ? body.model : provider.model;
        if (!model) throw new Error(`No model selected for ${provider.label}`);
        if (!Array.isArray(body.messages)) throw new Error('messages must be an array');
        const tools = Array.isArray(body.tools) ? body.tools : [];
        sendJson(res, 200, await llm.chat(provider, model, body.messages, tools));
      } catch (error) {
        sendJson(res, 502, { error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  // ---- Notes REST API (same as step 01) ---------------------------------
  if (method === 'POST' && segments.length === 1 && segments[0] === 'notes') {
    const { content, tags } = await readJsonBody(req);
    if (!content || typeof content !== 'string') {
      sendJson(res, 400, { error: 'content is required and must be a string' });
      return;
    }
    if (tags !== undefined && !(Array.isArray(tags) && tags.every((t) => typeof t === 'string'))) {
      sendJson(res, 400, { error: 'tags must be an array of strings' });
      return;
    }
    sendJson(res, 201, formatNote(addNote(db, content, tags as string[] | undefined)));
    return;
  }

  if (method === 'GET' && segments.length === 2 && segments[0] === 'notes' && segments[1] === 'search') {
    const query = url.searchParams.get('q');
    if (!query) {
      sendJson(res, 400, { error: 'Query parameter q is required' });
      return;
    }
    sendJson(res, 200, searchNotes(db, query).map(formatNote));
    return;
  }

  if (method === 'GET' && segments.length === 1 && segments[0] === 'notes') {
    const limit = parseInt(url.searchParams.get('limit') ?? '10', 10) || 10;
    sendJson(res, 200, listNotes(db, limit).map(formatNote));
    return;
  }

  if (method === 'DELETE' && segments.length === 2 && segments[0] === 'notes') {
    const id = parseInt(segments[1], 10);
    if (isNaN(id)) {
      sendJson(res, 400, { error: 'Invalid note ID' });
      return;
    }
    if (deleteNote(db, id)) {
      res.writeHead(204).end();
    } else {
      sendJson(res, 404, { error: 'Note not found' });
    }
    return;
  }

  if (method === 'GET') {
    serveStatic(res, url.pathname);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

http
  .createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error(error);
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Internal server error' });
    });
  })
  // 127.0.0.1: only this machine, not the conference Wi-Fi.
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Step 07 on http://localhost:${PORT} (LLM default: ${llm.defaultProvider})`);
  });
