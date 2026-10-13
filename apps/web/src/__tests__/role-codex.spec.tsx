/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { RoleCodexModal } from '../components/RoleCodexModal';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('RoleCodexModal Component', () => {
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

  it('renders nothing when isOpen is false', () => {
    act(() => {
      root.render(<RoleCodexModal isOpen={false} onClose={() => {}} />);
    });
    expect(container.textContent).toBe('');
  });

  it('renders all 8 canonical roles with stats and skill descriptions when isOpen is true', () => {
    const handleClose = jest.fn();
    act(() => {
      root.render(<RoleCodexModal isOpen={true} onClose={handleClose} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('CHAMPION CODEX');
    expect(text).toContain('8 CANONICAL ROLES');

    // Canonical roles check
    expect(text).toContain('Swordsman');
    expect(text).toContain('Archer');
    expect(text).toContain('Mage');
    expect(text).toContain('Tank');
    expect(text).toContain('Rogue');
    expect(text).toContain('Assassin');
    expect(text).toContain('Vanguard');
    expect(text).toContain('Paladin');

    // Stats and skills
    expect(text).toContain('Blade Breaker');
    expect(text).toContain('Piercing Shot');
    expect(text).toContain('Arcane Burst');
    expect(text).toContain('Shield Bash');

    // Close button
    const closeButtons = container.querySelectorAll('button');
    expect(closeButtons.length).toBeGreaterThan(0);
    act(() => {
      closeButtons[0].click();
    });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('defaults to Paladin profile and switches to Rogue when Rogue card is clicked', () => {
    act(() => {
      root.render(<RoleCodexModal isOpen={true} onClose={() => {}} />);
    });

    const profilePanel = container.querySelector('[data-testid="codex-profile-panel"]');
    expect(profilePanel).not.toBeNull();
    expect(profilePanel?.textContent).toContain('Paladin');
    expect(profilePanel?.textContent).toContain('Aegis Smite');

    const rogueButton = container.querySelector('#codex-role-rogue') as HTMLButtonElement;
    expect(rogueButton).not.toBeNull();
    act(() => {
      rogueButton.click();
    });

    expect(profilePanel?.textContent).toContain('Rogue');
    expect(profilePanel?.textContent).toContain('Shadow Feint');
    expect(profilePanel?.textContent).toContain('95 HP');
    expect(profilePanel?.textContent).toContain('21 DMG');
  });

  it('displays Assassin profile when initialRole is assassin', () => {
    act(() => {
      root.render(<RoleCodexModal isOpen={true} onClose={() => {}} initialRole="assassin" />);
    });

    const profilePanel = container.querySelector('[data-testid="codex-profile-panel"]');
    expect(profilePanel).not.toBeNull();
    expect(profilePanel?.textContent).toContain('Assassin');
    expect(profilePanel?.textContent).toContain('Shadow Execution');
    expect(profilePanel?.textContent).toContain('80 HP');
    expect(profilePanel?.textContent).toContain('24 DMG');
  });

  it('switches to Mage when Mage card is clicked', () => {
    act(() => {
      root.render(<RoleCodexModal isOpen={true} onClose={() => {}} />);
    });

    const profilePanel = container.querySelector('[data-testid="codex-profile-panel"]');
    const mageButton = container.querySelector('#codex-role-mage') as HTMLButtonElement;
    expect(mageButton).not.toBeNull();
    act(() => {
      mageButton.click();
    });

    expect(profilePanel?.textContent).toContain('Mage');
    expect(profilePanel?.textContent).toContain('Arcane Burst');
  });
});

