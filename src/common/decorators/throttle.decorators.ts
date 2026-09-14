import { Throttle } from '@nestjs/throttler';

/**
 * Named throttle presets for the endpoints that attract abuse. Values are
 * intentionally centralised so limits can be audited in one place.
 */
export const ThrottleAuth = () => Throttle({ auth: { limit: 8, ttl: 60_000 } });
export const ThrottleOtp = () => Throttle({ otp: { limit: 4, ttl: 300_000 } });
export const ThrottleWrite = () => Throttle({ write: { limit: 30, ttl: 60_000 } });
export const ThrottleLoveRequest = () => Throttle({ love: { limit: 20, ttl: 3_600_000 } });
export const ThrottleMessage = () => Throttle({ message: { limit: 60, ttl: 60_000 } });
export const ThrottleEventCreate = () => Throttle({ eventCreate: { limit: 5, ttl: 3_600_000 } });
export const ThrottleReport = () => Throttle({ report: { limit: 10, ttl: 3_600_000 } });
export const ThrottleSearch = () => Throttle({ search: { limit: 60, ttl: 60_000 } });
