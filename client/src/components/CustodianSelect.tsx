import { STAFF_ROLES } from '../lib/roles';

export interface CustodianUser {
  id: number;
  displayName: string;
  role: string;
}

interface CustodianSelectProps {
  users: CustodianUser[];
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  unassignedLabel?: string;
  className?: string;
  disabled?: boolean;
}

function byName(a: CustodianUser, b: CustodianUser) {
  return a.displayName.localeCompare(b.displayName);
}

/**
 * Native <select> for picking a custodian. Renders staff users alphabetically
 * first, then a disabled divider option, then STUDENT/PARTNER (loanee) users
 * alphabetically. The blank option maps to onChange(null).
 */
export default function CustodianSelect({
  users,
  value,
  onChange,
  unassignedLabel = '—',
  className,
  disabled,
}: CustodianSelectProps) {
  const staff = users.filter((u) => STAFF_ROLES.has(u.role)).sort(byName);
  const loanees = users.filter((u) => !STAFF_ROLES.has(u.role)).sort(byName);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    onChange(v === '' ? null : parseInt(v, 10));
  }

  return (
    <select
      value={value ?? ''}
      onChange={handleChange}
      className={className}
      disabled={disabled}
    >
      <option value="">{unassignedLabel}</option>
      {staff.map((u) => (
        <option key={u.id} value={u.id}>
          {u.displayName}
        </option>
      ))}
      {staff.length > 0 && loanees.length > 0 && (
        <option disabled>──────</option>
      )}
      {loanees.map((u) => (
        <option key={u.id} value={u.id}>
          {u.displayName}
        </option>
      ))}
    </select>
  );
}
