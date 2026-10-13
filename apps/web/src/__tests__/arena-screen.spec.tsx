/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ArenaScreen } from '../components/ArenaScreen';
import type { PublicMatchSnapshot, PublicFighter } from '@dungeon-hunt/shared-contracts';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockMatchState: PublicMatchSnapshot = {
  matchId: 'm-arena-test',
  status: 'picking',
  scoreA: 1,
  scoreB: 1,
  currentDuelNumber: 3,
  currentTurnNumber: null,
  selectionDeadlineAt: Date.now() + 15000,
  actionDeadlineAt: null,
  lockedPartyA: true,
  lockedPartyB: false,
  rosterA: [
    { fighterId: 'f-a-1', roleId: 'swordsman', used: true },
    { fighterId: 'f-a-2', roleId: 'archer', used: true },
    { fighterId: 'f-a-3', roleId: 'mage', used: false },
    { fighterId: 'f-a-4', roleId: 'tank', used: false },
    { fighterId: 'f-a-5', roleId: 'rogue', used: false },
  ],
  rosterB: [
    { fighterId: 'f-b-1', roleId: 'swordsman', used: true },
    { fighterId: 'f-b-2', roleId: 'archer', used: true },
    { fighterId: 'f-b-3', roleId: 'mage', used: false },
    { fighterId: 'f-b-4', roleId: 'assassin', used: false },
    { fighterId: 'f-b-5', roleId: 'vanguard', used: false },
  ],
};

const mockCombatantA: PublicFighter = {
  id: 'f-a-3',
  roleId: 'mage',
  maxHp: 85,
  currentHp: 65,
  currentShield: 15,
};

const mockCombatantB: PublicFighter = {
  id: 'f-b-4',
  roleId: 'assassin',
  maxHp: 80,
  currentHp: 40,
  currentShield: 0,
};

describe('ArenaScreen Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it('renders awaiting initialization when matchState is null', () => {
    act(() => {
      root.render(<ArenaScreen matchState={null} />);
    });
    expect(container.textContent).toContain('Awaiting Match Initialization');
  });

  it('renders scoreboard and draft stage during picking phase with roster statuses', () => {
    act(() => {
      root.render(
        <ArenaScreen
          matchState={mockMatchState}
          combatLogs={[{ actor: 'system', event: 'Draft commenced' }]}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('BEST OF THREE • DUEL 3');
    expect(text).toContain('1—1');
    expect(text).toContain('SECRET CHAMPION SELECTION');
    expect(text).toContain('Party A Champions');
    expect(text).toContain('Party B Champions');
    expect(text).toContain('Draft commenced');
  });

  it('renders combatants, health bars, and shield gauges during dueling phase', () => {
    act(() => {
      root.render(
        <ArenaScreen
          matchState={{ ...mockMatchState, status: 'dueling', currentTurnNumber: 2 }}
          activeFighterA={mockCombatantA}
          activeFighterB={mockCombatantB}
          combatLogs={[
            { actor: 'A', event: 'Mage cast Arcane Burst' },
            { actor: 'B', event: 'Assassin struck for 24 damage' },
          ]}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('Party A');
    expect(text).toContain('Party B');
    expect(text).toContain('Mage');
    expect(text).toContain('Assassin');
    expect(text).toContain('65 / 85 HP');
    expect(text).toContain('40 / 80 HP');
    expect(text).toContain('15 Shield');
    expect(text).toContain('Live Arena Combat Chronicle');
    expect(text).toContain('Mage cast Arcane Burst');
  });

  it('renders victory fanfare banner when match is completed', () => {
    act(() => {
      root.render(
        <ArenaScreen
          matchState={{ ...mockMatchState, status: 'completed', scoreA: 2, scoreB: 1 }}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('SERIES VICTOR: Party A!');
    expect(text).toContain('Final Match Score: 2 — 1');
  });

  it('renders pause banner when match is paused', () => {
    act(() => {
      root.render(
        <ArenaScreen
          matchState={{ ...mockMatchState, status: 'paused', pauseReason: 'Technical audio issue' }}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('MATCH TEMPORARILY PAUSED');
    expect(text).toContain('Technical audio issue');
  });
});
