// UI wiring: WebMCP registration, provider/model picker, chat, notes list.
import { createNoteTools } from './tools.js';
import { registerWebMCP } from './webmcp.js';
import { runAgent } from './agent.js';

const $ = (id) => document.getElementById(id);
const tools = createNoteTools();
let config = null;
let history = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent: never render note text as HTML
  return node;
}

// ---- Tools + WebMCP ------------------------------------------------------
async function showTools() {
  const { available, registered } = await registerWebMCP(tools);
  $('webmcp-status').textContent = available
    ? `WebMCP: ${registered.length} tools registered. The browser's agent can use them, and so can the agent below.`
    : 'WebMCP not available in this browser (Chrome 155+ with chrome://flags/#enable-webmcp-testing). The agent below uses the same tools anyway.';
  for (const tool of tools) {
    const li = el('li');
    li.append(el('code', '', tool.name), ` ${tool.description} `);
    const ro = tool.annotations?.readOnlyHint;
    li.append(el('span', ro ? 'tag' : 'tag tag-warn', ro ? 'read-only' : 'asks you first'));
    $('tools').append(li);
  }
}

// ---- LLM provider + model ------------------------------------------------
async function loadConfig() {
  config = await (await fetch('/api/llm/config')).json();
  for (const p of config.providers) $('provider').append(new Option(p.label, p.id));
  $('provider').value = config.defaultProvider;
  await loadModels();
}

async function loadModels() {
  const provider = config.providers.find((p) => p.id === $('provider').value);
  const select = $('model');
  select.replaceChildren();
  $('llm-status').textContent = `Loading models from ${provider.baseUrl} ...`;
  $('llm-status').classList.remove('error');
  try {
    const res = await fetch(`/api/llm/models?provider=${provider.id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const models = data.models.filter((m) => !/embed/i.test(m)); // embedding models can't chat
    for (const m of models) select.append(new Option(m, m));
    if (provider.model && !models.includes(provider.model)) select.prepend(new Option(provider.model, provider.model));
    if (provider.model) select.value = provider.model;
    $('llm-status').textContent =
      `${provider.label} at ${provider.baseUrl}` + (provider.hasKey ? ' (API key set on the server)' : '') +
      (models.length ? '' : ': no chat models found');
  } catch (error) {
    if (provider.model) select.append(new Option(provider.model, provider.model));
    $('llm-status').textContent = `${provider.label} not reachable: ${error.message}`;
    $('llm-status').classList.add('error');
  }
}

async function chat(messages, llmTools) {
  const res = await fetch('/api/llm/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: $('provider').value, model: $('model').value, messages, tools: llmTools }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

// ---- Chat ----------------------------------------------------------------
function addBubble(role, text) {
  const bubble = el('div', `msg msg-${role}`, text);
  $('chat').append(bubble);
  $('chat').scrollTop = $('chat').scrollHeight;
  return bubble;
}

function approve(name, args) {
  // Human-in-the-loop for every tool that is not read-only (Block 6).
  return Promise.resolve(confirm(`The agent wants to call ${name}\n\n${JSON.stringify(args, null, 2)}\n\nAllow?`));
}

$('chat-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('chat-input').value.trim();
  if (!input) return;
  $('chat-input').value = '';
  $('send').disabled = true;
  addBubble('user', input);
  const thinking = addBubble('status', 'Thinking ...');
  try {
    const answer = await runAgent({
      history,
      input,
      tools,
      chat,
      approve,
      onEvent: ({ name, args, result }) => {
        const short = result.length > 300 ? `${result.slice(0, 300)} ...` : result;
        $('chat').insertBefore(el('div', 'msg msg-tool', `${name}(${JSON.stringify(args)})\n→ ${short}`), thinking);
        if (name !== 'list_notes' && name !== 'search_notes') loadNotes();
      },
    });
    thinking.remove();
    addBubble('assistant', answer || '(no answer)');
  } catch (error) {
    thinking.remove();
    addBubble('error', error.message);
  } finally {
    $('send').disabled = false;
    $('chat-input').focus();
  }
});

$('reset').addEventListener('click', () => {
  history = [];
  $('chat').replaceChildren();
});
$('provider').addEventListener('change', loadModels);
$('reload-models').addEventListener('click', loadModels);

// ---- Notes list ----------------------------------------------------------
async function loadNotes() {
  const notes = await (await fetch('/notes?limit=20')).json();
  $('notes-count').textContent = `(${notes.length})`;
  const list = notes.map((n) => {
    const card = el('div', 'note-card');
    card.append(el('div', 'note-content', n.content));
    const meta = el('div', 'note-meta');
    const tags = el('div', 'note-tags');
    tags.append(el('span', 'tag', `#${n.id}`), ...n.tags.map((t) => el('span', 'tag', t)));
    meta.append(tags, el('span', 'note-date', n.created_at));
    card.append(meta);
    return card;
  });
  $('notes').replaceChildren(...(list.length ? list : [el('p', 'empty', 'No notes yet.')]));
}

await showTools();
await Promise.all([loadConfig(), loadNotes()]);
