import { Controller, Get } from '@nestjs/common';
import { ROLES } from '@dungeon-hunt/game-rules';

@Controller(['roles', 'api/roles'])
export class RolesController {
  @Get()
  getRoles() {
    return Object.values(ROLES).map(role => ({
      id: role.id,
      name: role.name,
      maxHp: role.maxHp,
      baseAttack: role.baseAttack,
      skill: {
        id: role.skill.id,
        name: role.skill.name,
        usesPerDuel: role.skill.usesPerDuel,
        description: role.skill.description,
      },
    }));
  }
}
