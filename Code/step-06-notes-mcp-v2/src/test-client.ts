import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
for (const mode of ['auto', { pin: '2026-07-28' }] as const) {
  const client = new Client({ name: 'test', version: '1.0.0' }, { versionNegotiation: { mode: mode as any } });
  await client.connect(new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/index.ts'] }));
  const { tools } = await client.listTools();
  const r = await client.callTool({ name: 'add_note', arguments: { content: 'v2 works', tags: ['v2'] } });
  console.log(JSON.stringify(mode), 'era=', (client as any).getProtocolEra?.(), 'tools=', tools.map(t => t.name).join(','), 'call=', JSON.stringify(r.content).slice(0, 80));
  await client.close();
}
const legacy = new Client({ name: 'legacy', version: '1.0.0' });
await legacy.connect(new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/index.ts'] }));
console.log('default era=', (legacy as any).getProtocolEra?.(), 'tools=', (await legacy.listTools()).tools.length);
await legacy.close();
