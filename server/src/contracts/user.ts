export interface UserRecord {
  id: number;
  email: string | null;
  displayName: string;
  avatar: string | null;
  role: string;
  notes: string | null;
}

/** All valid user roles, ordered from lowest to highest privilege. */
export const USER_ROLES = ['CUSTODIAN', 'INSTRUCTOR', 'QUARTERMASTER', 'ADMIN', 'STUDENT', 'PARTNER'] as const;
export type UserRoleName = (typeof USER_ROLES)[number];

/** Staff roles that can log in via Google OAuth. */
export const STAFF_ROLES = new Set<string>(['CUSTODIAN', 'INSTRUCTOR', 'QUARTERMASTER', 'ADMIN']);

/** Loan-only roles that cannot log in via Google OAuth. */
export const LOANEE_ROLES = new Set<string>(['STUDENT', 'PARTNER']);

export const ROLE_LABELS: Record<UserRoleName, string> = {
  CUSTODIAN: 'Custodian',
  INSTRUCTOR: 'Instructor',
  QUARTERMASTER: 'Quartermaster',
  ADMIN: 'Admin',
  STUDENT: 'Student',
  PARTNER: 'Partner',
};

export const ROLE_SHORT_LABELS: Record<UserRoleName, string> = {
  CUSTODIAN: 'Cust',
  INSTRUCTOR: 'Inst',
  QUARTERMASTER: 'QM',
  ADMIN: 'Admin',
  STUDENT: 'Stu',
  PARTNER: 'Ptnr',
};

/** Returns true if the role has quartermaster-level access (QM or ADMIN). */
export function hasQMAccess(role: string): boolean {
  return role === 'QUARTERMASTER' || role === 'ADMIN';
}
