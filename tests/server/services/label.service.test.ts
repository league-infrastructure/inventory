import PDFDocument from 'pdfkit';
import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { LabelService } from '../../../server/src/services/label.service';

let siteId: number;
let kitId: number;
let packId: number;
let computerId: number;
let labelService: LabelService;

beforeAll(async () => {
  await setupTestUser();
  const reg = getRegistry();
  const uid = getUserId();

  const site = await reg.sites.create({ name: `svc-test-${getSuffix()}-lbl-site` }, uid);
  siteId = site.id;

  const kit = await reg.kits.create({
    number: (getSuffix() % 100000) + 700,
    name: `svc-test-${getSuffix()}-lbl-kit`,
    siteId,
  }, uid);
  kitId = kit.id;

  const pack = await reg.packs.create({ name: `svc-test-${getSuffix()}-lbl-pack` }, uid, kitId);
  packId = pack.id;

  const computer = await reg.computers.create({
    model: `svc-test-${getSuffix()}-lbl-computer`,
    serialNumber: 'SN-TEST-123',
    kitId,
    siteId,
  }, uid);
  computerId = computer.id;

  labelService = new LabelService(getPrisma(), 'http://test.example.com');
});

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.item.deleteMany({ where: { packId } });
  await prisma.pack.deleteMany({ where: { kitId } });
  await prisma.computer.deleteMany({ where: { id: computerId } });
  await prisma.kit.deleteMany({ where: { id: kitId } });
  await prisma.site.deleteMany({ where: { id: siteId } });
  await teardown();
});

describe('LabelService', () => {
  it('generates a kit label PDF', async () => {
    const pdf = await labelService.generateKitLabel(kitId);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(100);
    // Check PDF header
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('generates a pack label PDF', async () => {
    const pdf = await labelService.generatePackLabel(packId);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('generates a computer label PDF', async () => {
    const pdf = await labelService.generateComputerLabel(computerId);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('generates batch labels PDF', async () => {
    const pdf = await labelService.generateBatchLabels(kitId, [packId]);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // Batch should be larger than single label (kit + pack)
    const singleKit = await labelService.generateKitLabel(kitId);
    expect(pdf.length).toBeGreaterThan(singleKit.length);
  });

  it('throws NotFoundError for nonexistent kit', async () => {
    await expect(labelService.generateKitLabel(999999)).rejects.toThrow('Kit not found');
  });

  it('throws NotFoundError for nonexistent pack', async () => {
    await expect(labelService.generatePackLabel(999999)).rejects.toThrow('Pack not found');
  });

  it('throws NotFoundError for nonexistent computer', async () => {
    await expect(labelService.generateComputerLabel(999999)).rejects.toThrow('Computer not found');
  });

  it('generates a compact (89x28mm) computer label PDF', async () => {
    const pdf = await labelService.generateComputerLabel89x28(computerId);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(100);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('generates batch compact computer labels PDF', async () => {
    const pdf = await labelService.generateComputerBatchLabels([computerId]);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('throws for empty computerIds in batch', async () => {
    await expect(labelService.generateComputerBatchLabels([])).rejects.toThrow('No computer IDs provided');
  });

  it('throws NotFoundError for nonexistent computer in compact label', async () => {
    await expect(labelService.generateComputerLabel89x28(999999)).rejects.toThrow('Computer not found');
  });

  it('handles computer with missing optional fields in compact label', async () => {
    // The test computer has a model and serial but no hostname, username, or password
    // It should still generate a valid PDF
    const pdf = await labelService.generateComputerLabel89x28(computerId);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('LabelService — displayNumber correctness after a renumber', () => {
  let kitNumber: number;
  let divergentKitId: number;
  let packA: number;
  let packB: number;
  let packC: number;

  // Spy on PDFDocument.prototype.text (call-through, not mocked) so we can
  // inspect exactly what number string was handed to the PDF renderer,
  // without altering the actual PDF output.
  function captureRenderedNumbers(spy: jest.SpyInstance): string[] {
    return spy.mock.calls
      .map((args) => args[0])
      .filter((arg): arg is string => typeof arg === 'string' && /^\d+\/\d+$/.test(arg));
  }

  beforeAll(async () => {
    const reg = getRegistry();
    const uid = getUserId();

    kitNumber = (getSuffix() % 100000) + 750;
    const kit = await reg.kits.create({
      number: kitNumber,
      name: `svc-test-${getSuffix()}-lbl-divergent-kit`,
      siteId,
    }, uid);
    divergentKitId = kit.id;

    // Created in order A, B, C — so id order is A < B < C.
    const pA = await reg.packs.create({ name: 'Alpha' }, uid, divergentKitId);
    const pB = await reg.packs.create({ name: 'Bravo' }, uid, divergentKitId);
    const pC = await reg.packs.create({ name: 'Charlie' }, uid, divergentKitId);
    packA = pA.id;
    packB = pB.id;
    packC = pC.id;

    // Renumber so displayNumber order diverges from id order:
    // C -> 1, A -> 2, B -> 3 (id order is still A, B, C).
    await reg.packs.renumber(divergentKitId, packC, 1, uid);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.item.deleteMany({ where: { packId: { in: [packA, packB, packC] } } });
    await prisma.auditLog.deleteMany({ where: { objectType: 'Pack', objectId: { in: [packA, packB, packC] } } });
    await prisma.pack.deleteMany({ where: { kitId: divergentKitId } });
    await prisma.kit.deleteMany({ where: { id: divergentKitId } });
  });

  it('confirms the renumber actually diverged id order from displayNumber order', async () => {
    const packs = await getPrisma().pack.findMany({ where: { kitId: divergentKitId } });
    const byId = new Map(packs.map((p) => [p.id, p.displayNumber]));
    expect(byId.get(packC)).toBe(1);
    expect(byId.get(packA)).toBe(2);
    expect(byId.get(packB)).toBe(3);
  });

  it('generatePackLabel renders the persisted displayNumber, not an id-order-derived sequence', async () => {
    const textSpy = jest.spyOn(PDFDocument.prototype, 'text');
    let numbers: string[];
    try {
      await labelService.generatePackLabel(packA);
      // Capture before mockRestore() — mockRestore() implies mockReset(),
      // which clears mock.calls.
      numbers = captureRenderedNumbers(textSpy);
    } finally {
      textSpy.mockRestore();
    }

    // packA is first by id (would be "1" under the old id-order sequence)
    // but its persisted displayNumber is 2.
    expect(numbers).toContain(`${kitNumber}/2`);
    expect(numbers).not.toContain(`${kitNumber}/1`);
  });

  it('generateBatchLabels renders each selected pack\'s displayNumber, not an id-order index', async () => {
    const textSpy = jest.spyOn(PDFDocument.prototype, 'text');
    let numbers: string[];
    try {
      await labelService.generateBatchLabels(divergentKitId, [packA, packB, packC], false);
      numbers = captureRenderedNumbers(textSpy);
    } finally {
      textSpy.mockRestore();
    }

    expect(numbers).toContain(`${kitNumber}/2`); // packA
    expect(numbers).toContain(`${kitNumber}/3`); // packB
    expect(numbers).toContain(`${kitNumber}/1`); // packC
  });

  it('generateBatchHtml renders each selected pack\'s displayNumber, not an id-order index', async () => {
    const html = await labelService.generateBatchHtml(divergentKitId, [packA, packB, packC], false);

    expect(html).toContain(`<div class="number">${kitNumber}/2</div>`); // packA
    expect(html).toContain(`<div class="number">${kitNumber}/3</div>`); // packB
    expect(html).toContain(`<div class="number">${kitNumber}/1</div>`); // packC
  });
});
