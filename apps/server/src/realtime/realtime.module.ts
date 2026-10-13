import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { WsExceptionsFilter } from '../filters/ws-exceptions.filter';
import { AuthModule } from '../auth/auth.module';
import { MatchModule } from '../match/match.module';

@Module({
  imports: [AuthModule, MatchModule],
  providers: [RealtimeGateway, WsExceptionsFilter],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
