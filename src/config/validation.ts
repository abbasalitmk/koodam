import { Logger } from '@nestjs/common';

const logger = new Logger('ConfigValidation');

const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

const INSECURE_DEFAULTS = ['change-me', 'dev-access-secret', 'dev-refresh-secret'];

/**
 * Fails fast when the process is started in production without real secrets.
 * In development we only warn, so `docker compose up` keeps working out of the box.
 */
export function validateEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const isProduction = env.NODE_ENV === 'production';
  const problems: string[] = [];

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!env[key]) problems.push(`${key} is not set`);
  }

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = env[key];
    if (!value) continue;
    if (value.length < 32) problems.push(`${key} must be at least 32 characters`);
    if (INSECURE_DEFAULTS.some((d) => value.includes(d))) {
      problems.push(`${key} still uses a placeholder value`);
    }
  }

  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must differ');
  }

  if (problems.length > 0) {
    const message = `Invalid configuration:\n  - ${problems.join('\n  - ')}`;
    if (isProduction) throw new Error(message);
    logger.warn(`${message}\n(Continuing because NODE_ENV is not "production".)`);
  }

  return env;
}
