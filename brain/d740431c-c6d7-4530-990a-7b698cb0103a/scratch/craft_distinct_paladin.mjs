import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function addShieldToPaladin() {
  const charactersDir = 'd:/Projects/dungeon-hunt/apps/web/public/assets/game/characters';
  const paladinPath = path.join(charactersDir, 'paladin.webp');
  const tempPath = path.join(charactersDir, 'paladin_shield.webp');

  const fileBuf = fs.readFileSync(paladinPath);
  const { info } = await sharp(fileBuf).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  // Golden Holy Kite Shield
  const shieldW = Math.round(w * 0.44);
  const shieldH = Math.round(h * 0.48);
  const shieldLeft = Math.round(w * 0.08);
  const shieldTop = Math.round(h * 0.32);

  const shieldSvg = `
  <svg width="${shieldW}" height="${shieldH}" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shieldGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF8D6"/>
        <stop offset="25%" stop-color="#E8C86A"/>
        <stop offset="60%" stop-color="#C8A96E"/>
        <stop offset="100%" stop-color="#8C682A"/>
      </linearGradient>
      <linearGradient id="shieldInner" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1B2245"/>
        <stop offset="100%" stop-color="#0E122B"/>
      </linearGradient>
      <radialGradient id="sunGlow" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="#FFF3A8" stop-opacity="1"/>
        <stop offset="40%" stop-color="#FFB300" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#FF8F00" stop-opacity="0"/>
      </radialGradient>
      <filter id="shieldShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="10" dy="15" stdDeviation="15" flood-color="#000000" flood-opacity="0.7"/>
      </filter>
    </defs>

    <g filter="url(#shieldShadow)">
      <!-- Outer Golden Rim of Kite Shield -->
      <path d="M 50 40 L 350 40 Q 360 40 355 70 Q 340 340 200 560 Q 60 340 45 70 Q 40 40 50 40 Z"
            fill="url(#shieldGold)" stroke="#FFF3A8" stroke-width="4"/>

      <!-- Inner Indigo Core -->
      <path d="M 70 60 L 330 60 Q 340 60 335 85 Q 320 330 200 520 Q 80 330 65 85 Q 60 60 70 60 Z"
            fill="url(#shieldInner)" stroke="#8C682A" stroke-width="3"/>

      <!-- Golden Cross Inlay -->
      <path d="M 185 80 L 215 80 L 215 480 L 185 480 Z" fill="url(#shieldGold)" opacity="0.85"/>
      <path d="M 100 180 L 300 180 L 300 210 L 100 210 Z" fill="url(#shieldGold)" opacity="0.85"/>

      <!-- Holy Radiant Sunburst Center -->
      <circle cx="200" cy="195" r="75" fill="url(#sunGlow)"/>
      <circle cx="200" cy="195" r="45" fill="url(#shieldGold)" stroke="#FFF8D6" stroke-width="3"/>
      
      <!-- Central Solar Eye / Diamond Gem -->
      <polygon points="200,165 220,195 200,225 180,195" fill="#C9E5FF" stroke="#FFF" stroke-width="2"/>

      <!-- Radiant Sunburst Flairs -->
      <path d="M 200 115 L 208 145 L 200 140 L 192 145 Z" fill="#FFF3A8"/>
      <path d="M 200 275 L 208 245 L 200 250 L 192 245 Z" fill="#FFF3A8"/>
      <path d="M 120 195 L 150 203 L 145 195 L 150 187 Z" fill="#FFF3A8"/>
      <path d="M 280 195 L 250 203 L 255 195 L 250 187 Z" fill="#FFF3A8"/>

      <!-- Bottom Holy Spike Inlay -->
      <path d="M 195 380 L 205 380 L 200 460 Z" fill="#FFF3A8"/>
    </g>
  </svg>
  `;

  // Composite shield onto Paladin
  await sharp(fileBuf)
    .composite([
      {
        input: Buffer.from(shieldSvg),
        left: shieldLeft,
        top: shieldTop,
        blend: 'over'
      }
    ])
    .webp({ effort: 6, quality: 95 })
    .toFile(tempPath);

  // Replace original file with the new shield version
  fs.copyFileSync(tempPath, paladinPath);
  fs.unlinkSync(tempPath);

  // Update portrait
  const portraitSize = 512;
  await sharp(paladinPath)
    .extract({
      left: Math.round(w * 0.12),
      top: Math.round(h * 0.08),
      width: Math.round(w * 0.65),
      height: Math.round(w * 0.65),
    })
    .resize(portraitSize, portraitSize)
    .webp({ effort: 6, quality: 95 })
    .toFile('d:/Projects/dungeon-hunt/apps/web/public/assets/game/portraits/paladin.webp');

  console.log('✓ Paladin equipped with Golden Holy Kite Shield successfully!');
}

addShieldToPaladin().catch(console.error);
