/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import Home from '../app/page';
import type { PublicMatchSnapshot } from '@dungeon-hunt/shared-contracts';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

jest.mock('../components/FestiveParticles', () => ({
  FestiveParticles: () => null,
}));

jest.mock('../lib/sound/sound-effects', () => ({
  sounds: {
    playGuard: jest.fn(),
    playSkill: jest.fn(),
    playStrike: jest.fn(),
    playVictory: jest.fn(),
    playHit: jest.fn(),
    playCrit: jest.fn(),
    playShieldGain: jest.fn(),
    playClick: jest.fn(),
    toggleMute: jest.fn().mockReturnValue(false),
    isMuted: jest.fn().mockReturnValue(false),
  },
}));

const mockListeners: Record<string, ((...args: any[]) => void)> = {};
const mockSocketEmit = jest.fn();
const mockSetAuthToken = jest.fn();

const mockSocket = {
  connected: true,
  on: jest.fn((event: string, handler: any) => {
    mockListeners[event] = handler;
  }),
  off: jest.fn((event: string) => {
    delete mockListeners[event];
  }),
  emit: mockSocketEmit,
};

jest.mock('../../lib/socket/SocketProvider', () => ({
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSocket: () => ({
    socket: mockSocket,
    connectionState: 'connected',
    rtt: 15,
    sendPing: jest.fn(),
    setAuthToken: mockSetAuthToken,
  }),
}));

const mockPublicSnapshot: PublicMatchSnapshot = {
  matchId: 'match-live-sync-test',
  status: 'picking',
  partyAName: 'Solar Guardians',
  partyBName: 'Lunar Nightblades',
  scoreA: 1,
  scoreB: 0,
  currentDuelNumber: 2,
  currentTurnNumber: null,
  selectionDeadlineAt: Date.now() + 15000,
  actionDeadlineAt: null,
  lockedPartyA: false,
  lockedPartyB: false,
  rosterA: [
    { fighterId: 'f-a-1', roleId: 'swordsman', used: true },
    { fighterId: 'f-a-2', roleId: 'archer', used: false },
    { fighterId: 'f-a-3', roleId: 'mage', used: false },
    { fighterId: 'f-a-4', roleId: 'tank', used: false },
    { fighterId: 'f-a-5', roleId: 'rogue', used: false },
  ],
  rosterB: [
    { fighterId: 'f-b-1', roleId: 'swordsman', used: true },
    { fighterId: 'f-b-2', roleId: 'archer', used: false },
    { fighterId: 'f-b-3', roleId: 'mage', used: false },
    { fighterId: 'f-b-4', roleId: 'assassin', used: false },
    { fighterId: 'f-b-5', roleId: 'vanguard', used: false },
  ],
  activeFighterA: null,
  activeFighterB: null,
};

describe('Public Arena Live Updates & Synchronization', () => {
  jest.setTimeout(25000);
  let container: HTMLDivElement;
  let root: Root;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    global.fetch = originalFetch;
  });

  it('initially displays Awaiting Match Initialization when no match exists, then syncs live when provisioned', async () => {
    let hasMatch = false;
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/matches/active/public')) {
        if (!hasMatch) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: async () => ({ message: 'No active tournament match.' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            matchId: mockPublicSnapshot.matchId,
            runId: 1,
            arenaToken: 'jwt-arena-token-123',
            snapshot: mockPublicSnapshot,
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    await act(async () => {
      root.render(<Home />);
    });

    expect(container.textContent).toContain('Awaiting Match Initialization');

    // Simulate match provisioned and received via socket or sync
    hasMatch = true;
    await act(async () => {
      mockListeners['match:state']?.(mockPublicSnapshot);
    });

    const text = container.textContent || '';
    expect(text).toContain('Solar Guardians');
    expect(text).toContain('Lunar Nightblades');
    expect(text).toContain('BEST OF THREE • DUEL 2');
    expect(text).toContain('1—0');
  });

  it('updates combat state, scoreboard, and chronicle live on WebSocket duel events', async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          matchId: mockPublicSnapshot.matchId,
          runId: 1,
          arenaToken: 'jwt-arena-token-live',
          snapshot: mockPublicSnapshot,
        }),
      }),
    );

    await act(async () => {
      root.render(<Home />);
    });

    // 1. Fighter lock event
    await act(async () => {
      mockListeners['duel:fighterLocked']?.({ partySide: 'A' });
    });
    expect(container.textContent).toContain('Party A locked in their secret fighter pick');

    // 2. Fighters revealed event
    await act(async () => {
      mockListeners['duel:fightersRevealed']?.({
        fighterA: { id: 'f-a-2', roleId: 'archer', maxHp: 85, currentHp: 85, currentShield: 0 },
        fighterB: { id: 'f-b-4', roleId: 'assassin', maxHp: 80, currentHp: 80, currentShield: 0 },
      });
    });
    expect(container.textContent).toContain('Fighters Revealed: ARCHER vs ASSASSIN');

    // 3. Turn resolved event
    await act(async () => {
      mockListeners['duel:turnResolved']?.({
        turnNumber: 1,
        stateA: { id: 'f-a-2', roleId: 'archer', maxHp: 85, currentHp: 65, currentShield: 0 },
        stateB: { id: 'f-b-4', roleId: 'assassin', maxHp: 80, currentHp: 55, currentShield: 0 },
        combatLog: [
          { actor: 'A', event: 'Archer struck Assassin for 25 damage' },
          { actor: 'B', event: 'Assassin struck Archer for 20 damage' },
        ],
      });
    });
    expect(container.textContent).toContain('Archer struck Assassin for 25 damage');
    expect(container.textContent).toContain('Turn 1 Resolved');

    // 4. Duel concluded event
    await act(async () => {
      mockListeners['duel:completed']?.({
        winnerPartySide: 'A',
        reason: 'normalDecisive',
        scoreA: 2,
        scoreB: 0,
      });
    });
    expect(container.textContent).toContain('Duel Concluded! Winner: Party A');
    expect(container.textContent).toContain('2—0');

    // 5. Match completed event
    await act(async () => {
      mockListeners['match:completed']?.({
        winningPartySide: 'A',
        finalScoreA: 2,
        finalScoreB: 0,
      });
    });
    expect(container.textContent).toContain('MATCH COMPLETE! PARTY A WINS THE TOURNAMENT');
  });

  it('handles tokens rotated on match reset by seamlessly reconnecting with new token', async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          matchId: mockPublicSnapshot.matchId,
          runId: 2,
          arenaToken: 'jwt-new-run2-arena-token',
          snapshot: { ...mockPublicSnapshot, scoreA: 0, scoreB: 0, status: 'lobby' },
        }),
      }),
    );

    await act(async () => {
      root.render(<Home />);
    });

    await act(async () => {
      mockListeners['match:tokensRotated']?.({
        matchId: mockPublicSnapshot.matchId,
        runId: 2,
        tokens: {
          host: 'host-tok-2',
          partyA: 'partyA-tok-2',
          partyB: 'partyB-tok-2',
          arena: 'jwt-new-run2-arena-token',
        },
      });
    });

    expect(mockSetAuthToken).toHaveBeenCalledWith('jwt-new-run2-arena-token');
    expect(container.textContent).toContain('Match Reset: Run ID incremented to 2');
  });
});
