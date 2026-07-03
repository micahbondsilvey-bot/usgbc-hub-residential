import { ProjectRole } from './role.enum';

/**
 * Foundation-level permissions (BR-Z3). Other units extend this matrix.
 * The map is keyed off project roles; Admin bypasses these checks entirely
 * (handled in ProjectRolesGuard / BR-Z2 step 1).
 */
export enum Permission {
  READ_MEMBERSHIP = 'READ_MEMBERSHIP',
  INVITE_TEAM_ROLE = 'INVITE_TEAM_ROLE',
  INVITE_REVIEWER_ROLE = 'INVITE_REVIEWER_ROLE',
  REVOKE_INVITE = 'REVOKE_INVITE',
  REVOKE_MEMBERSHIP = 'REVOKE_MEMBERSHIP',
}

/** Project roles allowed to exercise each foundation permission. */
export const PERMISSION_MATRIX: Record<Permission, ProjectRole[]> = {
  [Permission.READ_MEMBERSHIP]: [
    ProjectRole.PROJECT_TEAM,
    ProjectRole.GREEN_RATER,
    ProjectRole.REVIEWER,
  ],
  [Permission.INVITE_TEAM_ROLE]: [ProjectRole.PROJECT_TEAM, ProjectRole.GREEN_RATER],
  // Reviewer invites are Admin-only — no project role grants this.
  [Permission.INVITE_REVIEWER_ROLE]: [],
  // Inviter-or-Admin is enforced in the service; any active member may attempt.
  [Permission.REVOKE_INVITE]: [
    ProjectRole.PROJECT_TEAM,
    ProjectRole.GREEN_RATER,
    ProjectRole.REVIEWER,
  ],
  // Membership revoke is Admin-only.
  [Permission.REVOKE_MEMBERSHIP]: [],
};
