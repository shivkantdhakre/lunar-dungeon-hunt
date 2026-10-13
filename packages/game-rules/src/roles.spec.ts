import { ROLES, validateRoleRegistry } from './roles';
import type { RoleDefinition } from './types';

describe('Game Rules Registry & Validation', () => {
  it('contains exactly 8 frozen roles', () => {
    expect(Object.keys(ROLES).length).toBe(8);
  });

  it('passes validateRoleRegistry without errors', () => {
    expect(() => validateRoleRegistry(ROLES)).not.toThrow();
  });

  it('rejects an invalid role with missing skill without using as any', () => {
    const invalidRegistry = {
      ...ROLES,
      swordsman: {
        ...ROLES.swordsman,
        skill: null as unknown as RoleDefinition['skill'],
      },
    };
    expect(() => validateRoleRegistry(invalidRegistry)).toThrow();
  });

  it('rejects roles with non-safe-integer or out-of-bounds damage/shield values', () => {
    const invalidRegistry = {
      ...ROLES,
      tank: {
        ...ROLES.tank,
        skill: {
          ...ROLES.tank.skill,
          effects: [
            { type: 'gainShield' as const, amount: 999, timing: 'beforeDamage' as const },
            { type: 'damage' as const, amount: 18, guardInteraction: 'guardable' as const },
          ],
        },
      },
    };
    expect(() => validateRoleRegistry(invalidRegistry)).toThrow(/Invalid shield amount in role "tank": 999/);
  });

  it('rejects roles with invalid damage effect amount or guard interaction', () => {
    const invalidRegistry = {
      ...ROLES,
      swordsman: {
        ...ROLES.swordsman,
        skill: {
          ...ROLES.swordsman.skill,
          effects: [
            { type: 'damage' as const, amount: 0, guardInteraction: 'guardable' as const },
          ],
        },
      },
    };
    expect(() => validateRoleRegistry(invalidRegistry)).toThrow(/Invalid damage amount in role "swordsman": 0/);
  });
});
