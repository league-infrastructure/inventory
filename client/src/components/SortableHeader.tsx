import { useState } from 'react';
import { ArrowUp, ArrowDown, Search, X } from 'lucide-react';
import type { SortDirection } from '../lib/useTableSort';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: { key: string; direction: SortDirection };
  onSort: (key: string) => void;
  filterValue?: string;
  onFilter?: (key: string, value: string) => void;
  className?: string;
}

export default function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  filterValue = '',
  onFilter,
  className = '',
}: SortableHeaderProps) {
  const [showSearch, setShowSearch] = useState(false);
  const isActive = currentSort.key === sortKey;
  const direction = isActive ? currentSort.direction : null;

  return (
    <th className={`text-left px-4 py-3 font-semibold text-gray-700 ${className}`}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="inline-flex items-center gap-1 bg-transparent border-none cursor-pointer p-0 font-semibold text-gray-700 hover:text-gray-900"
          onClick={() => onSort(sortKey)}
        >
          {label}
          <span className="inline-flex flex-col ml-0.5" style={{ lineHeight: 0 }}>
            <ArrowUp
              size={10}
              className={direction === 'asc' ? 'text-primary' : 'text-gray-300'}
            />
            <ArrowDown
              size={10}
              className={direction === 'desc' ? 'text-primary' : 'text-gray-300'}
            />
          </span>
        </button>
        {onFilter && (
          <button
            type="button"
            className={`bg-transparent border-none cursor-pointer p-0.5 rounded hover:bg-gray-100 ${
              filterValue ? 'text-primary' : 'text-gray-400'
            }`}
            onClick={() => setShowSearch(!showSearch)}
          >
            {filterValue ? <X size={12} onClick={(e) => { e.stopPropagation(); onFilter(sortKey, ''); setShowSearch(false); }} /> : <Search size={12} />}
          </button>
        )}
      </div>
      {showSearch && onFilter && (
        <input
          type="text"
          value={filterValue}
          onChange={(e) => onFilter(sortKey, e.target.value)}
          placeholder={`Filter ${label.toLowerCase()}...`}
          className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded font-normal text-gray-700"
          autoFocus
        />
      )}
    </th>
  );
}
