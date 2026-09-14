import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'koodam:roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
