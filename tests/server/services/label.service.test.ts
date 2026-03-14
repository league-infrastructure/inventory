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
