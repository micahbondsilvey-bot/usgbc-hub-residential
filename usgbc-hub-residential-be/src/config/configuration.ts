/**
 * Central typed configuration loaded from environment variables.
 * Legacy seed formats are accepted; new hybrid-RBAC seed format is
 * `email|password|globalRole` triples separated by `;`.
 */

export interface SeedUser {
  email: string;
  password: string;
  globalRole: 'admin' | 'user';
}

export interface AppConfig {
  app: {
    port: number;
    nodeEnv: string;
    frontendOrigin: string;
    mockAuth: boolean;
  };
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    poolSize: number;
    idleTimeoutMs: number;
    synchronize: boolean;
  };
  redis: {
    host: string;
    port: number;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtIssuer: string;
    passwordResetTtl: string;
    emailVerificationTtl: string;
    invitationTtl: string;
  };
  throttle: {
    loginPerMin: number;
    loginPerHr: number;
    resetPerMin: number;
    resetPerHr: number;
    inviteAcceptPerMin: number;
    inviteAcceptPerHr: number;
  };
  seed: {
    users: SeedUser[];
  };
  pbt: {
    runs: number;
    seed?: number;
  };
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

function parseSeedUsers(raw: string | undefined): SeedUser[] {
  if (!raw) return [];
  return raw
    .split(';')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const [email, password, role] = chunk.split('|');
      const globalRole = (role ?? 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
      return {
        email: (email ?? '').trim().toLowerCase(),
        password: (password ?? '').trim(),
        globalRole,
      } as SeedUser;
    })
    .filter((u) => u.email.length > 0 && u.password.length > 0);
}

export default (): AppConfig => ({
  app: {
    port: toInt(process.env.APP_PORT, 3000),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200',
    mockAuth: toBool(process.env.MOCK_AUTH, true),
  },
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toInt(process.env.DB_PORT, 5433),
    user: process.env.DB_USER ?? 'usgbc',
    password: process.env.DB_PASSWORD ?? 'usgbc',
    name: process.env.DB_NAME ?? 'usgbc_hub_residential',
    poolSize: toInt(process.env.DB_POOL_SIZE, 10),
    idleTimeoutMs: toInt(process.env.DB_IDLE_TIMEOUT_MS, 30000),
    synchronize: toBool(process.env.DB_SYNCHRONIZE, true),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
  },
  auth: {
    jwtSecret: process.env.LOCAL_JWT_SECRET ?? 'change-me-in-real-envs',
    jwtExpiresIn: process.env.LOCAL_JWT_EXPIRES_IN ?? '8h',
    jwtIssuer: process.env.LOCAL_JWT_ISSUER ?? 'usgbc-hub-residential-be',
    passwordResetTtl: process.env.PASSWORD_RESET_TTL ?? '1h',
    emailVerificationTtl: process.env.EMAIL_VERIFICATION_TTL ?? '7d',
    invitationTtl: process.env.INVITATION_TTL ?? '7d',
  },
  throttle: {
    loginPerMin: toInt(process.env.THROTTLE_LOGIN_PER_MIN, 10),
    loginPerHr: toInt(process.env.THROTTLE_LOGIN_PER_HR, 30),
    resetPerMin: toInt(process.env.THROTTLE_RESET_PER_MIN, 5),
    resetPerHr: toInt(process.env.THROTTLE_RESET_PER_HR, 20),
    inviteAcceptPerMin: toInt(process.env.THROTTLE_INVITE_ACCEPT_PER_MIN, 10),
    inviteAcceptPerHr: toInt(process.env.THROTTLE_INVITE_ACCEPT_PER_HR, 30),
  },
  seed: {
    users: parseSeedUsers(process.env.SEED_USERS),
  },
  pbt: {
    runs: toInt(process.env.FAST_CHECK_RUNS, 100),
    seed: process.env.FAST_CHECK_SEED ? toInt(process.env.FAST_CHECK_SEED, 0) : undefined,
  },
});
