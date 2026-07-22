import { AiChatService } from '../../../server/src/services/ai-chat.service';

describe('AiChatService', () => {
  describe('isConfigured', () => {
    it('returns false when ANTHROPIC_API_KEY is not set', () => {
      const original = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      const service = new AiChatService();
      expect(service.isConfigured).toBe(false);
      if (original) process.env.ANTHROPIC_API_KEY = original;
    });

    it('returns true when ANTHROPIC_API_KEY is set', () => {
      const original = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
      const service = new AiChatService();
      expect(service.isConfigured).toBe(true);
      if (original) {
        process.env.ANTHROPIC_API_KEY = original;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    });
  });

  describe('getToolsForRole', () => {
    let service: AiChatService;

    beforeAll(() => {
      const original = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
      service = new AiChatService();
      if (original) {
        process.env.ANTHROPIC_API_KEY = original;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    });

    it('returns all tools for QUARTERMASTER', async () => {
      const tools = await service.getToolsForRole('QUARTERMASTER');
      // The catalog now comes live from the MCP server's tools/list (~47
      // tools), not a hand-picked ~26-tool subset — assert a floor rather
      // than an exact count so this doesn't need updating every time a
      // tool is added to mcp/tools.ts.
      expect(tools.length).toBeGreaterThan(40);
      const names = tools.map(t => t.name);
      expect(names).toContain('create_kit');
      expect(names).toContain('delete_item');
      expect(names).toContain('list_kits');
      // Newly-reachable categories (via the unified MCP catalog).
      expect(names).toContain('renumber_pack');
      expect(names).toContain('get_version');
    });

    it('returns only read tools for INSTRUCTOR', async () => {
      const tools = await service.getToolsForRole('INSTRUCTOR');
      const names = tools.map(t => t.name);
      expect(names).toContain('list_kits');
      expect(names).toContain('list_sites');
      expect(names).toContain('get_kit');
      expect(names).toContain('transfer_kit');
      expect(names).toContain('transfer_computer');
      // Should NOT contain write tools
      expect(names).not.toContain('create_kit');
      expect(names).not.toContain('delete_item');
      expect(names).not.toContain('create_pack');
      expect(names).not.toContain('renumber_pack');
    });

    it('each tool has name, description, and input_schema', async () => {
      const tools = await service.getToolsForRole('QUARTERMASTER');
      for (const tool of tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.input_schema).toBeDefined();
        expect(tool.input_schema.type).toBe('object');
      }
    });
  });

  describe('chat', () => {
    it('throws when not configured', async () => {
      const original = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      const service = new AiChatService();
      await expect(
        service.chat('hello', [], {} as any, {} as any, () => {})
      ).rejects.toThrow('AI is not configured');
      if (original) process.env.ANTHROPIC_API_KEY = original;
    });
  });
});
