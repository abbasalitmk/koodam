export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  appName: string;
  appUrl: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  eventAutoPublish: boolean;
}

export interface JwtConfig {
  secret: string;
  refreshSecret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

export interface OtpConfig {
  length: number;
  ttlSeconds: number;
  maxAttempts: number;
  provider: 'console' | 'whatsapp' | 'twilio';
  whatsappToken?: string;
  whatsappPhoneNumberId?: string;
}

export interface StorageConfig {
  provider: 'local' | 's3';
  endpoint?: string;
  region: string;
  bucket: string;
  accessKey?: string;
  secretKey?: string;
  publicUrl: string;
}

export interface DiscoveryConfig {
  ghostRadiusMinM: number;
  ghostRadiusMaxM: number;
  defaultRadiusKm: number;
  maxRadiusKm: number;
  loveRequestTtlHours: number;
  requiredVouches: number;
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value.toLowerCase() === 'true';

export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: toInt(process.env.PORT, 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    appName: process.env.APP_NAME ?? 'Koodam',
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((o) => o.trim()),
    swaggerEnabled: toBool(process.env.SWAGGER_ENABLED, true),
    eventAutoPublish: toBool(process.env.EVENT_AUTO_PUBLISH, true),
  } satisfies AppConfig,

  database: { url: process.env.DATABASE_URL ?? '' },
  redis: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-access-secret-change-me-please-32ch',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-32chars',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  } satisfies JwtConfig,

  otp: {
    length: toInt(process.env.OTP_LENGTH, 6),
    ttlSeconds: toInt(process.env.OTP_TTL_SECONDS, 300),
    maxAttempts: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
    provider: (process.env.OTP_PROVIDER ?? 'console') as OtpConfig['provider'],
    whatsappToken: process.env.WHATSAPP_TOKEN,
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  } satisfies OtpConfig,

  storage: {
    provider: (process.env.STORAGE_PROVIDER ?? 'local') as StorageConfig['provider'],
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION ?? 'ap-south-1',
    bucket: process.env.STORAGE_BUCKET ?? 'koodam-media',
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
    publicUrl: process.env.STORAGE_PUBLIC_URL ?? 'http://localhost:3000/static',
  } satisfies StorageConfig,

  payment: {
    provider: process.env.PAYMENT_PROVIDER ?? 'mock',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  push: {
    provider: process.env.PUSH_PROVIDER ?? 'noop',
    fcmProjectId: process.env.FCM_PROJECT_ID,
    fcmClientEmail: process.env.FCM_CLIENT_EMAIL,
    fcmPrivateKey: process.env.FCM_PRIVATE_KEY,
  },

  discovery: {
    ghostRadiusMinM: toInt(process.env.GHOST_RADIUS_MIN_M, 400),
    ghostRadiusMaxM: toInt(process.env.GHOST_RADIUS_MAX_M, 900),
    defaultRadiusKm: toInt(process.env.DEFAULT_SEARCH_RADIUS_KM, 15),
    maxRadiusKm: toInt(process.env.MAX_SEARCH_RADIUS_KM, 200),
    loveRequestTtlHours: toInt(process.env.LOVE_REQUEST_TTL_HOURS, 48),
    requiredVouches: toInt(process.env.REQUIRED_VOUCHES, 3),
  } satisfies DiscoveryConfig,

  throttle: {
    ttl: toInt(process.env.THROTTLE_TTL, 60),
    limit: toInt(process.env.THROTTLE_LIMIT, 120),
  },
});
