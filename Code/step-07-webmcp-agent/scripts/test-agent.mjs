// End-to-end check without a browser: the same tools and agent loop as the
// page, against the running server (npm run dev) and a real LLM.
//
//   npm run test:agent                      # default provider from .env
//   npm run test:agent -- ollama            # provider
//   npm run test:agent -- openai my-model   # provider + model
import { createNoteTools } from '../public/tools.js';
import { runAgent } from '../public/agent.js';

const BASE = process.env.STEP07_URL ?? 'http://localhost:3007';
const config = await (await fetch(`${BASE}/api/llm/config`)).json();
const provider = process.argv[2] ?? config.defaultProvider;
let model = process.argv[3] ?? config.providers.find((p) => p.id === provider)?.model;
if (!model) {
  const res = await fetch(`${BASE}/api/llm/models?provider=${provider}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  model = data.models.find((m) => !/embed/i.test(m));
}
console.log(`Provider: ${provider}, model: ${model}`);

async function chat(messages, tools) {
  const res = await fetch(`${BASE}/api/llm/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, messages, tools }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

const toolCalls = [];
const answer = await runAgent({
  history: [],
  input: 'How many of my notes mention "MCP"? Use the tools, then delete the oldest of them.',
  tools: createNoteTools(BASE),
  chat,
  approve: async (name, args) => {
    console.log(`approve? ${name} ${JSON.stringify(args)} -> no (test denies writes)`);
    return false;
  },
  onEvent: ({ name, args, result }) => {
    toolCalls.push(name);
    console.log(`tool: ${name}(${JSON.stringify(args)}) -> ${result.slice(0, 120)}`);
  },
});
console.log(`answer: ${answer}`);

if (!toolCalls.some((n) => n === 'search_notes' || n === 'list_notes')) {
  console.error('FAIL: the model called no read tool');
  process.exit(1);
}
console.log('PASS');
