import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

export interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async full() {
    const [database, cache, postgis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkPostgis(),
    ]);

    return {
      service: this.config.get<string>('app.appName'),
      version: process.env.npm_package_version ?? '1.0.0',
      environment: this.config.get<string>('app.env'),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: { database, cache, postgis },
    };
  }

  async readiness() {
    const [database, cache] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const ready = database.status === 'up' && cache.status === 'up';
    if (!ready) {
      throw new ServiceUnavailableException({
        code: 'NOT_READY',
        message: 'One or more dependencies are unavailable',
        details: { database: [database.status], cache: [cache.status] },
      });
    }
    return { status: 'ready', database, cache };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      return { status: 'down', error: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const start = Date.now();
    try {
      await this.redis.client.ping();
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      return { status: 'down', error: (error as Error).message };
    }
  }

  private async checkPostgis(): Promise<DependencyStatus & { version?: string }> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ v: string }>>`
        SELECT postgis_version() AS v
      `;
      return { status: 'up', version: rows[0]?.v };
    } catch (error) {
      return { status: 'down', error: (error as Error).message };
    }
  }
}
