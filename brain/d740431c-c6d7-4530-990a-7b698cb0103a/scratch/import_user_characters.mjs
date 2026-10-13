import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const userDownloads = 'C:/Users/DEll/Downloads';
const targetDir = 'd:/Projects/dungeon-hunt/apps/web/public/assets/game/characters';
const portraitsDir = 'd:/Projects/dungeon-hunt/apps/web/public/assets/game/portraits';

async function importCharacter(sourceName, destName, cropConfig) {
  const src = path.join(userDownloads, sourceName);
  const dest = path.join(targetDir, destName + '.webp');
  const portraitDest = path.join(portraitsDir, destName + '.webp');

  const buf = fs.readFileSync(src);
  fs.writeFileSync(dest, buf);
  console.log(`Copied ${sourceName} -> ${destName}.webp (${buf.length} bytes)`);

  // Inspect dimensions & alpha
  const meta = await sharp(buf).metadata();
  console.log(`${destName}: width=${meta.width}, height=${meta.height}, channels=${meta.channels}, hasAlpha=${meta.hasAlpha}`);

  // Generate 512x512 matching portrait
  const w = meta.width;
  const h = meta.height;
  const cropLeft = Math.round(w * cropConfig.left);
  const cropTop = Math.round(h * cropConfig.top);
  const cropW = Math.round(w * cropConfig.width);
  const cropH = Math.round(w * cropConfig.height);

  const portraitBuf = await sharp(buf)
    .extract({
      left: Math.min(w - cropW, Math.max(0, cropLeft)),
      top: Math.min(h - cropH, Math.max(0, cropTop)),
      width: cropW,
      height: cropH,
    })
    .resize(512, 512)
    .webp({ effort: 6, quality: 95 })
    .toBuffer();

  fs.writeFileSync(portraitDest, portraitBuf);
  console.log(`✓ Generated portrait for ${destName}`);
}

async function run() {
  await importCharacter('Archer.webp', 'archer', { left: 0.28, top: 0.12, width: 0.44, height: 0.44 });
  await importCharacter('mage.webp', 'mage', { left: 0.30, top: 0.10, width: 0.44, height: 0.44 });
  await importCharacter('Paladin.webp', 'paladin', { left: 0.28, top: 0.10, width: 0.44, height: 0.44 });
}

run().catch(console.error);
