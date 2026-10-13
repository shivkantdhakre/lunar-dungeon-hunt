import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Let's create an intelligent cutout script that handles Archer, Mage, and all characters
const artifactsDir = 'C:/Users/DEll/.gemini/antigravity-ide/brain/d740431c-c6d7-4530-990a-7b698cb0103a';
const outputDir = 'd:/Projects/dungeon-hunt/apps/web/public/assets/game/characters';

async function processArcher() {
  const inputPath = path.join(artifactsDir, 'char_archer_full_1791760278389.jpg');
  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);

  // Archer has:
  // - Background sky with moon and stars
  // - Dark mountains in the lower half
  // - Stone floor at the bottom
  // - Distinct black outlines around the cloak, boots, bow, hands, and hood.
  //
  // Let's inspect background color profile:
  // Sky at top corners: r < 30, g < 35, b < 45
  // Moon: r > 180, g > 200, b > 230 located in top-left (x between 100-350, y between 60-200)
  // Mountains: r < 40, g < 45, b < 50
  // Floor: r < 45, g < 50, b < 55
  
  // Let's use flood-fill with multiple seeds and obstacle detection
  const isBackground = new Uint8Array(width * height);
  const queue = [];

  // Seed entire perimeter
  for (let x = 0; x < width; x++) {
    queue.push(x, 0);
    queue.push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    queue.push(0, y);
    queue.push(width - 1, y);
  }
  
  // Also seed the moon region specifically since it's background!
  for (let y = 70; y < 170; y++) {
    for (let x = 140; x < 260; x++) {
      queue.push(x, y);
    }
  }

  // Also seed the mountain gaps between cloak and edges
  for (let y = 300; y < 650; y++) {
    queue.push(10, y);
    queue.push(width - 10, y);
    queue.push(50, y);
    queue.push(width - 50, y);
  }

  // Define edge detection or character boundary
  // Character has:
  // - Cloak: rich black/leather with silver embroidery and stars
  // - Arrow quiver: cyan/silver arrows
  // - Glowing bow: cyan crystal arrow
  // Notice: The archer body is contained roughly within x: 60 to 960, y: 160 to 950
  
  while (queue.length > 0) {
    const cy = queue.pop();
    const cx = queue.pop();
    const idx = cy * width + cx;
    if (isBackground[idx]) continue;

    const p = idx * channels;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];

    // Is this pixel part of the character?
    // Character pixels:
    // - Skin: r > 160, g > 130, b > 120 (face/hands)
    // - Cyan glow (arrow/crystals): b > 160, g > 130, b > r + 30
    // - Wooden bow: r > 80, g > 50, b < 60
    // - Silver embroidery / belts / buckles: bright accents inside character box
    // - Cloak highlights: r > 45 || g > 45 || b > 55 when inside character box
    
    // Moon detection: The moon is at x: 130-290, y: 60-190
    const inMoon = cx >= 120 && cx <= 300 && cy >= 50 && cy <= 200;
    
    // Sky/mountain is dark (r < 40, g < 45, b < 52)
    const isDarkBg = (r <= 40 && g <= 46 && b <= 54);
    const isFloorBg = cy > 820 && (r <= 48 && g <= 52 && b <= 58);
    const isStar = (r > 100 && g > 100 && b > 100 && cx < 250 && cy < 300); // small star dots in sky

    if (inMoon || isDarkBg || isFloorBg || isStar) {
      isBackground[idx] = 1;
      
      // Expand 4-connectivity
      if (cx > 0 && !isBackground[idx - 1]) { queue.push(cx - 1, cy); }
      if (cx < width - 1 && !isBackground[idx + 1]) { queue.push(cx + 1, cy); }
      if (cy > 0 && !isBackground[idx - width]) { queue.push(cx, cy - 1); }
      if (cy < height - 1 && !isBackground[idx + width]) { queue.push(cx, cy + 1); }
    }
  }

  // Create clean alpha buffer
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    const o = i * 4;
    out[o] = data[p];
    out[o + 1] = data[p + 1];
    out[o + 2] = data[p + 2];
    out[o + 3] = isBackground[i] ? 0 : 255;
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .webp({ quality: 95, alphaQuality: 100, lossless: false })
    .toFile(path.join(outputDir, 'archer.webp'));

  console.log('Archer processed successfully');
}

processArcher().catch(console.error);
