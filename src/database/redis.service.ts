import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly _client: Redis;
  private readonly _subscriber: Redis;
  private isConnected = false;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('redis.url') || 'redis://localhost:6379';
    this._client = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
    });
    this._subscriber = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
    });
    this._client.on('error', (err) => this.logger.warn(`Redis client warning: ${err.message}`));
    this._subscriber.on('error', (err) => this.logger.warn(`Redis subscriber warning: ${err.message}`));
  }

  async onModuleInit(): Promise<void> {
    try {
      await this._client.connect();
      await this._client.ping();
      this.isConnected = true;
      this.logger.log('Connected to Redis');
    } catch (err) {
      this.logger.warn(`Redis connection failed: ${(err as Error).message}. Running with fallback handling.`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this._client.status === 'ready' ? this._client.quit() : this._client.disconnect(),
      this._subscriber.status === 'ready' ? this._subscriber.quit() : this._subscriber.disconnect(),
    ]);
  }

  get client(): Redis {
    return this._client;
  }

  get subscriber(): Redis {
    return this._subscriber;
  }

  duplicate(): Redis {
    return this._client.duplicate();
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this._client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds) await this._client.set(key, payload, 'EX', ttlSeconds);
      else await this._client.set(key, payload);
    } catch {
      // Best-effort cache set
    }
  }

  async deleteByPattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let deleted = 0;
      do {
        const [next, keys] = await this._client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) deleted += await this._client.del(...keys);
      } while (cursor !== '0');
      return deleted;
    } catch {
      return 0;
    }
  }

  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
    try {
      const token = `${Date.now()}-${Math.random()}`;
      const acquired = await this._client.set(`lock:${key}`, token, 'PX', ttlMs, 'NX');
      if (!acquired) return null;
      try {
        return await fn();
      } finally {
        await this._client.eval(
          `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
          1,
          `lock:${key}`,
          token,
        );
      }
    } catch {
      // Fallback: execute fn directly if Redis lock unavailable
      return fn();
    }
  }
}
