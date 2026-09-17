export enum Role {
  USER = 'USER',
  CONTRIBUTOR = 'CONTRIBUTOR',
  TRUSTED_CONTRIBUTOR = 'TRUSTED_CONTRIBUTOR',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export type Permission =
  | 'place.read'
  | 'place.create'
  | 'place.edit'
  | 'contribution.review'
  | 'user.manage'
  | 'system.manage';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  USER: ['place.read'],
  CONTRIBUTOR: ['place.read', 'place.create'],
  TRUSTED_CONTRIBUTOR: ['place.read', 'place.create', 'place.edit'],
  MODERATOR: ['place.read', 'place.edit', 'contribution.review'],
  ADMIN: ['place.read', 'place.edit', 'contribution.review', 'user.manage'],
  SUPER_ADMIN: [
    'place.read',
    'place.edit',
    'contribution.review',
    'user.manage',
    'system.manage',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
