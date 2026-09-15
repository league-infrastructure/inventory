import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
// fontkit is pdfkit's own TrueType-parsing dependency (already installed
// transitively via pdfkit) — used here to open the bundled TTFs directly
// and confirm they contain real outlines for the accented characters this
// ticket exists to fix, independent of anything label.service.ts does.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fontkit = require('fontkit');
import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { LabelService } from '../../../server/src/services/label.service';

const FONTS_DIR = path.join(__dirname, '../../../server/src/assets/fonts');
const REGULAR_TTF = path.join(FONTS_DIR, 'LiberationSans-Regular.ttf');
const BOLD_TTF = path.join(FONTS_DIR, 'LiberationSans-Bold.ttf');
const LICENSE_FILE = path.join(FONTS_DIR, 'LICENSE-LiberationSans.txt');

// The registered PDFKit font names label.service.ts uses in place of the
// built-in 'Helvetica' / 'Helvetica-Bold' — see the acceptance criteria's
// own example names in ticket 001.
const FONT_REGULAR = 'LabelSans';
const FONT_BOLD = 'LabelSans-Bold';

const UNICODE_NAME = 'Erdős'; // contains U+0151 (o with double acute), outside WinAnsi

/**
 * Pairs up jest.spyOn(PDFDocument.prototype, 'font') and '...text' calls in
 * true chronological order (via each mock call's invocationCallOrder) and
 * returns, for every .text() invocation, whichever font name was most
 * recently selected before it.
 *
 * This is needed instead of a flat "fontSpy.mock.calls should never contain
 * Helvetica" check because PDFDocument's own constructor calls
 * this.font('Helvetica') once internally (pdfkit's FontsMixin.initFonts()
 * default) before label.service.ts ever runs — harmless, since no .text()
 * call happens while that default is still active, but it does mean
 * 'Helvetica' legitimately appears once in the raw call list regardless of
 * this ticket's fix. What actually matters is the font active at each
 * *rendered* string, which is what this helper isolates.
 */
function activeFontPerTextCall(
  fontSpy: jest.SpyInstance,
  textSpy: jest.SpyInstance,
): unknown[] {
  const fontCalls = fontSpy.mock.calls.map((args, i) => ({
    order: fontSpy.mock.invocationCallOrder[i],
    name: args[0],
  }));
  const textOrders = textSpy.mock.invocationCallOrder;

  return textOrders.map((textOrder) => {
    const priorFontCalls = fontCalls.filter((f) => f.order < textOrder);
    return priorFontCalls.length > 0 ? priorFontCalls[priorFontCalls.length - 1].name : undefined;
  });
}

let siteId: number;
let kitId: number;
let computerId: number;
let labelService: LabelService;

beforeAll(async () => {
  await setupTestUser();
  const reg = getRegistry();
  const uid = getUserId();

  const site = await reg.sites.create({ name: `svc-test-${getSuffix()}-fonts-site` }, uid);
  siteId = site.id;

  const kit = await reg.kits.create({
    number: (getSuffix() % 100000) + 900,
    name: `Kit ${UNICODE_NAME}`,
    siteId,
  }, uid);
  kitId = kit.id;

  const computer = await reg.computers.create({
    model: `svc-test-${getSuffix()}-fonts-computer`,
    serialNumber: 'SN-FONTS-TEST',
    kitId,
    siteId,
  }, uid);
  computerId = computer.id;
  await getPrisma().hostName.create({ data: { name: UNICODE_NAME, computerId } });

  labelService = new LabelService(getPrisma(), 'http://test.example.com');
});

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.hostName.deleteMany({ where: { computerId } });
  await prisma.computer.deleteMany({ where: { id: computerId } });
  await prisma.kit.deleteMany({ where: { id: kitId } });
  await prisma.site.deleteMany({ where: { id: siteId } });
  await teardown();
});

describe('LabelService — bundled Unicode font', () => {
  it('ships LiberationSans-Regular.ttf, LiberationSans-Bold.ttf, and a license file under server/src/assets/fonts', () => {
    expect(fs.existsSync(REGULAR_TTF)).toBe(true);
    expect(fs.existsSync(BOLD_TTF)).toBe(true);
    expect(fs.existsSync(LICENSE_FILE)).toBe(true);
    // Sanity: these are real TTFs, not empty/placeholder files.
    expect(fs.statSync(REGULAR_TTF).size).toBeGreaterThan(100_000);
    expect(fs.statSync(BOLD_TTF).size).toBeGreaterThan(100_000);
  });

  it('both bundled faces contain a real (non-.notdef) glyph for every character in "Erdős"', () => {
    for (const ttfPath of [REGULAR_TTF, BOLD_TTF]) {
      const font = fontkit.openSync(ttfPath);
      for (const ch of UNICODE_NAME) {
        const codePoint = ch.codePointAt(0)!;
        const glyph = font.glyphForCodePoint(codePoint);
        // Glyph id 0 is the .notdef ("missing glyph") box — the exact
        // failure mode this ticket fixes ("Erd 0" instead of "Erdős").
        expect(glyph.id).not.toBe(0);
      }
    }
  });

  it('registers the bundled fonts under LabelSans / LabelSans-Bold and uses only those (never Helvetica) for every rendered string on a kit label', async () => {
    // addLabelContent/addCompactLabelContent are only reachable through
    // the public generate* methods, so drive one of each label size and
    // capture the exact font names PDFKit was told to switch to.
    const fontSpy = jest.spyOn(PDFDocument.prototype, 'font');
    const textSpy = jest.spyOn(PDFDocument.prototype, 'text');
    let fontNames: unknown[];
    let activeFonts: unknown[];
    try {
      await labelService.generateKitLabel(kitId);
      fontNames = fontSpy.mock.calls.map((args) => args[0]);
      activeFonts = activeFontPerTextCall(fontSpy, textSpy);
    } finally {
      fontSpy.mockRestore();
      textSpy.mockRestore();
    }

    // Both faces were registered and used at least once...
    expect(fontNames).toEqual(expect.arrayContaining([FONT_REGULAR, FONT_BOLD]));
    // ...and every actual rendered string used one of them, never
    // PDFKit's built-in Helvetica (which pdfkit itself selects once,
    // internally, before construction hands control to our code — see
    // activeFontPerTextCall's doc comment).
    expect(activeFonts.length).toBeGreaterThan(0);
    for (const font of activeFonts) {
      expect([FONT_REGULAR, FONT_BOLD]).toContain(font);
    }
  });

  it('kit/pack (102x59) label renders "Erdős" unmangled, using the registered font', async () => {
    const fontSpy = jest.spyOn(PDFDocument.prototype, 'font');
    const textSpy = jest.spyOn(PDFDocument.prototype, 'text');
    let renderedStrings: string[];
    let activeFonts: unknown[];
    try {
      await labelService.generateKitLabel(kitId);
      renderedStrings = textSpy.mock.calls
        .map((args) => args[0])
        .filter((s): s is string => typeof s === 'string');
      activeFonts = activeFontPerTextCall(fontSpy, textSpy);
    } finally {
      fontSpy.mockRestore();
      textSpy.mockRestore();
    }

    // The exact, unmangled name string reached the renderer...
    expect(renderedStrings.some((s) => s.includes(UNICODE_NAME))).toBe(true);
    // ...and every rendered string (including the name) used the bundled
    // Unicode font, never PDFKit's built-in WinAnsi-only Helvetica.
    for (const font of activeFonts) {
      expect([FONT_REGULAR, FONT_BOLD]).toContain(font);
    }
  });

  it('computer (89x28) label renders "Erdős" unmangled, using the registered font', async () => {
    const fontSpy = jest.spyOn(PDFDocument.prototype, 'font');
    const textSpy = jest.spyOn(PDFDocument.prototype, 'text');
    let renderedStrings: string[];
    let activeFonts: unknown[];
    try {
      await labelService.generateComputerLabel89x28(computerId);
      renderedStrings = textSpy.mock.calls
        .map((args) => args[0])
        .filter((s): s is string => typeof s === 'string');
      activeFonts = activeFontPerTextCall(fontSpy, textSpy);
    } finally {
      fontSpy.mockRestore();
      textSpy.mockRestore();
    }

    expect(renderedStrings).toContain(UNICODE_NAME);
    for (const font of activeFonts) {
      expect([FONT_REGULAR, FONT_BOLD]).toContain(font);
    }
  });

  it('produces valid, non-empty PDFs for both label sizes with the Unicode name', async () => {
    const kitPdf = await labelService.generateKitLabel(kitId);
    const computerPdf = await labelService.generateComputerLabel89x28(computerId);

    expect(kitPdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(computerPdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(kitPdf.length).toBeGreaterThan(100);
    expect(computerPdf.length).toBeGreaterThan(100);
  });
});
