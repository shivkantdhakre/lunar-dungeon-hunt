/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { HeaderNav } from '../components/HeaderNav';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock SocketProvider
jest.mock('../../lib/socket/SocketProvider', () => ({
  useSocket: () => ({
    connectionState: 'connected',
    rtt: 12,
    sendPing: jest.fn(),
  }),
}));

describe('HeaderNav Component', () => {
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

  it('renders title, connection badge with RTT, and view switcher buttons', () => {
    const handleTabChange = jest.fn();
    act(() => {
      root.render(
        <HeaderNav
          activeTab="arena"
          onTabChange={handleTabChange}
          matchId="m-test-123"
          onOpenCodex={() => {}}
        />,
      );
    });

    const text = container.textContent || '';
    expect(text).toContain('LUNAR DUNGEON');
    expect(text).toContain('PARTY CLASH');
    expect(text).toContain('Connected (12ms)');
    expect(text).toContain('Public Arena');
    expect(text).toContain('Party A Console');
    expect(text).toContain('Party B Console');
    expect(text).toContain('Host Desk');
    expect(text).toContain('Roles');
  });

  it('triggers onTabChange when navigation tab is clicked', () => {
    const handleTabChange = jest.fn();
    act(() => {
      root.render(
        <HeaderNav
          activeTab="arena"
          onTabChange={handleTabChange}
          matchId="m-test-123"
        />,
      );
    });

    const buttons = container.querySelectorAll('button');
    const hostButton = Array.from(buttons).find((b) => b.textContent?.includes('Host Desk'));
    expect(hostButton).toBeDefined();

    act(() => {
      hostButton?.click();
    });
    expect(handleTabChange).toHaveBeenCalledWith('host');
  });

  it('triggers onOpenCodex when Roles codex button is clicked', () => {
    const handleOpenCodex = jest.fn();
    act(() => {
      root.render(
        <HeaderNav
          activeTab="host"
          onTabChange={() => {}}
          onOpenCodex={handleOpenCodex}
        />,
      );
    });

    const codexBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Roles'),
    );
    expect(codexBtn).toBeDefined();

    act(() => {
      codexBtn?.click();
    });
    expect(handleOpenCodex).toHaveBeenCalledTimes(1);
  });
});
