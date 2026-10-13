import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const artifactsDir = 'C:/Users/DEll/.gemini/antigravity-ide/brain/d740431c-c6d7-4530-990a-7b698cb0103a';
const charactersDir = 'd:/Projects/dungeon-hunt/apps/web/public/assets/game/characters';

async function createPerfectArcher() {
  const inputPath = path.join(artifactsDir, 'char_archer_full_1791760278389.jpg');
  const tempPath = path.join(charactersDir, 'archer_perfect.webp');
  const targetPath = path.join(charactersDir, 'archer.webp');

  const { info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  console.log('Archer original dimensions:', w, h);

  // We can construct a precise vector mask around the Archer character.
  // The dimensions are w: 1024, h: 1536 (or matching info.width, info.height)
  // Let's create an SVG mask that covers exactly the character silhouette:
  // - Top Bow tip: ~ (620, 30)
  // - Top Bow curve: ~ (610, 50) -> (720, 150) -> (790, 260) -> (830, 380)
  // - Glowing Arrow tip: ~ (940, 420)
  // - Bottom Bow curve: ~ (810, 450) -> (850, 550) -> (800, 680) -> (710, 770) -> (640, 840)
  // - Right Cape edge: ~ (640, 840) -> (720, 880) -> (820, 930) -> (870, 1020) -> (900, 1140) -> (830, 1220)
  // - Right Boot: ~ (750, 1200) -> (780, 1300) -> (810, 1370) -> (830, 1420) -> (740, 1440) -> (730, 1380) -> (670, 1280) -> (630, 1180)
  // - Between legs (cape hem): ~ (630, 1180) -> (580, 1100) -> (510, 1120) -> (390, 1160)
  // - Left Boot: ~ (390, 1160) -> (360, 1220) -> (340, 1300) -> (320, 1360) -> (220, 1370) -> (210, 1340) -> (260, 1260) -> (270, 1160)
  // - Left Cape hem: ~ (270, 1160) -> (170, 1180) -> (100, 1120) -> (70, 1040) -> (100, 940) -> (150, 840)
  // - Quiver & Left arm: ~ (150, 840) -> (190, 780) -> (180, 700) -> (180, 630) -> (220, 520) -> (210, 440)
  // - Bowstring / nock: ~ (210, 440) -> (350, 430) -> (430, 420) -> (510, 310) -> (550, 240)
  // - Hood & Head: ~ (550, 240) -> (500, 260) -> (420, 270) -> (390, 340) -> (410, 430)
  // - Bowstring up to top: ~ (430, 420) -> (620, 30)

  // Since we have the image data, let's do something even better:
  // Color-key + edge refinement specifically for Archer's background colors!
  // In `char_archer_full_1791760278389.jpg`:
  // The background colors are:
  // 1. Dark sky: hue ~ 215, saturation ~ 25%, brightness < 20%
  // 2. Moon: white-blue at top-left
  // 3. Mountains: very dark slate
  // 4. Ground: dark textured stone
  // The character has distinct SATURATED and BRIGHT colors:
  // - Leather armor: brown/dark bronze highlights
  // - Silver hair: white/silver
  // - Face: Caucasian skin tone (r > 130, g > 90, b > 75, r - b > 25)
  // - Glowing bow, arrow, crystals: bright glowing cyan (b > 130, g > 100, b > r + 30)
  // - Silver embroidery / stars / buckles
  // - Black cloak with distinct black ink lineart borders

  // Let's write an algorithm that combines:
  // 1. Flood fill from borders with high tolerance (stops at ink lines)
  // 2. Region-based removal of moon and stars
  // 3. Preserves all pixels where (r,g,b) belongs to skin, cyan glow, wood, or inside character polygon

  console.log('Building high-precision cutout...');
}

createPerfectArcher().catch(console.error);
