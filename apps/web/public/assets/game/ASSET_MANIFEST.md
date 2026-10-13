# LUNAR DUNGEON: PARTY CLASH — ORIGINAL ASSET MANIFEST
**Theme:** Lunar Night  
**Style:** 2.5D Cel-Shaded Fantasy RPG Illustration with Moonlit Depth  
**Root Directory:** `apps/web/public/assets/game/`

---

## 1. Environment Art (`/environments/`)

All environments are optimized WebP formats composed with layered foreground/background depth and dark indigo/midnight navy palettes.

| File Name | Format | Resolution | Intended Placement | Art Direction & Description |
| :--- | :--- | :--- | :--- | :--- |
| `primary_battle_arena.webp` | WebP | 1920x1080 | Active Match Combat Stage (`BattleStage.tsx`) | Cinematic moonlit combat stage with grounded stone runic platform, giant luminous full moon, soft celestial fog, and gothic architectural ruins. |
| `main_lunar_backdrop.webp` | WebP | 1920x1080 | Main Menu & Lobby Screen (`ArenaScreen.tsx`, `page.tsx`) | Expansive moonlit fantasy landscape featuring ancient spire spires, glowing starlight, soft mist, and deep indigo night sky. |
| `sudden_death_arena.webp` | WebP | 1920x1080 | Sudden Death Tiebreaker Phase (`BattleStage.tsx`) | Dramatic dark variation with heightened violet/crimson celestial contrast, shattered floating stone arches, and fractured magical lightning. |
| `character_selection_arena.webp` | WebP | 1920x1080 | Champion Draft & Selection Stage (`ArenaScreen.tsx`, `PartyScreen.tsx`) | Elegant celestial staging courtyard with polished marble, antique gold inlays, monumental glowing moon, and pedestals for the 5-champion lineup. |
| `victory_defeat_backdrop.webp` | WebP | 1920x1080 | Match & Tournament Results (`MatchResultOverlay.tsx`) | Golden celestial sanctuary with triumphal arches, starlight illumination, and grand celebratory composition for tournament champions. |

---

## 2. Full-Body Character Renders (`/characters/`)

High-resolution full-body fantasy champion artwork featuring moonlit rim lighting and distinctive silhouettes, rendered at consistent floor baseline for opposing battle compositing.

| Role ID | File Name | Format | Resolution | Color Accent | Description & Visual Equipment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **swordsman** | `swordsman.webp` | WebP | 1024x1536 | Moonlit Blue (`#7899D5`) | Disciplined blade master in articulated moonsteel armor with an enchanted pale-blue double-edged longsword in battle stance. |
| **archer** | `archer.webp` | WebP | 1024x1536 | Celestial Ice (`#C9E5FF`) | Agile lunar marksman with hooded cloak, silver leather vambraces, and a glowing curved composite bow nocked with astral energy. |
| **mage** | `mage.webp` | WebP | 1024x1536 | Lunar Violet (`#8D78D6`) | Arcane sorceress in flowing violet-indigo celestial robes, floating with hands weaving glowing starlight glyphs and arcane focus. |
| **tank** | `tank.webp` | WebP | 1024x1536 | Deep Indigo (`#7899D5`) | Imposing bastion sentinel in heavy moon-forged plate armor wielding a towering astral crest shield and heavy mace. |
| **rogue** | `rogue.webp` | WebP | 1024x1536 | Lunar Violet (`#8D78D6`) | Dusk trickster in lightweight dark leather gear wielding paired reverse-grip daggers, stepping through subtle shadow mists. |
| **assassin** | `assassin.webp` | WebP | 1024x1536 | Danger Crimson (`#DC5269`) | Eclipse finisher in sleek obsidian armor, wielding twin executioner katars with crimson-violet lunar edge highlights. |
| **vanguard** | `vanguard.webp` | WebP | 1024x1536 | Diya Amber (`#E8A75A`) | Frontline heavy bruiser with rugged horned steel armor, dynamic wide stance, and a massive runic two-handed war-hammer. |
| **paladin** | `paladin.webp` | WebP | 1024x1536 | Antique Gold (`#C8A96E`) | Radiant guardian in polished silver and gold sunburst armor, holding a consecrated holy flanged mace and glowing divine kite shield. |

---

## 3. Character Portraits (`/portraits/`)

Square 512x512 matching portraits extracted from canonical character illustrations, optimized for selection tiles, roster cards, and codex modals.

| Role ID | File Name | Format | Resolution | Intended Component Placement |
| :--- | :--- | :--- | :--- | :--- |
| **swordsman** | `swordsman.webp` | WebP | 512x512 | `CharacterSelectTile.tsx`, `RoleCodexModal.tsx` |
| **archer** | `archer.webp` | WebP | 512x512 | `CharacterSelectTile.tsx`, `RoleCodexModal.tsx` |
| **mage** | `mage.webp` | WebP | 512x512 | `CharacterSelectTile.tsx`, `RoleCodexModal.tsx` |
| **tank** | `tank.webp` | WebP | 512x512 | `CharacterSelectTile.tsx`, `RoleCodexModal.tsx` |
| **rogue** | `rogue.webp` | WebP | 512x512 | `CharacterSelectTile.tsx`, `RoleCodexModal.tsx` |
| **assassin** | `assassin.webp` | WebP | 512x512 | `CharacterSelectTile.tsx`, `RoleCodexModal.tsx` |
| **vanguard** | `vanguard.webp` | WebP | 512x512 | `CharacterSelectTile.tsx`, `RoleCodexModal.tsx` |
| **paladin** | `paladin.webp` | WebP | 512x512 | `CharacterSelectTile.tsx`, `RoleCodexModal.tsx` |

---

## 4. UI & Action Vector Assets (`/ui/`)

Vector SVG iconography styled for high-contrast accessibility and crisp display at all DPRs.

| Asset Name | File Name | Format | Dimensions | Intended Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Strike Icon** | `strike.svg` | SVG | 64x64 | `ActionBar.tsx` (Strike Action Button) |
| **Guard Icon** | `guard.svg` | SVG | 64x64 | `ActionBar.tsx` (Guard Action Button) |
| **Skill Icon** | `skill.svg` | SVG | 64x64 | `ActionBar.tsx` (Signature Skill Button) |
| **Lunar Crest** | `lunar_crest.svg` | SVG | 64x64 | `HeaderNav.tsx`, `ArenaScreen.tsx` (Tournament Emblem) |

---

## 5. Color Palette & Lighting Tokens

| Token Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| `midnight_navy` | `#080D20` | Root stage background and deep ambient shadows |
| `deep_indigo` | `#141936` | Card panels, vitals containers, and tournament borders |
| `moonlit_blue` | `#7899D5` | Primary moonlight highlights and Swordsman/Tank aura |
| `celestial_ice` | `#C9E5FF` | Arrow trails, frost runes, and health gauge overlays |
| `warm_ivory` | `#F3ECDD` | High-contrast readable typography and stat headers |
| `antique_gold` | `#C8A96E` | Series champion crown, borders, and Paladin aura |
| `lunar_violet` | `#8D78D6` | Mage arcane burst and Rogue shadow mist highlights |
| `diya_amber_accent`| `#E8A75A` | Vanguard impact shockwave and action timers |
| `danger_crimson` | `#DC5269` | Assassin lethal blade, low HP warning, and damage flash |
