import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const artifactsDir = 'C:/Users/DEll/.gemini/antigravity-ide/brain/d740431c-c6d7-4530-990a-7b698cb0103a';
const charactersDir = 'd:/Projects/dungeon-hunt/apps/web/public/assets/game/characters';

async function generateCrispArcher() {
  const inputPath = path.join(artifactsDir, 'char_archer_full_1791760278389.jpg');
  const outputPath = path.join(charactersDir, 'archer.webp');

  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;

  // Let's create an alpha mask buffer
  const isBg = new Uint8Array(w * h);

  // 1. Definite background regions:
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const p = idx * c;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // A. Moon & top-left night sky
      if (x < 320 && y < 250) {
        // preserve silver hood edge if any (x > 300, y > 210)
        if (!(x > 300 && y > 200 && r > 100 && g > 90)) {
          isBg[idx] = 1;
          continue;
        }
      }

      // B. Top-right sky outside upper bow
      if (y < 200 && x > 560) {
        // Upper bow wood & crystal: x ~ 510 to 730
        const isUpperBow = (r > 60 && g > 35 && b < 50) || (b > 140 && g > 110) || lum > 80;
        if (!isUpperBow && (x > 720 || y < 20 || (x > 620 && y < 80))) {
          isBg[idx] = 1;
          continue;
        }
      }

      // C. Far right background outside bow
      if (x > 750) {
        // Glowing arrow tip extends to x ~ 800, y ~ 340-390
        const isArrowTip = x <= 810 && y >= 320 && y <= 400 && b > 140;
        // Lower bow tip extends to x ~ 730, y ~ 650
        const isLowerBow = x <= 740 && y >= 600 && y <= 720 && lum > 60;
        if (!isArrowTip && !isLowerBow) {
          isBg[idx] = 1;
          continue;
        }
      }

      // D. Far left background outside cloak & quiver
      if (x < 140 && y < 600) {
        // Arrow feathers in quiver: x ~ 150-290, y ~ 500-680
        isBg[idx] = 1;
        continue;
      }
      if (x < 50) {
        isBg[idx] = 1;
        continue;
      }

      // E. Floor rock below boots (y > 1180)
      if (y > 1180) {
        isBg[idx] = 1;
        continue;
      }

      // F. Floor between boots (x between 290 and 590, below y = 1140)
      if (y > 1140 && x > 300 && x < 580) {
        isBg[idx] = 1;
        continue;
      }

      // G. Outer left of left boot (x < 160, y > 950)
      if (y > 950 && x < 160) {
        isBg[idx] = 1;
        continue;
      }

      // H. Outer right of right boot (x > 720, y > 950)
      if (y > 950 && x > 720) {
        isBg[idx] = 1;
        continue;
      }

      // I. Sky gap between top bow and archer's head/chest
      // Area bounded by top bowstring (roughly from (520, 30) down to (370, 350))
      // and head (x ~ 330 to 470, y ~ 210 to 350)
      if (y > 30 && y < 210 && x > 440 && x < 540) {
        const isBowOrString = lum > 100 || (b > 130 && g > 110);
        if (!isBowOrString) {
          isBg[idx] = 1;
          continue;
        }
      }
    }
  }

  // Flood fill expand background with low color distance
  const queue = new Int32Array(w * h);
  let qHead = 0, qTail = 0;

  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) queue[qTail++] = i;
  }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % w;
    const y = Math.floor(idx / w);

    const neighbors = [
      x > 0 ? idx - 1 : -1,
      x < w - 1 ? idx + 1 : -1,
      y > 0 ? idx - w : -1,
      y < h - 1 ? idx + w : -1,
    ];

    for (const n of neighbors) {
      if (n === -1 || isBg[n]) continue;

      const p = n * c;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Dark background pixels in sky / mountain
      const isNightSky = lum < 38 && Math.abs(r - g) < 10 && Math.abs(g - b) < 12;
      const isMountain = lum < 45 && (x < 180 || x > 700 || y > 1120);

      // Protect character elements:
      const isSkin = r > 120 && g > 90 && b > 75 && (r - b) > 20;
      const isCyan = b > 120 && g > 95 && b > r + 20;
      const isWood = r > 65 && g > 35 && b < 50;

      if ((isNightSky || isMountain) && !isSkin && !isCyan && !isWood) {
        isBg[n] = 1;
        queue[qTail++] = n;
      }
    }
  }

  // Create clean alpha buffer
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * c;
    out[i * 4] = data[p];
    out[i * 4 + 1] = data[p + 1];
    out[i * 4 + 2] = data[p + 2];
    out[i * 4 + 3] = isBg[i] ? 0 : 255;
  }

  // Soft edge antialiasing
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (isBg[idx]) {
        // If adjacent to character
        if (!isBg[idx-1] || !isBg[idx+1] || !isBg[idx-w] || !isBg[idx+w]) {
          out[idx * 4 + 3] = 60;
        }
      } else {
        if (isBg[idx-1] || isBg[idx+1] || isBg[idx-w] || isBg[idx+w]) {
          out[idx * 4 + 3] = 200;
        }
      }
    }
  }

  const outBuf = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .webp({ effort: 6, quality: 95 })
    .toBuffer();

  fs.writeFileSync(outputPath, outBuf);

  // Update portrait
  const portraitBuf = await sharp(outBuf)
    .extract({
      left: Math.round(w * 0.28),
      top: Math.round(h * 0.12),
      width: Math.round(w * 0.44),
      height: Math.round(w * 0.44),
    })
    .resize(512, 512)
    .webp({ effort: 6, quality: 95 })
    .toBuffer();

  fs.writeFileSync('d:/Projects/dungeon-hunt/apps/web/public/assets/game/portraits/archer.webp', portraitBuf);

  console.log('✓ Crisp Archer created with intact boots, clean alpha background!');
}

generateCrispArcher().catch(console.error);
