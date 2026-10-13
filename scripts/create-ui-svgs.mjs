import fs from 'fs';
import path from 'path';

const DEST_BASE = 'd:\\Projects\\dungeon-hunt\\apps\\web\\public\\assets\\game';

// Strike SVG: Crossed moonsteel runic blades with glowing cyan-blue energy
const strikeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <defs>
    <linearGradient id="strikeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C9E5FF" />
      <stop offset="50%" stop-color="#7899D5" />
      <stop offset="100%" stop-color="#141936" />
    </linearGradient>
    <filter id="bladeGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <circle cx="50" cy="50" r="46" fill="#080D20" stroke="#7899D5" stroke-width="2.5" />
  <circle cx="50" cy="50" r="41" fill="#141936" stroke="#C8A96E" stroke-dasharray="3 3" stroke-width="1.2" />
  <!-- Left Blade -->
  <path d="M26 74 L32 80 L76 36 L70 30 Z" fill="url(#strikeGlow)" filter="url(#bladeGlow)" />
  <path d="M76 36 L84 22 L70 30 Z" fill="#C9E5FF" />
  <path d="M22 78 L28 84 L18 88 Z" fill="#C8A96E" />
  <!-- Right Blade -->
  <path d="M74 74 L68 80 L24 36 L30 30 Z" fill="url(#strikeGlow)" filter="url(#bladeGlow)" />
  <path d="M24 36 L16 22 L30 30 Z" fill="#C9E5FF" />
  <path d="M78 78 L72 84 L82 88 Z" fill="#C8A96E" />
  <!-- Center Clash Spark -->
  <polygon points="50,42 53,48 59,50 53,52 50,58 47,52 41,50 47,48" fill="#FFF" filter="url(#bladeGlow)" />
</svg>`;

// Guard SVG: Heavy moon-crested shield with celestial protective runes
const guardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E2856" />
      <stop offset="50%" stop-color="#141936" />
      <stop offset="100%" stop-color="#080D20" />
    </linearGradient>
    <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F3ECDD" />
      <stop offset="50%" stop-color="#C8A96E" />
      <stop offset="100%" stop-color="#8E6A2A" />
    </linearGradient>
    <filter id="shieldGlow">
      <feGaussianBlur stdDeviation="3.5" result="glow" />
      <feComposite in="SourceGraphic" in2="glow" operator="over" />
    </filter>
  </defs>
  <circle cx="50" cy="50" r="46" fill="#080D20" stroke="#8D78D6" stroke-width="2.5" />
  <circle cx="50" cy="50" r="41" fill="#141936" stroke="#7899D5" stroke-dasharray="2 2" stroke-width="1" />
  <!-- Kite Shield -->
  <path d="M28 26 L72 26 L68 62 L50 82 L32 62 Z" fill="url(#shieldGrad)" stroke="url(#goldTrim)" stroke-width="2.5" filter="url(#shieldGlow)" />
  <!-- Inner Crescent Moon -->
  <path d="M52 36 A15 15 0 0 0 52 66 A11 11 0 0 1 52 36 Z" fill="#C9E5FF" filter="url(#shieldGlow)" />
  <circle cx="50" cy="51" r="2" fill="#FFF" />
</svg>`;

// Skill SVG: Radiant crescent moon with celestial starburst and magical violet aura
const skillSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <defs>
    <linearGradient id="skillViolet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C9E5FF" />
      <stop offset="50%" stop-color="#8D78D6" />
      <stop offset="100%" stop-color="#3A1C71" />
    </linearGradient>
    <filter id="starGlow">
      <feGaussianBlur stdDeviation="4" result="glow" />
      <feComposite in="SourceGraphic" in2="glow" operator="over" />
    </filter>
  </defs>
  <circle cx="50" cy="50" r="46" fill="#080D20" stroke="#C8A96E" stroke-width="2.5" />
  <circle cx="50" cy="50" r="41" fill="#141936" stroke="#8D78D6" stroke-dasharray="4 2" stroke-width="1.2" />
  <!-- Crescent Moon -->
  <path d="M54 22 A26 26 0 1 0 74 70 A28 28 0 1 1 54 22 Z" fill="url(#skillViolet)" filter="url(#starGlow)" />
  <!-- 8-point Celestial Star -->
  <polygon points="58,36 61,46 71,49 61,52 58,62 55,52 45,49 55,46" fill="#F3ECDD" filter="url(#starGlow)" />
  <circle cx="58" cy="49" r="3" fill="#FFF" />
</svg>`;

// Lunar Crest Logo SVG
const lunarCrestSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="crestGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF5DF" />
      <stop offset="40%" stop-color="#C8A96E" />
      <stop offset="100%" stop-color="#6F4E18" />
    </linearGradient>
    <linearGradient id="crestBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C9E5FF" />
      <stop offset="100%" stop-color="#7899D5" />
    </linearGradient>
    <filter id="crestGlow">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <circle cx="60" cy="60" r="54" fill="#080D20" stroke="url(#crestGold)" stroke-width="2.5" />
  <circle cx="60" cy="60" r="48" fill="#141936" stroke="#8D78D6" stroke-width="1.5" stroke-dasharray="3 3" />
  <!-- Large Lunar Crescent -->
  <path d="M60 24 A36 36 0 1 0 92 84 A38 38 0 1 1 60 24 Z" fill="url(#crestGold)" filter="url(#crestGlow)" />
  <!-- Inner Dungeon Sword -->
  <path d="M58 32 L62 32 L61 80 L59 80 Z" fill="url(#crestBlue)" />
  <path d="M50 44 L70 44 L60 48 Z" fill="url(#crestGold)" />
  <polygon points="60,26 62,32 58,32" fill="#FFF" />
  <circle cx="60" cy="85" r="3" fill="url(#crestGold)" />
</svg>`;

fs.writeFileSync(path.join(DEST_BASE, 'ui', 'strike.svg'), strikeSvg);
fs.writeFileSync(path.join(DEST_BASE, 'ui', 'guard.svg'), guardSvg);
fs.writeFileSync(path.join(DEST_BASE, 'ui', 'skill.svg'), skillSvg);
fs.writeFileSync(path.join(DEST_BASE, 'ui', 'lunar_crest.svg'), lunarCrestSvg);

console.log('Saved UI SVG assets: strike, guard, skill, lunar_crest');
