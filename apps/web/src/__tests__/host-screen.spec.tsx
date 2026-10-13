/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { HostScreen } from '../components/HostScreen';
import type { PublicMatchSnapshot } from '@dungeon-hunt/shared-contracts';

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
    rtt: 10,
  }),
}));

const mockMatchState: PublicMatchSnapshot = {
  matchId: 'm-audit-test',
  status: 'lobby',
  scoreA: 0,
  scoreB: 0,
  currentDuelNumber: 1,
  currentTurnNumber: null,
  selectionDeadlineAt: null,
  actionDeadlineAt: null,
  lockedPartyA: false,
  lockedPartyB: false,
  rosterA: [
    { fighterId: 'f-a-1', roleId: 'swordsman', used: false },
    { fighterId: 'f-a-2', roleId: 'archer', used: false },
    { fighterId: 'f-a-3', roleId: 'mage', used: false },
    { fighterId: 'f-a-4', roleId: 'tank', used: false },
    { fighterId: 'f-a-5', roleId: 'rogue', used: false },
  ],
  rosterB: [
    { fighterId: 'f-b-1', roleId: 'swordsman', used: false },
    { fighterId: 'f-b-2', roleId: 'archer', used: false },
    { fighterId: 'f-b-3', roleId: 'mage', used: false },
    { fighterId: 'f-b-4', roleId: 'assassin', used: false },
    { fighterId: 'f-b-5', roleId: 'vanguard', used: false },
  ],
};

const mockTokens = {
  host: 'h-token-123',
  partyA: 'a-token-123',
  partyB: 'b-token-123',
  arena: 'ar-token-123',
};

describe('HostScreen Component', () => {
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

  it('renders provisioning form and toggles custom 5-role roster selectors', () => {
    act(() => {
      root.render(
        <HostScreen
          matchState={null}
          tokens={null}
          onProvision={() => {}}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('Match Provisioning & Tournament Desk');
    const inputs = container.querySelectorAll('input[type="text"]');
    expect((inputs[0] as HTMLInputElement).value).toBe('Solar Vanguard');
    expect((inputs[1] as HTMLInputElement).value).toBe('Lunar Wardens');

    // Toggle custom rosters checkbox
    const customCheckbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(customCheckbox).toBeDefined();

    act(() => {
      customCheckbox.click();
    });

    expect(container.textContent).toContain('Party A Roles');
    expect(container.textContent).toContain('Party B Roles');
  });

  it('renders match controls when matchState is active and emits match:start', () => {
    act(() => {
      root.render(
        <HostScreen
          matchState={mockMatchState}
          tokens={mockTokens}
          onProvision={() => {}}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('Match ID: m-audit-test');
    expect(text).toContain('Score: 0 — 0');
    expect(text).toContain('Start Match');

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start Match'),
    );
    expect(startBtn).toBeDefined();

    act(() => {
      startBtn?.click();
    });

    expect(mockSocketEmit).toHaveBeenCalledWith('match:start', { matchId: 'm-audit-test' });
  });

  it('renders emergency overrides panel and executes host:override', () => {
    act(() => {
      root.render(
        <HostScreen
          matchState={{ ...mockMatchState, status: 'dueling' }}
          tokens={mockTokens}
          onProvision={() => {}}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('Host Emergency Overrides & Interventions');
    expect(text).toContain('Declare Duel Winner');

    const overrideBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Execute Override'),
    );
    expect(overrideBtn).toBeDefined();

    act(() => {
      overrideBtn?.click();
    });

    expect(mockSocketEmit).toHaveBeenCalledWith('host:override', expect.objectContaining({
      matchId: 'm-audit-test',
      operation: 'declareDuelWinner',
      winnerSide: 'A',
    }));
  });

  it('renders pause banner and triggers match:resume when paused', () => {
    act(() => {
      root.render(
        <HostScreen
          matchState={{ ...mockMatchState, status: 'paused', pauseReason: 'Technical review' }}
          tokens={mockTokens}
          onProvision={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain('MATCH PAUSED');
    expect(container.textContent).toContain('Technical review');

    const resumeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Resume Match'),
    );
    expect(resumeBtn).toBeDefined();

    act(() => {
      resumeBtn?.click();
    });

    expect(mockSocketEmit).toHaveBeenCalledWith('match:resume', { matchId: 'm-audit-test' });
  });

  it('allows deselecting and changing roles in custom party lineups', () => {
    act(() => {
      root.render(
        <HostScreen
          matchState={null}
          tokens={null}
          onProvision={() => {}}
        />,
      );
    });

    const customCheckbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => {
      customCheckbox.click();
    });

    // Default rolesA has 5 roles: swordsman, archer, mage, tank, rogue
    expect(container.textContent).toContain('Party A Roles (5/5)');

    // Click swordsman to deselect it
    const swordsmanBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('swordsman'),
    );
    expect(swordsmanBtn).toBeDefined();

    act(() => {
      swordsmanBtn?.click();
    });

    // Now rolesA should have 4 roles
    expect(container.textContent).toContain('Party A Roles (4/5)');

    // Click paladin to select it
    const paladinBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('paladin'),
    );
    expect(paladinBtn).toBeDefined();

    act(() => {
      paladinBtn?.click();
    });

    // Now rolesA should be back to 5 roles including paladin
    expect(container.textContent).toContain('Party A Roles (5/5)');
  });
});
