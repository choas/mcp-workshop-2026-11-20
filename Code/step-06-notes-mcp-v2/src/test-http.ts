import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
const client = new Client({ name: 't', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } as any } });
await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost:3005/mcp')));
console.log('era=', (client as any).getProtocolEra?.(), 'tools=', (await client.listTools()).tools.length);
const r = await client.callTool({ name: 'list_notes', arguments: { limit: 1 } });
console.log(JSON.stringify(r.content).slice(0, 80));
await client.close();
