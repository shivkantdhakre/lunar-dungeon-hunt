import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const charactersDir = 'd:/Projects/dungeon-hunt/apps/web/public/assets/game/characters';

async function cleanArcherFinal() {
  const filePath = path.join(charactersDir, 'archer.webp');
  const tempPath = path.join(charactersDir, 'archer_clean.webp');
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const out = Buffer.from(data);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (out[idx + 3] === 0) continue;

      const r = out[idx];
      const g = out[idx + 1];
      const b = out[idx + 2];

      // Moon area (top left, x < 280, y < 220)
      if (x < 280 && y < 220) {
        out[idx + 3] = 0;
        continue;
      }

      // Left mountain sky (x < 180, y < 650)
      if (x < 180 && y < 650 && !(x > 120 && y > 400)) {
        out[idx + 3] = 0;
        continue;
      }
      if (x < 120 && y < 750) {
        out[idx + 3] = 0;
        continue;
      }

      // Right mountain sky (x > 840, y < 350)
      if (x > 840 && y < 350 && !(x < 920 && y > 180 && (b > 140 || r > 80))) {
        // preserve bow tip and arrow tip
        const isBowTip = y < 140 && x > 560 && x < 700;
        const isArrowTip = y > 240 && y < 300 && x > 800 && x < 950;
        if (!isBowTip && !isArrowTip) {
          out[idx + 3] = 0;
          continue;
        }
      }

      // Far right empty space
      if (x > 940) {
        out[idx + 3] = 0;
        continue;
      }

      // Bottom ground rock (below y = 840, outside the boots)
      // Boots are at x: 200 to 390 and x: 630 to 840
      if (y > 840) {
        const isLeftBoot = x >= 190 && x <= 390 && y <= 910;
        const isRightBoot = x >= 640 && x <= 850 && y <= 940;
        if (!isLeftBoot && !isRightBoot) {
          out[idx + 3] = 0;
          continue;
        }
      }
      if (y > 935) {
        out[idx + 3] = 0;
        continue;
      }

      // Mountain patches behind cloak: dark pixels with low saturation (r < 45, g < 50, b < 55)
      // that are far from body
      const isFarLeft = x < 210 && y > 200 && y < 500 && r < 40 && g < 45 && b < 52;
      const isFarRight = x > 820 && y > 350 && y < 650 && r < 40 && g < 45 && b < 52;
      if (isFarLeft || isFarRight) {
        out[idx + 3] = 0;
      }
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .webp({ effort: 6, quality: 95 })
    .toFile(tempPath);

  fs.copyFileSync(tempPath, filePath);
  fs.unlinkSync(tempPath);

  console.log('✓ Archer final cleanup complete!');
}

async function cleanMageFinal() {
  const filePath = path.join(charactersDir, 'mage.webp');
  const tempPath = path.join(charactersDir, 'mage_clean.webp');
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const out = Buffer.from(data);

  // Staff head center: x ~ 875, y ~ 160
  // Magic circle center: x ~ 240, y ~ 280

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (out[idx + 3] === 0) continue;

      const r = out[idx];
      const g = out[idx + 1];
      const b = out[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // 1. Clean the dark orb around the staff (x > 700, y < 350)
      if (x > 700 && y < 350) {
        // Staff crystal / wood has distinct colors:
        // Crystal: bright cyan/blue (b > 140, g > 110, r > 80)
        // Silver crescent: bright metallic (lum > 100)
        // Staff wood: brown (r > 60, g > 35, b < 50)
        const isCrystalOrWood = lum > 80 || (r > 60 && g > 35 && b < 50);
        if (!isCrystalOrWood) {
          // If it's the dark vignette background
          if (lum < 50) {
            out[idx + 3] = 0;
            continue;
          } else {
            // Feather the soft glow
            out[idx + 3] = Math.min(255, Math.floor((lum - 50) * 4));
          }
        }
      }

      // 2. Clean dark backing behind magic glyph circle (x < 380, y < 500)
      if (x < 380 && y < 500) {
        // Glowing runes: bright violet / white (lum > 70, b > 90)
        // Cape fabric: flowing purple with stars
        const isGlowOrCloth = lum > 60 || b > 80 || (x > 260 && y > 380);
        if (!isGlowOrCloth) {
          if (lum < 40) {
            out[idx + 3] = 0;
            continue;
          } else {
            out[idx + 3] = Math.min(255, Math.floor((lum - 40) * 5));
          }
        }
      }

      // 3. Clean bottom stone floor
      if (y > 940) {
        out[idx + 3] = 0;
      }
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .webp({ effort: 6, quality: 95 })
    .toFile(tempPath);

  fs.copyFileSync(tempPath, filePath);
  fs.unlinkSync(tempPath);

  console.log('✓ Mage final cleanup complete!');
}

async function run() {
  await cleanArcherFinal();
  await cleanMageFinal();
}
run().catch(console.error);
