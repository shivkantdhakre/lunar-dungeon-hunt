import { Catch, ExceptionFilter, ArgumentsHost, Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ZodError } from 'zod';
import { WsException } from '@nestjs/websockets';
import { validateServerEvent } from '@dungeon-hunt/shared-contracts';

@Injectable()
@Catch()
export class WsExceptionsFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger(WsExceptionsFilter.name) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'ws') return;

    const client = host.switchToWs().getClient<Socket>();

    // P1.5, P2.4: Validate outbound error schemas strictly
    if (exception instanceof ZodError) {
      this.logger.warn({ socketId: client.id, issues: exception.issues.length }, 'WebSocket payload validation error');
      const errPayload = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid payload structure or constraints violated.',
      };
      validateServerEvent('match:error', errPayload);
      client.emit('match:error', errPayload);
      return;
    }

    if (exception instanceof WsException) {
      const err = exception.getError();
      let code = 'BAD_REQUEST';
      let message = 'Bad request';
      let commandId: string | undefined;

      if (typeof err === 'string') {
        message = err;
      } else if (typeof err === 'object' && err !== null) {
        const record = err as Record<string, unknown>;
        if (typeof record.code === 'string') code = record.code;
        if (typeof record.message === 'string') message = record.message;
        if (typeof record.commandId === 'string') commandId = record.commandId;
      }

      const errPayload = { code, message, ...(commandId ? { commandId } : {}) };
      validateServerEvent('match:error', errPayload);
      client.emit('match:error', errPayload);
      return;
    }

    const message = exception instanceof Error ? exception.message : 'Unknown error';
    this.logger.error(
      {
        socketId: client.id,
        errorName: exception instanceof Error ? exception.name : typeof exception,
        errorMessage: message, // P0.6: Actively log message to satisfy no-unused-vars
      },
      'Realtime exception',
    );

    const internalPayload = {
      code: 'INTERNAL_ERROR',
      message: 'A realtime error occurred. Please retry your action.',
    };
    validateServerEvent('match:error', internalPayload);
    client.emit('match:error', internalPayload);
  }
}
