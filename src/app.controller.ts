import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators';

@ApiTags('Root')
@Controller({ path: '', version: VERSION_NEUTRAL })
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'API Root and System Overview' })
  getRoot() {
    return {
      name: 'Koodam API (കൂടം)',
      tagline: 'Meet • Explore • Belong (Discover Events. Meet People. Find Your Connection.)',
      description: 'Hyperlocal social discovery, events and intentional dating platform for Kerala and the Malayali diaspora.',
      status: 'online',
      version: '1.0.0',
      links: {
        docs: '/api/docs',
        health: '/health',
        healthLive: '/health/live',
        healthReady: '/health/ready',
        github: 'https://github.com/abbasalitmk/koodam',
      },
    };
  }
}
