import { PrismaClient } from '@prisma/client';

export interface SearchResult {
  type: 'kit' | 'pack' | 'item' | 'computer' | 'site';
  id: number;
  title: string;
  subtitle: string | null;
  url: string;
}

export class SearchService {
  constructor(private prisma: PrismaClient) {}

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const trimmed = query?.trim();
    if (!trimmed || (trimmed.length < 2 && isNaN(parseInt(trimmed, 10)))) return [];
    const q = `%${query.trim()}%`;
    const results: SearchResult[] = [];

    // If query is a number, also search by kit number
    const queryNum = parseInt(query.trim(), 10);
    const kitNumberFilter = !isNaN(queryNum)
      ? [{ number: queryNum }]
      : [];

    const [kits, packs, items, computers, sites] = await Promise.all([
      this.prisma.kit.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            ...kitNumberFilter,
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, number: true, name: true, status: true },
        take: limit,
      }),
      this.prisma.pack.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, kit: { select: { number: true, name: true } } },
        take: limit,
      }),
      this.prisma.item.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        select: { id: true, name: true, pack: { select: { name: true } } },
        take: limit,
      }),
      this.prisma.computer.findMany({
        where: {
          OR: [
            { model: { contains: query, mode: 'insensitive' } },
            { serialNumber: { contains: query, mode: 'insensitive' } },
            { serviceTag: { contains: query, mode: 'insensitive' } },
            { hostName: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        select: { id: true, model: true, serialNumber: true, hostName: { select: { name: true } } },
        take: limit,
      }),
      this.prisma.site.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        select: { id: true, name: true, address: true },
        take: limit,
      }),
    ]);

    for (const k of kits) {
      results.push({
        type: 'kit',
        id: k.id,
        title: `#${k.number}: ${k.name}`,
        subtitle: k.status,
        url: `/kits/${k.id}`,
      });
    }
    for (const p of packs) {
      results.push({
        type: 'pack',
        id: p.id,
        title: p.name,
        subtitle: `in #${p.kit.number}: ${p.kit.name}`,
        url: `/packs`,
      });
    }
    for (const i of items) {
      results.push({
        type: 'item',
        id: i.id,
        title: i.name,
        subtitle: `Pack: ${i.pack.name}`,
        url: `/packs`,
      });
    }
    for (const c of computers) {
      results.push({
        type: 'computer',
        id: c.id,
        title: c.hostName?.name || c.model || `Computer #${c.id}`,
        subtitle: c.serialNumber,
        url: `/computers/${c.id}`,
      });
    }
    for (const s of sites) {
      results.push({
        type: 'site',
        id: s.id,
        title: s.name,
        subtitle: s.address,
        url: `/sites`,
      });
    }

    return results.slice(0, limit);
  }
}
