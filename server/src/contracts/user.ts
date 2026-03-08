export interface UserRecord {
  id: number;
  email: string;
  displayName: string;
  avatar: string | null;
  role: string;
}

/** All valid user roles, ordered from lowest to highest privilege. */
export const USER_ROLES = ['CUSTODIAN', 'INSTRUCTOR', 'QUARTERMASTER', 'ADMIN'] as const;
export type UserRoleName = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRoleName, string> = {
  CUSTODIAN: 'Custodian',
  INSTRUCTOR: 'Instructor',
  QUARTERMASTER: 'Quartermaster',
  ADMIN: 'Admin',
};

export const ROLE_SHORT_LABELS: Record<UserRoleName, string> = {
  CUSTODIAN: 'Cust',
  INSTRUCTOR: 'Inst',
  QUARTERMASTER: 'QM',
  ADMIN: 'Admin',
};

/** Returns true if the role has quartermaster-level access (QM or ADMIN). */
export function hasQMAccess(role: string): boolean {
  return role === 'QUARTERMASTER' || role === 'ADMIN';
}
