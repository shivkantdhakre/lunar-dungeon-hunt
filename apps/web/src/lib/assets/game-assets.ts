export interface CharacterAsset {
  roleId: string;
  name: string;
  title: string;
  description: string;
  fullBody: string;
  portrait: string;
  accentColor: string;
  glowColor: string;
}

export interface EnvironmentAssets {
  mainBackdrop: string;
  mainLunarBackdrop: string;
  selectionArena: string;
  characterSelectionArena: string;
  primaryBattleArena: string;
  suddenDeathArena: string;
  victoryDefeatBackdrop: string;
}

export interface UIAssets {
  strikeIcon: string;
  guardIcon: string;
  skillIcon: string;
  lunarCrest: string;
}

export const GAME_ENVIRONMENTS: EnvironmentAssets = {
  mainBackdrop: '/assets/game/environments/main_lunar_backdrop.webp',
  mainLunarBackdrop: '/assets/game/environments/main_lunar_backdrop.webp',
  selectionArena: '/assets/game/environments/character_selection_arena.webp',
  characterSelectionArena: '/assets/game/environments/character_selection_arena.webp',
  primaryBattleArena: '/assets/game/environments/primary_battle_arena.webp',
  suddenDeathArena: '/assets/game/environments/sudden_death_arena.webp',
  victoryDefeatBackdrop: '/assets/game/environments/victory_defeat_backdrop.webp',
};

export const GAME_UI: UIAssets = {
  strikeIcon: '/assets/game/ui/strike.svg',
  guardIcon: '/assets/game/ui/guard.svg',
  skillIcon: '/assets/game/ui/skill.svg',
  lunarCrest: '/assets/game/ui/lunar_crest.svg',
};

export const LUNAR_ICONS = {
  crest: GAME_UI.lunarCrest,
  strike: GAME_UI.strikeIcon,
  guard: GAME_UI.guardIcon,
  skill: GAME_UI.skillIcon,
};

export const CHARACTER_ASSETS: Record<string, CharacterAsset> = {
  swordsman: {
    roleId: 'swordsman',
    name: 'Moonsteel Swordsman',
    title: 'Disciplined Lunar Duelist',
    description: 'A disciplined blade master cloaked in moon-forged steel, wielding a pale-blue edge calibrated for rapid offensive strikes.',
    fullBody: '/assets/game/characters/swordsman.webp',
    portrait: '/assets/game/portraits/swordsman.webp',
    accentColor: '#7899D5',
    glowColor: 'rgba(120, 153, 213, 0.4)',
  },
  archer: {
    roleId: 'archer',
    name: 'Celestial Archer',
    title: 'Silent Moonlit Ranger',
    description: 'An agile lunar marksman drawing an enchanted silver bow to loose luminous arrows across the moonlit battlefield.',
    fullBody: '/assets/game/characters/archer.webp',
    portrait: '/assets/game/portraits/archer.webp',
    accentColor: '#C9E5FF',
    glowColor: 'rgba(201, 229, 255, 0.4)',
  },
  mage: {
    roleId: 'mage',
    name: 'Lunar Sorceress',
    title: 'Arcane Starlight Weaver',
    description: 'A celestial spellcaster channeling starlight glyphs and violet energy to unleash devastating Arcane Bursts.',
    fullBody: '/assets/game/characters/mage.webp',
    portrait: '/assets/game/portraits/mage.webp',
    accentColor: '#8D78D6',
    glowColor: 'rgba(141, 120, 214, 0.4)',
  },
  tank: {
    roleId: 'tank',
    name: 'Bastion Sentinel',
    title: 'Unbreakable Lunar Shield',
    description: 'A towering guardian encased in massive moon-forged plate, deflecting catastrophic blows with an astral tower shield.',
    fullBody: '/assets/game/characters/tank.webp',
    portrait: '/assets/game/portraits/tank.webp',
    accentColor: '#7899D5',
    glowColor: 'rgba(120, 153, 213, 0.5)',
  },
  rogue: {
    roleId: 'rogue',
    name: 'Dusk Trickster',
    title: 'Shadow Dancer of the Eclipse',
    description: 'A shadowy combatant dancing between night mists, striking unguarded flanks with dual curved daggers.',
    fullBody: '/assets/game/characters/rogue.webp',
    portrait: '/assets/game/portraits/rogue.webp',
    accentColor: '#8D78D6',
    glowColor: 'rgba(141, 120, 214, 0.4)',
  },
  assassin: {
    roleId: 'assassin',
    name: 'Eclipse Executioner',
    title: 'Lethal Blade of the New Moon',
    description: 'A ruthless stalker adorned in midnight garb, delivering fatal critical strikes under lunar concealment.',
    fullBody: '/assets/game/characters/assassin.webp',
    portrait: '/assets/game/portraits/assassin.webp',
    accentColor: '#DC5269',
    glowColor: 'rgba(220, 82, 105, 0.4)',
  },
  vanguard: {
    roleId: 'vanguard',
    name: 'Lunar Vanguard',
    title: 'Crushing Heavy Bruiser',
    description: 'A frontline conqueror wielding an ancient great-hammer, shattering defensive barriers with seismic shockwaves.',
    fullBody: '/assets/game/characters/vanguard.webp',
    portrait: '/assets/game/portraits/vanguard.webp',
    accentColor: '#E8A75A',
    glowColor: 'rgba(232, 167, 90, 0.4)',
  },
  paladin: {
    roleId: 'paladin',
    name: 'Sacred Paladin',
    title: 'Radiant Dawnkeeper',
    description: 'A holy champion combining consecrated gold armor and celestial healing to safeguard allies with divine wards.',
    fullBody: '/assets/game/characters/paladin.webp',
    portrait: '/assets/game/portraits/paladin.webp',
    accentColor: '#C8A96E',
    glowColor: 'rgba(200, 169, 110, 0.4)',
  },
};

export function getCharacterAsset(roleId?: string | null): CharacterAsset {
  if (!roleId) return CHARACTER_ASSETS.swordsman;
  return CHARACTER_ASSETS[roleId.toLowerCase()] || CHARACTER_ASSETS.swordsman;
}
