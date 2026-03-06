import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface ColumnFilter {
  [key: string]: string;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

export function useTableSort<T>(data: T[], defaultSort?: { key: string; direction: 'asc' | 'desc' }) {
  const [sort, setSort] = useState<SortState>(
    defaultSort ? { key: defaultSort.key, direction: defaultSort.direction } : { key: '', direction: null }
  );
  const [filters, setFilters] = useState<ColumnFilter>({});

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: '', direction: null };
    });
  }

  function setFilter(key: string, value: string) {
    setFilters((prev) => {
      if (!value) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  }

  const processed = useMemo(() => {
    let result = [...data];

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;
      const lower = value.toLowerCase();
      result = result.filter((item) => {
        const v = getNestedValue(item, key);
        if (v == null) return false;
        return String(v).toLowerCase().includes(lower);
      });
    }

    // Apply sort
    if (sort.key && sort.direction) {
      result.sort((a, b) => {
        const aVal = getNestedValue(a, sort.key);
        const bVal = getNestedValue(b, sort.key);
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const cmp = typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' });
        return sort.direction === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, sort, filters]);

  return { processed, sort, toggleSort, filters, setFilter };
}
