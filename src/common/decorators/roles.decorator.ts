import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Usage: @Roles('admin') on a controller or handler, paired with RolesGuard.
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
