import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const artifactsDir = 'C:/Users/DEll/.gemini/antigravity-ide/brain/d740431c-c6d7-4530-990a-7b698cb0103a';
const charactersDir = 'd:/Projects/dungeon-hunt/apps/web/public/assets/game/characters';

async function maskArcherVector() {
  const inputPath = path.join(artifactsDir, 'char_archer_full_1791760278389.jpg');
  const targetPath = path.join(charactersDir, 'archer.webp');

  const { info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;  // 848
  const h = info.height; // 1264

  // Let's create an exact SVG mask:
  // We trace the character tightly, and include inner cutout holes (evenodd)
  const maskSvg = `
  <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="soften" x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="0.8"/>
      </filter>
    </defs>
    <!-- Character Outer Silhouette -->
    <path fill-rule="evenodd" d="
      M 520 28
      L 535 35
      Q 570 80 625 155
      Q 680 230 705 315
      L 715 350
      L 805 360
      L 805 375
      L 715 385
      Q 700 460 670 530
      Q 645 580 675 640
      Q 710 690 620 735
      Q 585 750 635 830
      Q 675 900 730 960
      Q 765 1020 755 1070
      L 740 1140
      L 700 1165
      L 635 1165
      L 615 1130
      L 600 1060
      L 560 1020
      Q 515 970 480 960
      Q 445 970 415 1020
      L 380 1060
      L 360 1130
      L 305 1160
      L 225 1155
      L 205 1130
      L 230 1060
      Q 240 1000 185 950
      Q 135 890 90 820
      Q 65 760 130 720
      Q 150 690 145 630
      L 160 540
      L 175 490
      L 185 430
      Q 200 380 270 385
      L 330 360
      Q 335 300 370 240
      Q 410 190 465 210
      Q 490 230 495 260
      L 475 320
      L 460 360
      Q 475 355 520 28
      Z

      <!-- Inner Hole 1: Top Bowstring to Head Sky Gap -->
      M 515 45
      L 465 355
      L 485 325
      L 500 265
      Q 495 235 470 220
      L 515 45
      Z

      <!-- Inner Hole 2: Lower Bowstring to Waist Sky Gap -->
      M 465 375
      L 615 725
      L 655 640
      Q 635 580 655 530
      L 695 400
      L 465 375
      Z

      <!-- Inner Hole 3: Between Legs Floor Gap -->
      M 365 1125
      L 415 1025
      Q 445 975 480 965
      Q 515 975 555 1025
      L 605 1125
      Q 565 1140 480 1140
      Z
    " fill="#FFFFFF" filter="url(#soften)"/>
  </svg>
  `;

  const maskPng = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  const finalArcher = await sharp(inputPath)
    .ensureAlpha()
    .composite([
      {
        input: maskPng,
        blend: 'dest-in'
      }
    ])
    .webp({ effort: 6, quality: 95 })
    .toBuffer();

  fs.writeFileSync(targetPath, finalArcher);

  // Update portrait
  const portraitSize = 512;
  const portraitBuf = await sharp(finalArcher)
    .extract({
      left: Math.round(w * 0.28),
      top: Math.round(h * 0.12),
      width: Math.round(w * 0.44),
      height: Math.round(w * 0.44),
    })
    .resize(portraitSize, portraitSize)
    .webp({ effort: 6, quality: 95 })
    .toBuffer();

  fs.writeFileSync('d:/Projects/dungeon-hunt/apps/web/public/assets/game/portraits/archer.webp', portraitBuf);

  console.log('✓ Vector-masked Archer with inner cutouts created successfully!');
}

maskArcherVector().catch(console.error);
