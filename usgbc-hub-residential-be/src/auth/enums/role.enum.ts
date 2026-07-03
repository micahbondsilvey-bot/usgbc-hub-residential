/**
 * Hybrid RBAC roles (BR-Z1, Application Design Q1=C).
 * - GlobalRole: platform-wide identity role carried on the User and JWT.
 * - ProjectRole: per-project role resolved from ProjectMembership at request time.
 */

export enum GlobalRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum ProjectRole {
  PROJECT_TEAM = 'PROJECT_TEAM',
  GREEN_RATER = 'GREEN_RATER',
  REVIEWER = 'REVIEWER',
}

/** Legacy aliases retained for continuity with the prototype. */
export const Role = GlobalRole;
