import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Marks a route/controller as restricted to the listed JWT `role` claims. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
