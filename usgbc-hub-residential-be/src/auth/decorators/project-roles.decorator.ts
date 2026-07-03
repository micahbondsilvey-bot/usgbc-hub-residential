import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from '../enums/role.enum';

export const PROJECT_ROLES_KEY = 'projectRoles';

/**
 * Declares which project roles may access a route (BR-Z3). Admin always passes
 * (BR-Z2 step 1). The route must expose a `:projectId` param for resolution.
 */
export const ProjectRoles = (...roles: ProjectRole[]) => SetMetadata(PROJECT_ROLES_KEY, roles);
