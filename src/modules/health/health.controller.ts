import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { HealthService } from './health.service';

@ApiTags('Health')
// Probes sit outside the /api/v1 prefix so orchestrators can hit a stable path
// that never moves when the API is versioned.
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Service metadata and dependency status' })
  check() {
    return this.health.full();
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe — is the process running' })
  live() {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — can the process serve traffic' })
  ready() {
    return this.health.readiness();
  }
}
