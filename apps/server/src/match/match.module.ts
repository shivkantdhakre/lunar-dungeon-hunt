import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { RolesController } from './roles.controller';
import { MatchService } from './match.service';
import { TieBreakService } from './tie-break.service';
import { DuelHistoryStore } from './duel-history.store';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MatchController, RolesController],
  providers: [MatchService, TieBreakService, DuelHistoryStore],
  exports: [MatchService, TieBreakService, DuelHistoryStore],
})
export class MatchModule {}
