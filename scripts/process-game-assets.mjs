import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BRAIN_DIR = 'C:\\Users\\DEll\\.gemini\\antigravity-ide\\brain\\d740431c-c6d7-4530-990a-7b698cb0103a';
const DEST_BASE = 'd:\\Projects\\dungeon-hunt\\apps\\web\\public\\assets\\game';

// Ensure directories
const dirs = ['environments', 'characters', 'portraits', 'ui', 'effects'];
for (const d of dirs) {
  fs.mkdirSync(path.join(DEST_BASE, d), { recursive: true });
}

console.log('Created directories in', DEST_BASE);

// Process Environments
const environments = [
  { src: 'primary_battle_arena_1791760153627.jpg', dest: 'primary_battle_arena.webp' },
  { src: 'main_lunar_backdrop_clean_1791760186739.jpg', dest: 'main_lunar_backdrop.webp' },
  { src: 'sudden_death_arena_1791760204410.jpg', dest: 'sudden_death_arena.webp' },
  { src: 'character_selection_arena_1791760224075.jpg', dest: 'character_selection_arena.webp' },
  { src: 'victory_defeat_backdrop_1791760240228.jpg', dest: 'victory_defeat_backdrop.webp' },
];

for (const env of environments) {
  const srcPath = path.join(BRAIN_DIR, env.src);
  const destPath = path.join(DEST_BASE, 'environments', env.dest);
  if (fs.existsSync(srcPath)) {
    await sharp(srcPath)
      .webp({ quality: 90 })
      .toFile(destPath);
    console.log(`Saved environment: ${env.dest}`);
  } else {
    console.warn(`Missing: ${srcPath}`);
  }
}

// Character mappings
const characters = [
  { key: 'swordsman', file: 'char_swordsman_full_1791760259637.jpg', crop: { top: 120, left: 300, size: 480 } },
  { key: 'archer', file: 'char_archer_full_1791760278389.jpg', crop: { top: 100, left: 280, size: 500 } },
  { key: 'mage', file: 'char_mage_full_1791760295014.jpg', crop: { top: 100, left: 300, size: 480 } },
  { key: 'tank', file: 'char_tank_full_1791760321591.jpg', crop: { top: 50, left: 270, size: 520 } },
  { key: 'rogue', file: 'char_rogue_full_1791760338034.jpg', crop: { top: 100, left: 320, size: 480 } },
  { key: 'assassin', file: 'char_assassin_full_1791760357400.jpg', crop: { top: 80, left: 280, size: 480 } },
  { key: 'vanguard', file: 'char_vanguard_full_1791760376871.jpg', crop: { top: 70, left: 260, size: 520 } },
];

for (const c of characters) {
  const srcPath = path.join(BRAIN_DIR, c.file);
  const fullDest = path.join(DEST_BASE, 'characters', `${c.key}.webp`);
  const portraitDest = path.join(DEST_BASE, 'portraits', `${c.key}.webp`);

  if (fs.existsSync(srcPath)) {
    // Save full body
    await sharp(srcPath)
      .webp({ quality: 90 })
      .toFile(fullDest);
    console.log(`Saved character full: ${c.key}.webp`);

    // Crop portrait
    const meta = await sharp(srcPath).metadata();
    const top = Math.min(c.crop.top, meta.height - 400);
    const left = Math.min(c.crop.left, meta.width - 400);
    const size = Math.min(c.crop.size, meta.width - left, meta.height - top);

    await sharp(srcPath)
      .extract({ left, top, width: size, height: size })
      .resize(512, 512)
      .webp({ quality: 92 })
      .toFile(portraitDest);
    console.log(`Saved portrait: ${c.key}.webp`);
  }
}

// Create Paladin from Tank/Swordsman with radiant gold-white celestial treatment
const swordsmanSrc = path.join(BRAIN_DIR, 'char_swordsman_full_1791760259637.jpg');
if (fs.existsSync(swordsmanSrc)) {
  const paladinFull = path.join(DEST_BASE, 'characters', 'paladin.webp');
  const paladinPortrait = path.join(DEST_BASE, 'portraits', 'paladin.webp');

  // Modulate colors towards golden-ivory celestial warmth
  await sharp(swordsmanSrc)
    .modulate({
      brightness: 1.15,
      saturation: 1.25,
      hue: 45 // Shifts blue-silver towards radiant golden-celestial ivory
    })
    .webp({ quality: 90 })
    .toFile(paladinFull);
  console.log('Saved paladin full body (celestial gold-ivory variant)');

  await sharp(swordsmanSrc)
    .extract({ left: 300, top: 120, width: 480, height: 480 })
    .modulate({
      brightness: 1.15,
      saturation: 1.25,
      hue: 45
    })
    .resize(512, 512)
    .webp({ quality: 92 })
    .toFile(paladinPortrait);
  console.log('Saved paladin portrait (celestial gold-ivory variant)');
}
