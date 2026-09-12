---
status: done
sprint: 008
tickets:
- 008-001
- 008-002
- 008-003
---

# MCP label generation for arbitrary sets of computers, kits, and packs

## Description

Label printing is currently reachable only through the web UI's REST routes,
and those routes are shaped around one object at a time or one kit at a time.
Quartermasters want to work conversationally through the Inventory MCP
connector: find a set of things — a filtered set of computers, several kits, or
a handful of packs that may belong to *different* kits — and get printable
label PDFs back without leaving the conversation.

Three specific workflows are wanted:

- Just the main label for a kit or pack.
- All labels for a kit (the kit label plus every pack label in it).
- An arbitrary ad-hoc set: a list of computers, or packs drawn from several
  different kits, or a mix.

## Cause

Most of the rendering machinery already exists in
`server/src/services/label.service.ts`, which renders every label type and
already batches computers from an arbitrary ID list. Three gaps block the
workflow:

1. **No label tools are registered in MCP at all.** `server/src/mcp/tools.ts`
   registers roughly 60 tools; none of them touch labels. The only access is
   the REST routes in `server/src/routes/labels.ts`.

2. **Pack batching is locked to a single kit.** `generateBatchLabels(kitId,
   packIds)` (`label.service.ts:447`) loads one kit and filters `packIds`
   against *that kit's* packs (`label.service.ts:470`). Packs from different
   kits cannot be requested together.

3. **`list_computers` exposes no filters.** The MCP tool takes an empty schema
   (`tools.ts:465`) even though `ComputerService.list()` already supports
   `siteId` / `kitId` / `disposition` / `unassigned`
   (`computer.service.ts:44`). "Search for a set of computers" therefore means
   dumping the entire fleet into context and filtering by hand.

A physical constraint shapes the output. Two incompatible label geometries are
hard-coded at `label.service.ts:10-17`:

| Stock | Size | Used by |
| --- | --- | --- |
| `102x59` | 102×59mm landscape | kit labels, pack labels |
| `89x28` | 89×28mm | compact computer labels |

A label printer feeds one roll at a time, so a single PDF mixing both page
sizes cannot be printed in one pass.

## Proposed fix

Stakeholder decisions already settled:

- **Delivery**: PDF embedded in the MCP response as a base64
  `BlobResourceContents` block. `@modelcontextprotocol/sdk` 1.27.1 supports
  this.
- **Selection**: explicit ID lists only. Searching stays in the existing
  `list_*` / `search` tools; the label tool just consumes IDs.
- **Mixed stock**: split into one PDF per stock size, never one mixed-page PDF.

### 1. `LabelService.generateLabelSet()` — the core change

In `server/src/services/label.service.ts`, add a selection-based entry point:

```ts
export type LabelStock = '102x59' | '89x28';

export interface LabelSelection {
  kitIds?: number[];
  packIds?: number[];
  computerIds?: number[];
  /** For each kitId, also emit a label for every pack in that kit. */
  includeKitPacks?: boolean;
}

export interface LabelBundle {
  stock: LabelStock;
  pdf: Buffer;
  labelCount: number;
  /** Ordered manifest of what is on each page, for the tool's text block. */
  contents: Array<{ type: 'kit' | 'pack' | 'computer'; id: number; caption: string }>;
}

async generateLabelSet(sel: LabelSelection): Promise<LabelBundle[]>
```

Reuse what is already there rather than writing new rendering code:

- Extract the page-emit loops from `generateBatchLabels` (`:447`) and
  `generateComputerBatchLabels` (`:401`) into two private builders that take
  **already-resolved records** and return a Buffer. The per-label drawing
  helpers — `addLabelContent`, `addCompactLabelContent`, `buildInfoLine`
  (`:359`), `generateQrBuffer` (`:46`), `createDoc` (`:54`),
  `createCompactDoc` (`:277`) — are unchanged and reused as-is.
- **Resolve packs individually**, not through their kit. This is the change
  that unlocks cross-kit selection:
  `prisma.pack.findUnique({ where: { id }, include: { kit: { select: { number: true } } } })`.
  The label caption stays `${kit.number}/${pack.displayNumber}`, matching
  `label.service.ts:479` exactly, so printed output is identical to today's.
- Keep the two existing public batch methods as thin wrappers over the new
  builders so current REST routes and the web UI keep working unchanged.

Ordering and hygiene:

- Dedupe IDs within each list; a pack named both directly and via
  `includeKitPacks` appears once.
- Stable order: kit labels by kit `number`, then pack labels by (kit number,
  `displayNumber`), then computers by host name.
- Unknown IDs throw `NotFoundError` naming the specific ID — matching existing
  behavior at `:418` and `:455`.
- Omit a bundle entirely when its stock has no labels; never return an empty
  PDF.

### 2. `generate_labels` MCP tool

In `server/src/mcp/tools.ts`, register alongside the other tools following the
established `registerTool` + `safeCall` + `getContext` pattern:

```ts
server.registerTool('generate_labels', {
  description:
    'Generate printable QR label PDFs for any mix of kits, packs, and computers. '
    + 'Packs may come from different kits. Returns one PDF per physical label '
    + 'stock size: kit and pack labels are 102x59mm, computer labels are 89x28mm. '
    + 'Find IDs first with list_kits / list_packs / list_computers.',
  inputSchema: {
    kit_ids: z.array(z.number()).optional(),
    pack_ids: z.array(z.number()).optional(),
    computer_ids: z.array(z.number()).optional(),
    include_kit_packs: z.boolean().optional(),
  },
}, ...)
```

Result shape — a text manifest plus one resource block per bundle:

```ts
{
  content: [
    { type: 'text', text: JSON.stringify({ bundles: [{ stock, labelCount, contents }] }, null, 2) },
    { type: 'resource', resource: {
        uri: `inventory://labels/${stock}.pdf`,
        mimeType: 'application/pdf',
        blob: bundle.pdf.toString('base64'),
    }},
  ],
}
```

Guards, because base64 inflates payloads by roughly a third and these pass
through the model's context window:

- **Cap total labels per call at 60.** Over the cap, return `toolError` stating
  the count and asking the caller to split the request. Do not silently
  truncate.
- Empty selection returns `toolError` naming the three accepted ID parameters.
- **Auth: `requireAuth` equivalent only — do _not_ call `requireQM()`.** This
  matches `routes/labels.ts`, where every label route uses `requireAuth` and
  none require Quartermaster.

### 3. Filters on `list_computers`

At `server/src/mcp/tools.ts:465`, replace the empty `{}` schema with
pass-through filters that `ComputerService.list()` already implements —
`site_id`, `kit_id`, `disposition`, `unassigned`. No service-layer change
needed. This turns "label every active computer in kit 17" into two calls
instead of a full-fleet dump.

### Files affected

| File | Change |
| --- | --- |
| `server/src/services/label.service.ts` | Add `generateLabelSet` and extract two private builders; existing methods become wrappers |
| `server/src/mcp/tools.ts` | Register `generate_labels`; add filters to `list_computers` |
| `tests/server/labels.test.ts` | Extend (currently 37 lines of auth-only smoke tests) |
| `tests/server/services/` | New unit tests for `generateLabelSet` |

No schema migration. No new dependencies — `pdfkit` and `qrcode` are already
direct dependencies of `server/package.json`.

### Accepted risk

Embedded base64 PDFs depend on the MCP client rendering or offering to save a
`resource` block. Claude.ai connector support for PDF blobs is less certain
than for plain text. If the blobs do not surface usefully in practice, the
fallback is a follow-up adding a short-lived signed URL to the manifest — the
service layer is unchanged by that, only the tool's result shape. Verify
against the live connector early.

## Verification

1. **Unit** — `npm run test:server`. New cases must cover: packs drawn from two
   different kits land in one 102×59 bundle with correct
   `kitNumber/displayNumber` captions; a mixed kit+computer selection returns
   exactly two bundles with the right `stock` values; a computer-only selection
   returns one 89×28 bundle; `includeKitPacks` expands correctly and dedupes
   against explicit `pack_ids`; an unknown ID throws `NotFoundError` naming
   that ID; an over-cap selection errors.
2. **Regression** — the existing REST routes in `routes/labels.ts` must produce
   byte-comparable output before and after the refactor for a fixed kit.
   Capture a baseline PDF from `POST /api/labels/kit/:id/batch-pdf` before
   changing anything and diff against it after.
3. **Live MCP** — through the Inventory connector: `list_kits`, then
   `generate_labels(kit_ids=[<id>], include_kit_packs=true)`, then a cross-kit
   call with `pack_ids` from two different kits, then a mixed kits+computers
   call. Confirm two bundles come back and each PDF opens at the right physical
   size.
4. **Print check** — print one 102×59 and one 89×28 page on real label stock
   and confirm alignment is unchanged from today's output.

## Related

- `server/src/services/label.service.ts` — existing label rendering, 640 lines
- `server/src/routes/labels.ts` — existing REST label endpoints
- `server/src/mcp/tools.ts` — MCP tool registry
- `server/src/services/computer.service.ts` — `list()` filters already built
