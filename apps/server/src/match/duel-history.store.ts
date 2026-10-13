import { Injectable } from '@nestjs/common';
import type { FinalizeDuelResult } from '../combat/duel-finalizer';

/**
 * Shared in-memory completed duel history store (B3, H5).
 * Resolves symbol ownership across MatchService and duel-finalizer.
 * Keyed by `${matchId}:${runId}:${duelId}`.
 */
export const completedDuels = new Map<string, FinalizeDuelResult>();

@Injectable()
export class DuelHistoryStore {
  get(key: string): FinalizeDuelResult | undefined {
    return completedDuels.get(key);
  }

  set(key: string, result: FinalizeDuelResult): void {
    completedDuels.set(key, Object.freeze({ ...result }));
  }

  has(key: string): boolean {
    return completedDuels.has(key);
  }

  purgeMatchHistory(matchId: string): void {
    for (const key of completedDuels.keys()) {
      if (key.startsWith(`${matchId}:`)) {
        completedDuels.delete(key);
      }
    }
  }
}
