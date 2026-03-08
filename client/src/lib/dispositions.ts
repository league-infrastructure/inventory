export const DISPOSITIONS = [
  'ACTIVE', 'LOANED', 'NEEDS_REPAIR', 'IN_REPAIR',
  'SCRAPPED', 'LOST', 'DECOMMISSIONED',
] as const;

export const INACTIVE_DISPOSITIONS = [
  'NEEDS_REPAIR', 'IN_REPAIR', 'SCRAPPED', 'LOST', 'DECOMMISSIONED',
] as const;

export function dispositionClasses(d: string): string {
  switch (d) {
    case 'ACTIVE': return 'bg-green-100 text-green-700';
    case 'LOANED': return 'bg-blue-100 text-blue-700';
    case 'NEEDS_REPAIR': return 'bg-amber-100 text-amber-700';
    case 'IN_REPAIR': return 'bg-orange-100 text-orange-700';
    case 'SCRAPPED': return 'bg-gray-100 text-gray-600';
    case 'LOST': return 'bg-red-100 text-red-700';
    case 'DECOMMISSIONED': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-600';
  }
}
