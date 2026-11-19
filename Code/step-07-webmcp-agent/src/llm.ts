// LLM providers. All three speak the OpenAI Chat Completions API
// (POST {baseUrl}/chat/completions with `tools`), so one code path serves them.
// Keys stay on the server: the browser only names the provider and the model.

export interface Provider {
  id: string;
  label: string;
  baseUrl: string;
  apiKey?: string;
  model?: string; // default model; empty means "pick one in the UI"
}

const env = process.env;

export const providers: Record<string, Provider> = {
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio',
    baseUrl: env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',
    apiKey: env.LMSTUDIO_API_KEY || undefined,
    model: env.LMSTUDIO_MODEL || undefined,
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    baseUrl: env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    model: env.OLLAMA_MODEL || undefined,
  },
  openai: {
    // OpenAI itself, or any OpenAI-compatible endpoint (vLLM, OpenRouter, a gateway, ...)
    id: 'openai',
    label: 'OpenAI-compatible',
    baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: env.OPENAI_API_KEY || undefined,
    model: env.OPENAI_MODEL || undefined,
  },
};

export const defaultProvider = providers[env.LLM_PROVIDER ?? ''] ? env.LLM_PROVIDER! : 'lmstudio';

export function getProvider(id: unknown): Provider {
  const provider = typeof id === 'string' ? providers[id] : undefined;
  if (!provider) throw new Error(`Unknown provider: ${String(id)}`);
  return provider;
}

function headers(provider: Provider): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) h.Authorization = `Bearer ${provider.apiKey}`;
  return h;
}

// fetch() only says "fetch failed"; name the provider and the real cause.
async function request(provider: Provider, path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${provider.baseUrl}${path}`, { ...init, headers: headers(provider) });
  } catch (error) {
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    const reason = cause?.code ?? cause?.message ?? (error as Error).message;
    throw new Error(`${provider.label} not reachable at ${provider.baseUrl} (${reason}). Is it running?`);
  }
}

// What the UI may know: no keys, no base URLs with credentials.
export function publicConfig() {
  return {
    defaultProvider,
    providers: Object.values(providers).map((p) => ({
      id: p.id,
      label: p.label,
      baseUrl: p.baseUrl,
      model: p.model ?? null,
      hasKey: Boolean(p.apiKey),
    })),
  };
}

// GET {baseUrl}/models: LM Studio, Ollama and OpenAI all support it.
export async function listModels(provider: Provider): Promise<string[]> {
  const res = await request(provider, '/models', { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`${provider.label}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id).sort();
}

// One Chat Completions call. The agent loop lives in the browser (public/agent.js).
export async function chat(
  provider: Provider,
  model: string,
  messages: unknown[],
  tools: unknown[]
): Promise<unknown> {
  const res = await request(provider, '/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', stream: false }),
    signal: AbortSignal.timeout(180_000), // local models can be slow on the first call
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${provider.label}: ${res.status} ${text.slice(0, 500)}`);
  return JSON.parse(text);
}
