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

export const ROLE_BADGE_STYLES: Record<UserRoleName, string> = {
  ADMIN: 'bg-purple-50 text-purple-700',
  QUARTERMASTER: 'bg-blue-50 text-blue-700',
  INSTRUCTOR: 'bg-green-50 text-green-700',
  CUSTODIAN: 'bg-gray-100 text-gray-600',
  STUDENT: 'bg-yellow-50 text-yellow-700',
  PARTNER: 'bg-orange-50 text-orange-700',
};

/** Returns true if the role has quartermaster-level access (QM or ADMIN). */
export function hasQMAccess(role: string): boolean {
  return role === 'QUARTERMASTER' || role === 'ADMIN';
}
