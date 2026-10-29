import { SetMetadata } from '@nestjs/common';
import type { Role } from '../common/interfaces/repository.interfaces';

export const IS_PUBLIC_KEY = 'isPublic';
/** Opts a route out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restricts a workspace route to members holding one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
