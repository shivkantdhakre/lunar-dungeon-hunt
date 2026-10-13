import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface TieBreakRecord {
  idempotencyKey: string;
  matchId: string;
  duelId: string;
  phase: 'turn_limit' | 'sudden_death';
  rawBit: 0 | 1;
  winner: 'A' | 'B';
  timestamp: string;
  entropySource: 'crypto.randomInt(0, 2)';
}

@Injectable()
export class TieBreakService {
  private records = new Map<string, TieBreakRecord>();

  resolveTieBreak(matchId: string, duelId: string, phase: 'turn_limit' | 'sudden_death'): TieBreakRecord {
    const key = `${matchId}:${duelId}:${phase}`;
    
    const existing = this.records.get(key);
    if (existing) {
      return existing;
    }

    const rawBit = crypto.randomInt(0, 2);
    if (rawBit !== 0 && rawBit !== 1) {
      throw new Error(`Invalid RNG output: ${rawBit}`);
    }

    const record: TieBreakRecord = {
      idempotencyKey: key,
      matchId,
      duelId,
      phase,
      rawBit: rawBit as 0 | 1,
      winner: rawBit === 0 ? 'A' : 'B',
      timestamp: new Date().toISOString(),
      entropySource: 'crypto.randomInt(0, 2)',
    };

    this.records.set(key, Object.freeze(record));
    return record;
  }

  // P0.2, P1.8: Match-scoped retirement cleanup
  clearMatch(matchId: string): void {
    for (const [key, record] of this.records.entries()) {
      if (record.matchId === matchId) {
        this.records.delete(key);
      }
    }
  }
}
