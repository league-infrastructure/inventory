/**
 * Ticket 010-006: the in-app chat's tool-result handling
 * (`ai-chat.service.ts`) keeps only `text` content blocks, dropping
 * `resource` blocks (e.g. `generate_labels`' inline base64 PDF). Tickets
 * 003/004 made `generate_labels`/`export_list` carry a `download_url`
 * inside their JSON manifest's `text` block specifically so that filter
 * doesn't lose the one thing the user needs — this file verifies that by
 * driving a real tool call end to end (real DB fixtures, real MCP tool
 * handlers, real `AiChatService.withMcpClient()`), not by re-reading the
 * comment that claims it.
 *
 * `extractTextContent()` is the exact function `AiChatService.chat()` uses
 * to build each Anthropic `tool_result` block, exported from
 * `ai-chat.service.ts` for exactly this purpose — this test exercises that
 * real function rather than a hand-rolled copy of its filtering logic.
 */
import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { ServiceRegistry } from '../../../server/src/services/service.registry';
import { AiChatService, extractTextContent } from '../../../server/src/services/ai-chat.service';
import type { User } from '@prisma/client';

type ChatToolResult = { isError?: boolean; content?: Array<{ type: string; text?: string }> };

function fakeUser(role: string): User {
  return { id: getUserId(), role } as User;
}

describe('AiChatService: download links survive the tool-result text filter (ticket 010-006)', () => {
  const service = new AiChatService();
  let siteId: number;
  let kitId: number;
  let kitNumber: number;

  beforeAll(async () => {
    await setupTestUser();
    const reg = getRegistry();
    const uid = getUserId();
    const suffix = getSuffix();

    const site = await reg.sites.create({ name: `svc-test-${suffix}-chat-dl-site` }, uid);
    siteId = site.id;

    kitNumber = (suffix % 100000) + 140000;
    const kit = await reg.kits.create({ number: kitNumber, name: `svc-test-${suffix}-chat-dl-kit`, siteId }, uid);
    kitId = kit.id;
  }, 30000);

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.kit.deleteMany({ where: { id: kitId } });
    await prisma.site.deleteMany({ where: { id: siteId } });
    await teardown();
  }, 30000);

  it('export_list: the manifest\'s download_url survives extractTextContent', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');

    const result = await service.withMcpClient(fakeUser('QUARTERMASTER'), services, (client) =>
      client.callTool({ name: 'export_list', arguments: { entity: 'kits', format: 'csv' } }),
    ) as ChatToolResult;

    expect(result.isError).toBeFalsy();
    const text = extractTextContent(result);
    const manifest = JSON.parse(text);
    expect(typeof manifest.download_url).toBe('string');
    expect(manifest.download_url).toMatch(/^https?:\/\/.+\/api\/downloads\/[0-9a-f]{64}$/);
  });

  it('generate_labels: the resource (base64 PDF) block is filtered out, but the manifest\'s download_url survives extractTextContent', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');

    const result = await service.withMcpClient(fakeUser('QUARTERMASTER'), services, (client) =>
      client.callTool({ name: 'generate_labels', arguments: { kit_numbers: [kitNumber] } }),
    ) as ChatToolResult;

    expect(result.isError).toBeFalsy();
    // The raw MCP result really does carry a resource block here — this
    // scenario is the whole reason the filter (and this test) exists.
    expect(result.content?.some((c) => c.type === 'resource')).toBe(true);

    const text = extractTextContent(result);
    // No resource-block content (nor raw PDF bytes) reaches the filtered text...
    expect(text).not.toMatch(/%PDF-/);
    // ...but the manifest and its download_url do.
    const manifest = JSON.parse(text);
    expect(manifest.bundles).toHaveLength(1);
    expect(manifest.bundles[0].download_url).toMatch(/^https?:\/\/.+\/api\/downloads\/[0-9a-f]{64}$/);
  });
});
