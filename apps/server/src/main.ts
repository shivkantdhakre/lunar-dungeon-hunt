import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SocketIoAdapter } from './adapters/socket-io.adapter';
import { HttpExceptionsFilter } from './filters/http-exceptions.filter';
import { ROLES, validateRoleRegistry } from '@dungeon-hunt/game-rules';

async function bootstrap() {
  // 0. Startup validation of frozen 8-role domain registry (M4)
  validateRoleRegistry(ROLES);

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);

  // 1. REST CORS configuration
  const webOrigin = config.get<string>('WEB_ORIGIN', 'http://localhost:3000');
  app.enableCors({ origin: webOrigin, credentials: true });

  // 2. Socket.IO CORS & WebSocket Handshake Origin Enforcement via custom adapter
  app.useWebSocketAdapter(new SocketIoAdapter(app));

  // 3. HTTP Global Exception Filter (WS filter is bound directly on gateway)
  app.useGlobalFilters(new HttpExceptionsFilter());

  // 4. Validate and parse PORT
  const rawPort = config.get<string>('PORT', '3001');
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT configuration: "${rawPort}". Must be an integer between 1 and 65535.`);
  }

  await app.listen(port);
  logger.log(`Server listening on port ${port}`);
}
bootstrap();
