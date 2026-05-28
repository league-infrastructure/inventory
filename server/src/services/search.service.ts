import { PrismaClient } from '@prisma/client';

export interface SearchResult {
  type: 'kit' | 'pack' | 'item' | 'computer' | 'site' | 'user' | 'hostname' | 'category' | 'manufacturer';
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
    const results: SearchResult[] = [];

    // If query is a number, also search by kit number
    const queryNum = parseInt(query.trim(), 10);
    const kitNumberFilter = !isNaN(queryNum)
      ? [{ number: queryNum }]
      : [];

    const [kits, packs, items, computers, sites, users, hostNames, categories, manufacturers] = await Promise.all([
      this.prisma.kit.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            ...kitNumberFilter,
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { custodian: { displayName: { contains: query, mode: 'insensitive' } } },
            { custodian: { email: { contains: query, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          number: true,
          name: true,
          status: true,
          custodian: { select: { displayName: true } },
        },
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
            { modelNumber: { contains: query, mode: 'insensitive' } },
            { manufacturer: { contains: query, mode: 'insensitive' } },
            { mfg: { name: { contains: query, mode: 'insensitive' } } },
            { serialNumber: { contains: query, mode: 'insensitive' } },
            { serviceTag: { contains: query, mode: 'insensitive' } },
            { adminUsername: { contains: query, mode: 'insensitive' } },
            { studentUsername: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
            { hostName: { name: { contains: query, mode: 'insensitive' } } },
            { custodian: { displayName: { contains: query, mode: 'insensitive' } } },
            { custodian: { email: { contains: query, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          model: true,
          serialNumber: true,
          hostName: { select: { name: true } },
          kit: { select: { id: true, number: true, name: true } },
          custodian: { select: { displayName: true } },
        },
        take: limit,
      }),
      this.prisma.site.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        select: { id: true, name: true, address: true },
        take: limit,
      }),
      this.prisma.user.findMany({
        where: {
          OR: [
            { displayName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { googleId: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, displayName: true, email: true, role: true },
        take: limit,
      }),
      this.prisma.hostName.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { scheme: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, computerId: true },
        take: limit,
      }),
      this.prisma.category.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        select: { id: true, name: true },
        take: limit,
      }),
      this.prisma.manufacturer.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        select: { id: true, name: true },
        take: limit,
      }),
    ]);

    for (const k of kits) {
      results.push({
        type: 'kit',
        id: k.id,
        title: `#${k.number}: ${k.name}`,
        subtitle: k.custodian?.displayName ? `${k.status} • ${k.custodian.displayName}` : k.status,
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
    // Track kit IDs already in results to avoid duplicates
    const kitIdsInResults = new Set(kits.map(k => k.id));

    for (const c of computers) {
      results.push({
        type: 'computer',
        id: c.id,
        title: c.hostName?.name || c.model || `Computer #${c.id}`,
        subtitle: c.custodian?.displayName || c.serialNumber,
        url: `/computers/${c.id}`,
      });
      // Also surface the parent kit if this computer is in one
      if (c.kit && !kitIdsInResults.has(c.kit.id)) {
        kitIdsInResults.add(c.kit.id);
        results.push({
          type: 'kit',
          id: c.kit.id,
          title: `#${c.kit.number}: ${c.kit.name}`,
          subtitle: `contains ${c.hostName?.name || c.model || 'matched computer'}`,
          url: `/kits/${c.kit.id}`,
        });
      }
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
    for (const u of users) {
      results.push({
        type: 'user',
        id: u.id,
        title: u.displayName,
        subtitle: u.email || u.role,
        url: `/admin/users`,
      });
    }
    for (const h of hostNames) {
      results.push({
        type: 'hostname',
        id: h.id,
        title: h.name,
        subtitle: h.computerId ? 'Assigned to computer' : 'Unassigned',
        url: h.computerId ? `/computers/${h.computerId}` : '/hostnames',
      });
    }
    for (const c of categories) {
      results.push({
        type: 'category',
        id: c.id,
        title: c.name,
        subtitle: 'Category',
        url: '/admin/categories',
      });
    }
    for (const m of manufacturers) {
      results.push({
        type: 'manufacturer',
        id: m.id,
        title: m.name,
        subtitle: 'Manufacturer',
        url: '/admin/categories',
      });
    }

    return results.slice(0, limit);
  }
}
