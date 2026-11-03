import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from '@clinic/shared';

export const ROLES_KEY = 'roles';

/** Restrict a route to one or more staff roles. Use with `RolesGuard`. */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);
