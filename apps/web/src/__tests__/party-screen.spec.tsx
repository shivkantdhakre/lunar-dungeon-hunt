/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { PartyScreen } from '../components/PartyScreen';
import type { PrivatePartySnapshot, PublicMatchSnapshot } from '@dungeon-hunt/shared-contracts';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.crypto) {
  (globalThis as any).crypto = {};
}
if (!globalThis.crypto.randomUUID) {
  (globalThis.crypto as any).randomUUID = () => '00000000-0000-4000-8000-000000000000';
}

const mockSocketEmit = jest.fn();
jest.mock('../../lib/socket/SocketProvider', () => ({
  useSocket: () => ({
    socket: {
      connected: true,
      emit: mockSocketEmit,
    },
    connectionState: 'connected',
  }),
}));

const mockMatchState: PublicMatchSnapshot = {
  matchId: 'm-party-test',
  status: 'picking',
  scoreA: 1,
  scoreB: 0,
  currentDuelNumber: 2,
  currentTurnNumber: null,
  selectionDeadlineAt: Date.now() + 20000,
  actionDeadlineAt: null,
  lockedPartyA: false,
  lockedPartyB: true,
  rosterA: [
    { fighterId: 'f-1', roleId: 'swordsman', used: true },
    { fighterId: 'f-2', roleId: 'archer', used: false },
    { fighterId: 'f-3', roleId: 'mage', used: false },
    { fighterId: 'f-4', roleId: 'tank', used: false },
    { fighterId: 'f-5', roleId: 'rogue', used: false },
  ],
  rosterB: [],
};

const mockPartyState: PrivatePartySnapshot = {
  matchId: 'm-party-test',
  partyId: 'partyA-test',
  partySide: 'A',
  roster: [
    { fighterId: 'f-1', roleId: 'swordsman', used: true },
    { fighterId: 'f-2', roleId: 'archer', used: false },
    { fighterId: 'f-3', roleId: 'mage', used: false },
    { fighterId: 'f-4', roleId: 'tank', used: false },
    { fighterId: 'f-5', roleId: 'rogue', used: false },
  ],
  selectedFighterId: null,
  fighterLocked: false,
  selectedAction: null,
  actionLocked: false,
  selectedSuddenDeathAction: null,
  suddenDeathActionLocked: false,
  selectionDeadlineAt: Date.now() + 20000,
  actionDeadlineAt: null,
};

describe('PartyScreen Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockSocketEmit.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders champion selection roster with stats preview and opponent status', () => {
    act(() => {
      root.render(
        <PartyScreen
          partySide="A"
          partyState={mockPartyState}
          matchState={mockMatchState}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('PARTY A CONSOLE');
    expect(text).toContain('Series Score: 1 — 0');
    expect(text).toContain('Select Your Champion');
    expect(text).toContain('Archer');
    expect(text).toContain('Mage');
    expect(text).toContain('Tank');

    // Used role indicator
    expect(text).toContain('USED');

    // Opponent indicator (lockedPartyB is true)
    expect(text).toContain('Ready');
  });

  it('allows selecting an available champion and emits duel:selectFighter', () => {
    act(() => {
      root.render(
        <PartyScreen
          partySide="A"
          partyState={mockPartyState}
          matchState={mockMatchState}
        />,
      );
    });

    const archerBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Archer'),
    );
    expect(archerBtn).toBeDefined();

    act(() => {
      archerBtn?.click();
    });

    expect(mockSocketEmit).toHaveBeenCalledWith('duel:selectFighter', {
      matchId: 'm-party-test',
      duelId: 'duel-2',
      fighterId: 'f-2',
    });
  });

  it('renders combat actions during dueling phase and emits duel:submitAction', () => {
    const duelingPartyState: PrivatePartySnapshot = {
      ...mockPartyState,
      selectedFighterId: 'f-2',
      fighterLocked: true,
      selectedAction: 'strike',
    };

    act(() => {
      root.render(
        <PartyScreen
          partySide="A"
          partyState={duelingPartyState}
          matchState={{ ...mockMatchState, status: 'dueling', currentTurnNumber: 1 }}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('Select Combat Action');
    expect(text).toContain('Strike');
    expect(text).toContain('Guard');
    expect(text).toContain('Piercing Shot'); // Archer skill

    const lockActionBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Lock In Action'),
    );
    expect(lockActionBtn).toBeDefined();

    act(() => {
      lockActionBtn?.click();
    });

    expect(mockSocketEmit).toHaveBeenCalledWith('duel:submitAction', expect.objectContaining({
      matchId: 'm-party-test',
      duelId: 'duel-2',
      turnNumber: 1,
      actionType: 'strike',
    }));
  });

  it('disables controls and displays banner when match is paused', () => {
    act(() => {
      root.render(
        <PartyScreen
          partySide="A"
          partyState={mockPartyState}
          matchState={{ ...mockMatchState, status: 'paused', pauseReason: 'Referee check' }}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('MATCH TEMPORARILY PAUSED');
    expect(text).toContain('Referee check');

    // Interactive buttons are disabled while paused
    const lockFighterBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Match Paused') || b.textContent?.includes('Lock In Fighter'),
    ) as HTMLButtonElement;

    expect(lockFighterBtn).toBeDefined();
    expect(lockFighterBtn.disabled).toBe(true);
  });

  it('renders tournament lobby notice and disables locking in lobby status', () => {
    act(() => {
      root.render(
        <PartyScreen
          partySide="A"
          partyState={mockPartyState}
          matchState={{ ...mockMatchState, status: 'lobby' }}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('PHASE: TOURNAMENT LOBBY');
    expect(text).toContain('Tournament Lobby Phase');
    expect(text).toContain('Waiting for Match Start');

    const lockBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Waiting for Match Start'),
    ) as HTMLButtonElement;
    expect(lockBtn).toBeDefined();
    expect(lockBtn.disabled).toBe(true);
  });

  it('renders match victory overlay when match is completed', () => {
    act(() => {
      root.render(
        <PartyScreen
          partySide="A"
          partyState={mockPartyState}
          matchState={{ ...mockMatchState, status: 'completed', scoreA: 2, scoreB: 1 }}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('SERIES VICTOR: Party A!');
    expect(text).toContain('Party A TRIUMPHS!');
    expect(text).toContain('Final Match Score: 2 — 1');
  });
});
