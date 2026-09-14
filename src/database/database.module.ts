import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { SpatialService } from './spatial.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, SpatialService],
  exports: [PrismaService, RedisService, SpatialService],
})
export class DatabaseModule {}
