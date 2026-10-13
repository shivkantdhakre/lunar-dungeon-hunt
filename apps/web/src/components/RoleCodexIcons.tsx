'use client';

import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Ornate Celestial Codex Tome Icon
 * Represents the authoritative repository of champion lore and combat arts.
 */
export function CodexTomeIcon({ className = 'w-7 h-7 text-amber-400' }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="codexGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2D6" />
          <stop offset="45%" stopColor="#E5B25D" />
          <stop offset="100%" stopColor="#9B6C1E" />
        </linearGradient>
        <linearGradient id="codexGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7899D5" />
          <stop offset="100%" stopColor="#8D78D6" />
        </linearGradient>
      </defs>
      {/* Tome Spine and Outer Cover */}
      <path
        d="M5 6.5C5 5.12 6.12 4 7.5 4H24.5C25.88 4 27 5.12 27 6.5V23.5C27 24.88 25.88 26 24.5 26H7.5C6.12 26 5 24.88 5 23.5V6.5Z"
        fill="#0E132A"
        stroke="url(#codexGold)"
        strokeWidth="1.5"
      />
      {/* Inner Pages Silhouette */}
      <path
        d="M8 7H24V23H8C6.9 23 6 22.1 6 21V9C6 7.9 6.9 7 8 7Z"
        fill="#181F42"
        stroke="#414D7C"
        strokeWidth="1"
      />
      {/* Book Center Seam / Ribbon */}
      <line x1="16" y1="5" x2="16" y2="25" stroke="url(#codexGold)" strokeWidth="1" strokeDasharray="2 1" />
      {/* Lunar Crescent on Front Plate */}
      <path
        d="M16 11.5 A4.5 4.5 0 1 0 20.5 17 A4.8 4.8 0 1 1 16 11.5 Z"
        fill="url(#codexGold)"
      />
      {/* Radiating 4-point Starlight */}
      <polygon points="16,8 16.8,10.2 19,11 16.8,11.8 16,14 15.2,11.8 13,11 15.2,10.2" fill="#FFF8E7" />
      {/* Bottom Bookmark Ribbon Tassels */}
      <path d="M14.5 25V28.5L16 27.2L17.5 28.5V25" fill="#E5B25D" />
    </svg>
  );
}

/**
 * Sleek Illuminated Modal Close Icon
 */
export function CloseModalIcon({ className = 'w-5 h-5 text-slate-300' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * Health / Vitality Vessel Icon
 */
export function HealthVitalityIcon({ className = 'w-3.5 h-3.5 text-emerald-400' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

/**
 * Base Physical Attack Sword Icon
 * Sleek medieval broadsword with blade pointing to top-right, sharp tip, crossguard, grip, and pommel.
 */
export function AttackPowerIcon({ className = 'w-3.5 h-3.5 text-rose-400' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Sleek diagonal broadsword pointing to top-right */}
      <path
        d="M20.8 3.2a1 1 0 0 0-1.4 0l-8.6 8.6-2-2a.7.7 0 0 0-1 0l-.7.7a.7.7 0 0 0 0 1l1.6 1.6-4.6 4.6-1.4-.4a.7.7 0 0 0-.8.2l-.7.7a.7.7 0 0 0 0 1l2.4 2.4a.7.7 0 0 0 1 0l.7-.7a.7.7 0 0 0 .2-.8l-.4-1.4 4.6-4.6 1.6 1.6a.7.7 0 0 0 1 0l.7-.7a.7.7 0 0 0 0-1l-2-2 8.6-8.6a1 1 0 0 0 0-1.4l-.8-.8z"
      />
    </svg>
  );
}

/**
 * Signature Skill Starlight Glyphs
 */
export function SkillStarIcon({ className = 'w-3.5 h-3.5 text-amber-400' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2L14.3 8.7L21 11L14.3 13.3L12 20L9.7 13.3L3 11L9.7 8.7L12 2Z" />
      <circle cx="12" cy="11" r="1.5" fill="#FFF" />
    </svg>
  );
}

/**
 * Energy / Skill Charge Gem Pip
 */
export function ChargeGemIcon({ className = 'w-3 h-3 text-amber-400' }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <polygon points="10,2 17,7 17,13 10,18 3,13 3,7" />
    </svg>
  );
}

/**
 * Shield Break / Vulnerability Warning Icon
 */
export function ShieldBreakWarningIcon({ className = 'w-3.5 h-3.5 text-rose-400' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.15" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5" />
      <path d="M9 10L15 14" strokeWidth="1.5" strokeDasharray="2 1" />
    </svg>
  );
}

/**
 * Bespoke Vector Archetype Icons for Each of the 8 Canonical Roles
 */
export function RoleClassIcon({
  roleId,
  className = 'w-4 h-4',
}: {
  roleId: string;
  className?: string;
}) {
  const normalized = (roleId || '').toLowerCase();

  switch (normalized) {
    case 'swordsman':
      // Moonsteel Sword / Rapier Edge
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-label="Swordsman">
          <path d="M19 3L14 8M14 8L5 17L3 21L7 19L16 10M14 8L16 10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 13L13 15" strokeLinecap="round" />
          <path d="M18 6L21 9" strokeLinecap="round" />
        </svg>
      );

    case 'archer':
      // Celestial Bow & Feathered Arrow
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-label="Archer">
          <path d="M4 20C10 20 18 16 20 4C8 6 4 14 4 20Z" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="4" y1="20" x2="15" y2="9" strokeLinecap="round" />
          <polyline points="10,9 15,9 15,14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'mage':
      // Arcane Starlight Weaver / Celestial Orb Sigil
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-label="Mage">
          <circle cx="12" cy="12" r="7" strokeDasharray="3 2" />
          <polygon points="12,5 13.8,10.2 19,12 13.8,13.8 12,19 10.2,13.8 5,12 10.2,10.2" fill="currentColor" fillOpacity="0.25" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      );

    case 'tank':
      // Bastion Bulwark Shield
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-label="Tank">
          <path d="M12 2L4 5V11C4 16.5 7.4 21.6 12 22C16.6 21.6 20 16.5 20 11V5L12 2Z" fill="currentColor" fillOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="6" x2="12" y2="17" strokeLinecap="round" />
          <line x1="8" y1="10" x2="16" y2="10" strokeLinecap="round" />
        </svg>
      );

    case 'rogue':
      // Twin Curved Dusk Daggers
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-label="Rogue">
          <path d="M6 3L11 8L5 18L3 17L6 11L4 10L6 3Z" fill="currentColor" fillOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 3L13 8L19 18L21 17L18 11L20 10L18 3Z" fill="currentColor" fillOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="4" cy="20" r="1.2" fill="currentColor" />
          <circle cx="20" cy="20" r="1.2" fill="currentColor" />
        </svg>
      );

    case 'assassin':
      // Eclipse Executioner / Moon Crescent Scythe
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-label="Assassin">
          <path d="M21 4C14 4 7 9 5 17L3 21L7 19C15 17 20 10 21 4Z" fill="currentColor" fillOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="15" cy="9" r="2.5" strokeDasharray="2 1" />
          <line x1="3" y1="21" x2="11" y2="13" strokeLinecap="round" />
        </svg>
      );

    case 'vanguard':
      // Heavy Seismic Great-Hammer
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-label="Vanguard">
          <rect x="7" y="3" width="10" height="6" rx="1.5" fill="currentColor" fillOpacity="0.25" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="9" x2="12" y2="21" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="10" y1="21" x2="14" y2="21" strokeLinecap="round" />
          <line x1="5" y1="6" x2="7" y2="6" strokeLinecap="round" />
          <line x1="17" y1="6" x2="19" y2="6" strokeLinecap="round" />
        </svg>
      );

    case 'paladin':
      // Sacred Dawnkeeper / Radiant Sun Crest Aegis
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-label="Paladin">
          <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 2V5M12 19V22M2 12H5M19 12H22" strokeLinecap="round" />
          <path d="M4.9 4.9L7.1 7.1M16.9 16.9L19.1 19.1M4.9 19.1L7.1 16.9M16.9 7.1L19.1 4.9" strokeLinecap="round" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      );

    default:
      return <SkillStarIcon className={className} />;
  }
}

/**
 * Royal Gold Corner Filigree for Codex Frames
 */
export function OrnamentalCorner({ className = 'w-4 h-4 text-[#C8A96E]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 2H12C12 7.5 7.5 12 2 12V2Z" fill="currentColor" fillOpacity="0.25" />
      <path d="M2 22V10C2 5.58 5.58 2 10 2H22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 18V10C6 7.79 7.79 6 10 6H18" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 2" />
      <circle cx="6" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

/**
 * Antique Parchment Header/Divider Motif
 */
export function ParchmentDividerFlourish({ className = 'w-32 h-4 text-[#C8A96E]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <line x1="0" y1="8" x2="60" y2="8" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
      <polygon points="80,2 84,8 80,14 76,8" fill="currentColor" />
      <circle cx="68" cy="8" r="2.5" fill="currentColor" />
      <circle cx="92" cy="8" r="2.5" fill="currentColor" />
      <line x1="100" y1="8" x2="160" y2="8" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  );
}

/**
 * Top-Left Arch Medallion: Open Tome, Radiant Crescent Moon & Gold Filigree
 */
export function CelestialCodexEmblem({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="emblemGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF9E8" />
          <stop offset="45%" stopColor="#E5B25D" />
          <stop offset="100%" stopColor="#9B6C1E" />
        </linearGradient>
        <radialGradient id="emblemGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF9E8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#1E2856" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Outer Arch Frame */}
      <path
        d="M12 70V32C12 16.5 24.5 4 40 4C55.5 4 68 16.5 68 32V70"
        stroke="url(#emblemGold)"
        strokeWidth="2.5"
        fill="#0D1432"
      />
      <circle cx="40" cy="40" r="32" fill="url(#emblemGlow)" />
      {/* Crescent Moon at the Apex */}
      <path
        d="M40 10 A7 7 0 1 0 46 22 A8 8 0 1 1 40 10 Z"
        fill="url(#emblemGold)"
      />
      <polygon points="40,16 41,19 44,20 41,21 40,24 39,21 36,20 39,19" fill="#FFF" />
      {/* Open Book Wings */}
      <path
        d="M24 54C24 48 31 46 40 48C49 46 56 48 56 54V38C49 34 44 35 40 37C36 35 31 34 24 38V54Z"
        fill="#FAF6EE"
        stroke="url(#emblemGold)"
        strokeWidth="1.2"
      />
      <line x1="40" y1="37" x2="40" y2="48" stroke="url(#emblemGold)" strokeWidth="1.5" />
      {/* Book Binding Ribbons */}
      <path d="M38 52V62L40 60L42 62V52" fill="url(#emblemGold)" />
      {/* Radiating Light Rays */}
      <line x1="20" y1="30" x2="16" y2="28" stroke="url(#emblemGold)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="60" y1="30" x2="64" y2="28" stroke="url(#emblemGold)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="24" y1="20" x2="20" y2="16" stroke="url(#emblemGold)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="56" y1="20" x2="60" y2="16" stroke="url(#emblemGold)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Hanging Celestial Blue Heraldic Banner with Gold Star
 */
export function CelestialBanner({ className = 'w-6 h-28' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bannerBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B5998" />
          <stop offset="50%" stopColor="#1E3066" />
          <stop offset="100%" stopColor="#14214D" />
        </linearGradient>
      </defs>
      {/* Top Hanging Bar */}
      <rect x="0" y="2" width="24" height="3" rx="1.5" fill="#E5B25D" />
      <circle cx="1" cy="3.5" r="2" fill="#C8A96E" />
      <circle cx="23" cy="3.5" r="2" fill="#C8A96E" />
      {/* Banner Cloth with V-cut tail */}
      <path
        d="M2 5H22V86L12 78L2 86V5Z"
        fill="url(#bannerBlue)"
        stroke="#C8A96E"
        strokeWidth="1"
      />
      {/* Inner Decorative Border */}
      <path
        d="M4 8H20V80L12 74L4 80V8Z"
        stroke="#E5B25D"
        strokeWidth="0.8"
        strokeDasharray="2 2"
        fill="none"
      />
      {/* Central 8-Point Gold Star Sigil */}
      <circle cx="12" cy="40" r="7" stroke="#E5B25D" strokeWidth="0.8" fill="#14214D" />
      <polygon points="12,32 13.5,38 19.5,40 13.5,42 12,48 10.5,42 4.5,40 10.5,38" fill="#FFF9E8" />
      <circle cx="12" cy="40" r="1.5" fill="#E5B25D" />
    </svg>
  );
}

/**
 * Concentric Glowing Celestial Runic Dais Platform
 */
export function CelestialDais({ className = 'w-72 h-20' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="daisGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#818CF8" stopOpacity="0.25" />
          <stop offset="85%" stopColor="#E5B25D" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0B1330" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="daisGold" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C8A96E" />
          <stop offset="50%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#C8A96E" />
        </linearGradient>
      </defs>
      {/* Ambient Starlight Platform Glow */}
      <ellipse cx="150" cy="46" rx="146" ry="32" fill="url(#daisGlow)" />
      {/* Base Dark Platform */}
      <ellipse cx="150" cy="48" rx="140" ry="28" fill="#0C1434" stroke="url(#daisGold)" strokeWidth="1.6" />
      {/* Outer Runic Track with Star Rays */}
      <ellipse cx="150" cy="46" rx="124" ry="24" stroke="#38BDF8" strokeWidth="1.2" strokeOpacity="0.8" strokeDasharray="6 3" />
      {/* Middle Golden Orbit Ring */}
      <ellipse cx="150" cy="44" rx="104" ry="19" stroke="url(#daisGold)" strokeWidth="1.4" />
      {/* Inner Radiant Ring */}
      <ellipse cx="150" cy="42" rx="80" ry="14" fill="#132050" stroke="#60A5FA" strokeWidth="1.4" strokeOpacity="0.9" />
      {/* Core Starlight Disc */}
      <ellipse cx="150" cy="40" rx="52" ry="9" fill="#38BDF8" fillOpacity="0.35" stroke="#BAE6FD" strokeWidth="1" />
      {/* Cardinal Star Markers */}
      <circle cx="150" cy="22" r="2" fill="#FDE68A" />
      <circle cx="150" cy="66" r="2" fill="#FDE68A" />
      <circle cx="26" cy="46" r="2" fill="#FDE68A" />
      <circle cx="274" cy="46" r="2" fill="#FDE68A" />
    </svg>
  );
}

/**
 * Small Golden Crescent Moon & Star Medallion for Bottom Footer
 * Delicate horizontal crescent cradling an evening star.
 */
export function BottomCrescentEmblem({ className = 'w-6 h-4 text-[#C8A96E]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Golden horizontal crescent moon cradling radiant star */}
      <path
        d="M6 3C11 12 21 12 26 3C22 9.5 10 9.5 6 3Z"
        fill="currentColor"
      />
      <circle cx="16" cy="5.5" r="1.5" fill="#FFF9E8" />
    </svg>
  );
}

