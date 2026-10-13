import { sounds } from '../lib/sound/sound-effects';

describe('Sound Effects Synthesizer', () => {
  beforeEach(() => {
    localStorage.clear();
    sounds.setMuted(false);
  });

  it('starts unmuted by default', () => {
    expect(sounds.isMuted()).toBe(false);
  });

  it('toggles mute state and saves to localStorage', () => {
    const isNowMuted = sounds.toggleMute();
    expect(isNowMuted).toBe(true);
    expect(sounds.isMuted()).toBe(true);
    expect(localStorage.getItem('ld_sound_muted')).toBe('true');

    const isUnmuted = sounds.toggleMute();
    expect(isUnmuted).toBe(false);
    expect(sounds.isMuted()).toBe(false);
    expect(localStorage.getItem('ld_sound_muted')).toBe('false');
  });

  it('executes sound triggers without throwing in headless environments', () => {
    expect(() => {
      sounds.playStrike();
      sounds.playGuard();
      sounds.playSkill();
      sounds.playTick(true);
      sounds.playTick(false);
      sounds.playVictory();
      sounds.playClick();
    }).not.toThrow();
  });

  it('bypasses sound generation when muted', () => {
    sounds.setMuted(true);
    expect(sounds.isMuted()).toBe(true);
    expect(() => {
      sounds.playStrike();
      sounds.playGuard();
      sounds.playSkill();
      sounds.playVictory();
    }).not.toThrow();
  });
});
