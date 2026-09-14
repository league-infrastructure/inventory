/**
 * Shared kit/pack identifier resolvers for MCP tools.
 *
 * Users speak kit and pack identifiers as printed/spoken numbers — "kit 17",
 * "pack 26/1" — never as database primary keys. `Kit.number` (`Int
 * @unique`) and the `Pack` compound key `@@unique([kitId, displayNumber])`
 * are the natural keys that back those spoken forms. This module is the one
 * place the "number the user said" -> "row in the database" lookup lives,
 * so every kit/pack MCP tool (tickets 002/003) shares one implementation
 * instead of each re-deriving it.
 *
 * Both resolvers are pure lookups: no side effects, no dependency on any one
 * tool's argument shape. Each throws an explicit `NotFoundError` — which
 * `safeCall()` in `tools.ts` already turns into a tool-facing error message
 * — when the number doesn't resolve. Neither ever falls back to treating a
 * user-supplied number as a database id: that silent reinterpretation is
 * exactly the defect this sprint exists to close (see
 * `clasi/issues/mcp-tools-must-use-user-facing-identifiers-not-database-ids.md`).
 */
import { PrismaClient, Kit, Pack } from '@prisma/client';
import { NotFoundError, ValidationError } from '../services/errors';

/** A pack designator broken into its two spoken parts: kit number and pack number within that kit. */
export interface PackDesignator {
  kitNumber: number;
  packNumber: number;
}

/**
 * Resolve a kit by the number a user actually says (`Kit.number`), never by
 * database id. Throws `NotFoundError` — e.g. `Kit number 26 not found` —
 * when no kit has that number. There is no fallback path that reinterprets
 * `kitNumber` as `Kit.id`.
 */
export async function resolveKitByNumber(prisma: PrismaClient, kitNumber: number): Promise<Kit> {
  const kit = await prisma.kit.findUnique({ where: { number: kitNumber } });
  if (!kit) throw new NotFoundError(`Kit number ${kitNumber} not found`);
  return kit;
}

/**
 * Parse the combined `"kit_number/pack_number"` string form (e.g. `"26/1"`)
 * that matches both the label as printed and the way users say it aloud.
 * Throws `ValidationError` for anything that doesn't match that shape.
 */
export function parsePackDesignator(designator: string): PackDesignator {
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(designator);
  if (!match) {
    throw new ValidationError(
      `Invalid pack designator "${designator}" — expected "kit_number/pack_number", e.g. "26/1"`,
    );
  }
  return { kitNumber: Number(match[1]), packNumber: Number(match[2]) };
}

/**
 * Resolve a pack from either a structured `{kitNumber, packNumber}` pair or
 * the equivalent combined `"kit_number/pack_number"` string.
 *
 * Resolves the kit by number first, reusing `resolveKitByNumber`'s
 * not-found semantics, then looks up the `Pack` via the existing
 * `@@unique([kitId, displayNumber])` constraint. The two failure modes are
 * distinguishable: an unknown kit throws `Kit number <n> not found`; a kit
 * that exists but has no such pack throws `Pack <kitNumber>/<packNumber>
 * not found`.
 */
export async function resolvePackByDesignator(
  prisma: PrismaClient,
  designator: PackDesignator | string,
): Promise<Pack> {
  const { kitNumber, packNumber } =
    typeof designator === 'string' ? parsePackDesignator(designator) : designator;

  const kit = await resolveKitByNumber(prisma, kitNumber);

  const pack = await prisma.pack.findUnique({
    where: { kitId_displayNumber: { kitId: kit.id, displayNumber: packNumber } },
  });
  if (!pack) throw new NotFoundError(`Pack ${kitNumber}/${packNumber} not found`);
  return pack;
}
