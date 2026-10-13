import { RolesController } from './roles.controller';

describe('RolesController', () => {
  let controller: RolesController;

  beforeEach(() => {
    controller = new RolesController();
  });

  it('returns all 8 canonical public roles with stats and skill summaries', () => {
    const roles = controller.getRoles();
    expect(roles).toHaveLength(8);

    const ids = roles.map(r => r.id);
    expect(ids).toContain('swordsman');
    expect(ids).toContain('archer');
    expect(ids).toContain('mage');
    expect(ids).toContain('tank');
    expect(ids).toContain('rogue');
    expect(ids).toContain('assassin');
    expect(ids).toContain('vanguard');
    expect(ids).toContain('paladin');

    for (const r of roles) {
      expect(r.maxHp).toBeGreaterThan(0);
      expect(r.baseAttack).toBeGreaterThan(0);
      expect(r.skill.name).toBeDefined();
      expect(r.skill.usesPerDuel).toBe(1);
    }
  });
});
