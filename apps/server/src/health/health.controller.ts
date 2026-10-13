import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    // P0.5: Canonical health response contract asserting status and liveness probe
    return { status: 'ok', probe: 'liveness', timestamp: new Date().toISOString() };
  }
}
