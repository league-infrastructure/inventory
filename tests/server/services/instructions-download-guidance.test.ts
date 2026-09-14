/**
 * Ticket 010-006, golden-text check: the stakeholder's exact complaint was
 * "I'm trying to ask the AI how to get labels and exports, and it says it
 * can create them, but it can't give them to me." Both instruction sources
 * (`MCP_INSTRUCTIONS`, for external MCP clients, and `ai-chat-system.txt`,
 * for the in-app chat model) now tell the model to present a `download_url`
 * instead of claiming it can't deliver files. This guards against either
 * one regressing back to that stale claim, or losing the guidance
 * entirely.
 *
 * `MCP_INSTRUCTIONS` is imported directly from `mcp/server.ts` (not
 * round-tripped through a real MCP prompt fetch) — deep
 * `@modelcontextprotocol/sdk/*` subpath imports don't resolve via
 * ts-jest's classic module resolution from this directory, per
 * `ai-chat-mcp-unification.test.ts`'s note; importing the exported
 * constant avoids that entirely while still checking the actual source of
 * truth, not a duplicated copy. `ai-chat-system.txt` is a plain text file,
 * read directly.
 */
import fs from 'fs';
import path from 'path';
import { MCP_INSTRUCTIONS } from '../../../server/src/mcp/server';

const AI_CHAT_SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '../../../server/src/prompts/ai-chat-system.txt'),
  'utf-8',
);

/**
 * Sentences that mention inability to deliver/send/attach/produce a file
 * *without* being part of a "do not say this" instruction (a "do not",
 * "don't", or "never" cue in the same sentence) — i.e. the model's own
 * instructions still contain an unqualified claim that it can't hand over
 * files, which is exactly the regression this test exists to catch.
 * Whitespace (including line wraps in the source text) is normalized
 * before splitting into sentences so a wrapped "Do NOT ... / tell the user
 * you cannot deliver ..." isn't misread as two separate lines, one with
 * the cue and one without.
 */
function unqualifiedCannotDeliverClaims(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ');
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  return sentences
    .filter((s) => /\bcan(?:'t|not)\b.*\b(deliver|attach|send|produce|hand over|give)\b/i.test(s))
    .filter((s) => !/\b(do not|don't|never)\b/i.test(s));
}

describe('presentation-layer download guidance (ticket 010-006)', () => {
  it('MCP_INSTRUCTIONS describes download_url for generate_labels/export_list and never unqualifiedly claims files can\'t be delivered', () => {
    expect(MCP_INSTRUCTIONS).toMatch(/download_url/);
    expect(MCP_INSTRUCTIONS).toMatch(/generate_labels/);
    expect(MCP_INSTRUCTIONS).toMatch(/export_list/);
    expect(unqualifiedCannotDeliverClaims(MCP_INSTRUCTIONS)).toEqual([]);
  });

  it('ai-chat-system.txt describes download_url, distinguishes it from in-app nav links, and never unqualifiedly claims files can\'t be delivered', () => {
    expect(AI_CHAT_SYSTEM_PROMPT).toMatch(/download_url/);
    expect(AI_CHAT_SYSTEM_PROMPT).toMatch(/generate_labels/);
    expect(AI_CHAT_SYSTEM_PROMPT).toMatch(/export_list/);
    // Distinguishes the absolute download link from the existing relative
    // /kits/:id-style in-app navigation links documented in the same file.
    expect(AI_CHAT_SYSTEM_PROMPT).toMatch(/absolute/i);
    expect(unqualifiedCannotDeliverClaims(AI_CHAT_SYSTEM_PROMPT)).toEqual([]);
  });
});
