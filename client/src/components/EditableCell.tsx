import { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  as?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export default function EditableCell({
  value,
  onSave,
  className = '',
  inputClassName = '',
  as = 'text',
  options,
  placeholder,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  }

  if (!editing) {
    const displayValue = as === 'select' && options
      ? options.find((o) => o.value === value)?.label || value
      : value;
    return (
      <span
        className={`cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 ${className}`}
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {displayValue || <span className="text-gray-300 italic">{placeholder || 'empty'}</span>}
      </span>
    );
  }

  if (as === 'select' && options) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`px-1 py-0 border border-primary rounded text-sm bg-white ${inputClassName}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={as === 'number' ? 'number' : 'text'}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={`px-1 py-0 border border-primary rounded text-sm ${inputClassName}`}
      min={as === 'number' ? 1 : undefined}
      style={as === 'number' ? { width: '4rem' } : undefined}
    />
  );
}
