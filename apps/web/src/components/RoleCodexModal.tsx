'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ROLES, type RoleDefinition } from '@dungeon-hunt/game-rules';
import { getCharacterAsset } from '../lib/assets/game-assets';
import { CharacterArtwork } from './CharacterArtwork';
import {
  CloseModalIcon,
  HealthVitalityIcon,
  AttackPowerIcon,
  SkillStarIcon,
  ChargeGemIcon,
  ShieldBreakWarningIcon,
  OrnamentalCorner,
  CelestialCodexEmblem,
  CelestialBanner,
  CelestialDais,
  BottomCrescentEmblem,
} from './RoleCodexIcons';

interface RoleCodexModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: string;
  onRoleSelect?: (roleId: string) => void;
}

/**
 * Returns role-specific ability icon style & SVG
 */
function RoleAbilityIcon({ roleId }: { roleId: string }) {
  switch (roleId.toLowerCase()) {
    case 'archer':
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 flex-shrink-0 text-[#E5B25D]" aria-hidden="true">
          <path d="M14 2l-6 6M14 2h-4M14 2v4M4 8l-2 2 4 4 2-2M2 14l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'mage':
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 flex-shrink-0 text-[#C084FC]" aria-hidden="true">
          <path d="M8 1v14M1 8h14M3 3l10 10M3 13L13 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'tank':
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 flex-shrink-0 text-[#E5B25D]" aria-hidden="true">
          <path d="M8 2l5 2v5c0 3-3 5-5 6-2-1-5-3-5-6V4l5-2z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'rogue':
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 flex-shrink-0 text-[#C084FC]" aria-hidden="true">
          <path d="M3 13l9-9M12 4l-4 1-1 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'assassin':
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 flex-shrink-0 text-[#F87171]" aria-hidden="true">
          <path d="M8 1l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
        </svg>
      );
    case 'vanguard':
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 flex-shrink-0 text-[#F59E0B]" aria-hidden="true">
          <path d="M6 3h4v4H6zM4 7h8v2H4zM7 9h2v6H7z" fill="currentColor" />
        </svg>
      );
    case 'paladin':
    case 'swordsman':
    default:
      return <SkillStarIcon className="w-2.5 h-2.5 flex-shrink-0 text-[#E5B25D]" />;
  }
}

export function RoleCodexModal({ isOpen, onClose, initialRole = 'paladin', onRoleSelect }: RoleCodexModalProps) {
  // Default to 'paladin' to showcase the canonical Paladin profile matching the reference design
  const [selectedRole, setSelectedRole] = useState<string>((initialRole || 'paladin').toLowerCase().trim());

  useEffect(() => {
    if (initialRole) {
      setSelectedRole(initialRole.toLowerCase().trim());
    }
  }, [initialRole]);

  const handleSelectRole = (roleId: string) => {
    const cleanId = roleId.toLowerCase().trim();
    setSelectedRole(cleanId);
    if (onRoleSelect) {
      onRoleSelect(cleanId);
    }
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('role', cleanId);
        window.history.replaceState({}, '', url.toString());
      } catch {
        // no-op if URL parsing fails
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rolesList: RoleDefinition[] = Object.values(ROLES);
  const normalizedKey = (selectedRole || 'paladin').toLowerCase().trim();
  const activeDef = ROLES[normalizedKey] ?? ROLES['paladin'] ?? rolesList[0];
  const activeAsset = getCharacterAsset(normalizedKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn select-none">
      {/* Cinematic Moonlit Fantasy Palace Backdrop with Water & Diyas */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <Image
          src="/assets/game/environments/lunar_festival_palace_courtyard.webp"
          alt="Lunar Festival Palace Courtyard"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-center filter brightness-[0.88] saturate-[1.12]"
        />
        {/* Soft Ambient Vignette that keeps lanterns, moon and diyas visible */}
        <div className="absolute inset-0 bg-black/35 backdrop-blur-[0.5px]" />
      </div>

      {/* Main Champion Codex Parchment Container */}
      <div className="relative max-w-6xl w-full rounded-[2.5rem] p-3 sm:p-5 lg:p-6 border-2 border-[#C8A96E] ring-1 ring-[#ECC880]/60 shadow-[0_24px_70px_rgba(0,0,0,0.85)] max-h-[96vh] flex flex-col min-w-0 bg-gradient-to-b from-[#FDFBF7] via-[#F6EFE3] to-[#ECE0CC] text-[#101738]">
        {/* Ornate Gold Corner Filigrees on Outer Parchment Frame */}
        <div className="absolute top-2.5 right-2.5 pointer-events-none rotate-90 z-20">
          <OrnamentalCorner className="w-5 h-5 text-[#C8A96E]" />
        </div>
        <div className="absolute bottom-2.5 left-2.5 pointer-events-none -rotate-90 z-20">
          <OrnamentalCorner className="w-5 h-5 text-[#C8A96E]" />
        </div>
        <div className="absolute bottom-2.5 right-2.5 pointer-events-none rotate-180 z-20">
          <OrnamentalCorner className="w-5 h-5 text-[#C8A96E]" />
        </div>

        {/* Top Header Row with Overlapping Celestial Book Emblem */}
        <div className="relative flex items-center mb-3 min-w-0 z-20">
          {/* Top-Left Arched Celestial Tome Medallion */}
          <div className="relative -ml-1 sm:-ml-2 -mt-4 sm:-mt-6 flex-shrink-0 z-30 filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
            <CelestialCodexEmblem className="w-16 h-16 sm:w-20 sm:h-20" />
          </div>

          {/* Navy Header Bar with Gold Border */}
          <div className="flex-1 -ml-3 sm:-ml-4 flex items-center justify-between bg-gradient-to-r from-[#121B42] via-[#101738] to-[#0A0F26] border border-[#C8A96E] rounded-2xl sm:rounded-3xl px-3 sm:px-6 py-2.5 shadow-md min-w-0">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-black tracking-wide text-[#F3ECDD] font-serif">
                  CHAMPION CODEX
                </h2>
                <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-[#C8A96E]/20 text-[#E5B25D] border border-[#C8A96E]/70 font-mono font-bold tracking-wider">
                  8 CANONICAL ROLES
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#CBD5E1] truncate sm:whitespace-normal font-sans">
                Authoritative role attributes, base statistics, and signature duel abilities.
              </p>
            </div>

            {/* Circular Close Button (Navy with Gold Ring) */}
            <button
              id="codex-close-circle-button"
              data-testid="codex-close-circle-button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#101738] border border-[#C8A96E] text-[#E5B25D] hover:text-white hover:border-[#F5C26B] hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center flex-shrink-0 ml-2"
              aria-label="Close codex"
            >
              <CloseModalIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left 4x2 Grid (Midnight Navy), Right Profile Panel (Ivory Parchment) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 overflow-y-auto overflow-x-hidden pr-0.5 min-w-0 flex-1">
          {/* Roles Selection Grid: 4 Columns x 2 Rows */}
          <div className="lg:col-span-7 xl:col-span-7 min-w-0 flex flex-col justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              {rolesList.map((role) => {
                const asset = getCharacterAsset(role.id);
                const isSelected = selectedRole === role.id;

                return (
                  <button
                    key={role.id}
                    id={`codex-role-${role.id}`}
                    data-testid={`codex-card-${role.id}`}
                    type="button"
                    onClick={() => handleSelectRole(role.id)}
                    className={`rounded-xl sm:rounded-2xl p-1.5 sm:p-2 text-left transition-all duration-200 flex flex-col justify-between relative overflow-hidden group min-w-0 cursor-pointer ${
                      isSelected
                        ? 'border-2 border-[#E5B25D] bg-gradient-to-b from-[#182352] via-[#10183E] to-[#0A0F26] ring-2 ring-[#E5B25D]/60 shadow-[0_0_20px_rgba(229,178,93,0.5)] scale-[1.02] z-10'
                        : 'border border-[#C8A96E]/40 bg-gradient-to-b from-[#121A3D] via-[#0D1432] to-[#080D22] hover:border-[#E5B25D]/80 hover:bg-[#162049] hover:shadow-md'
                    }`}
                  >
                    {/* Character Portrait Card Container */}
                    <div className="relative w-full aspect-[4/5] rounded-lg sm:rounded-xl overflow-hidden mb-1.5 border border-[#C8A96E]/30 bg-[#060A1C] shadow-inner pointer-events-none">
                      <Image
                        src={asset.portrait}
                        alt={asset.name}
                        fill
                        priority
                        unoptimized
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 140px"
                        className="object-cover object-center group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                      />
                      {/* Active Radiant Selection Aura */}
                      {isSelected && (
                        <div className="absolute inset-0 border-2 border-[#E5B25D]/80 rounded-lg pointer-events-none" />
                      )}
                    </div>

                    {/* Role Title and Stats */}
                    <div className="w-full min-w-0 px-0.5 pointer-events-none">
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <h4 className="font-bold text-white text-xs capitalize truncate font-sans">{role.name}</h4>
                      </div>

                      {/* Stats: HP and ATK matching reference colors */}
                      <div className="flex items-center justify-between text-[11px] font-sans font-bold mt-0.5 min-w-0 gap-1">
                        <span className="text-[#38BDF8] truncate">
                          {role.maxHp} HP
                        </span>
                        <span className="text-[#F87171] truncate">
                          {role.baseAttack} ATK
                        </span>
                      </div>

                      {/* Signature Ability with specific icon */}
                      <div className="flex items-center gap-1 text-[10px] text-[#E5B25D] font-medium truncate mt-1 pt-0.5 border-t border-white/10 min-w-0">
                        <RoleAbilityIcon roleId={role.id} />
                        <span className="truncate">{role.skill.name}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Profile Showcase Panel: Parchment Surface with Celestial Banners & Dais */}
          <div
            data-testid="codex-profile-panel"
            className="lg:col-span-5 xl:col-span-5 min-w-0 rounded-2xl p-3 sm:p-4 bg-gradient-to-b from-[#FDFBF7] via-[#F6EFE3] to-[#EBE0CF] border-2 border-[#C8A96E]/70 flex flex-col items-center text-center relative overflow-hidden shadow-inner justify-between"
          >
            {/* Fine Inset Gold Ornamental Frame */}
            <div className="absolute inset-1.5 sm:inset-2 rounded-xl border border-[#C8A96E]/40 pointer-events-none z-10" />

            {/* Hanging Celestial Blue Heraldic Banners on Left & Right */}
            <div className="absolute top-2 left-2.5 pointer-events-none z-20 opacity-85 sm:opacity-95">
              <CelestialBanner className="w-5 sm:w-6 h-20 sm:h-24" />
            </div>
            <div className="absolute top-2 right-2.5 pointer-events-none z-20 opacity-85 sm:opacity-95">
              <CelestialBanner className="w-5 sm:w-6 h-20 sm:h-24" />
            </div>

            {/* Inner Corner Filigrees on Profile Panel Frame */}
            <div className="absolute top-2 left-2 pointer-events-none z-20">
              <OrnamentalCorner className="w-4 h-4 text-[#C8A96E]/70" />
            </div>
            <div className="absolute top-2 right-2 pointer-events-none rotate-90 z-20">
              <OrnamentalCorner className="w-4 h-4 text-[#C8A96E]/70" />
            </div>
            <div className="absolute bottom-2 left-2 pointer-events-none -rotate-90 z-20">
              <OrnamentalCorner className="w-4 h-4 text-[#C8A96E]/70" />
            </div>
            <div className="absolute bottom-2 right-2 pointer-events-none rotate-180 z-20">
              <OrnamentalCorner className="w-4 h-4 text-[#C8A96E]/70" />
            </div>

            {/* Profile Header on Ivory Parchment (Deep Navy Typography) */}
            <div className="w-full flex flex-col items-center relative z-20 px-6">
              <span className="text-[10px] font-bold text-[#8C6B28] uppercase tracking-widest font-mono mb-0.5">
                ROLE LORE & PROFILE
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-[#101738] capitalize leading-tight font-serif">
                {activeDef.name}
              </h3>
              <p className="text-[11px] text-[#2A3554] max-w-sm line-clamp-2 leading-relaxed mt-1">
                {activeAsset.description}
              </p>
            </div>

            {/* Character Showcase with Concentric Runic Dais (Firm ground alignment) */}
            <div className="relative my-1 flex items-end justify-center w-full h-[185px] sm:h-[205px]">
              {/* Concentric Glowing Dais Platform on ground */}
              <div className="absolute bottom-0 w-full flex justify-center pointer-events-none z-0">
                <CelestialDais className="w-68 sm:w-80 h-16 sm:h-20" />
              </div>

              {/* Full-Body Transparent Character Artwork standing on dais */}
              <div className="relative z-10 -mb-1 flex items-end justify-center">
                <CharacterArtwork
                  roleId={activeDef.id}
                  side="A"
                  size="md"
                  className="!h-44 sm:!h-52 !w-40 sm:!w-48 filter drop-shadow-[0_8px_16px_rgba(16,23,56,0.35)]"
                />
              </div>
            </div>

            {/* Stats Breakdown: Two Royal Navy Cards with Gold Borders */}
            <div className="w-full space-y-2 mt-1 relative z-20">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Maximum Health Navy Card */}
                <div className="p-2 rounded-xl bg-gradient-to-r from-[#141C44] to-[#0E1535] border border-[#C8A96E]/80 shadow-md flex items-center gap-2 text-left">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center flex-shrink-0 text-cyan-400">
                    <HealthVitalityIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-[#CBD5E1] uppercase font-bold block truncate tracking-wide">
                      MAXIMUM HEALTH
                    </span>
                    <span className="font-mono font-black text-[#38BDF8] text-xs sm:text-sm leading-none">
                      {activeDef.maxHp} HP
                    </span>
                  </div>
                </div>

                {/* Base Attack Navy Card */}
                <div className="p-2 rounded-xl bg-gradient-to-r from-[#141C44] to-[#0E1535] border border-[#C8A96E]/80 shadow-md flex items-center gap-2 text-left">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-400/30 flex items-center justify-center flex-shrink-0 text-rose-400">
                    <AttackPowerIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-[#CBD5E1] uppercase font-bold block truncate tracking-wide">
                      BASE PHYSICAL ATK
                    </span>
                    <span className="font-mono font-black text-[#F87171] text-xs sm:text-sm leading-none">
                      {activeDef.baseAttack} DMG
                    </span>
                  </div>
                </div>
              </div>

              {/* Signature Skill Plate: Royal Navy Card with Gold Border */}
              <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-[#121938] via-[#0E1430] to-[#090D22] border-2 border-[#C8A96E] text-white shadow-md relative overflow-hidden text-left">
                <div className="flex justify-between items-center text-xs font-bold text-[#F5C26B] mb-1 gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <SkillStarIcon className="w-4 h-4 flex-shrink-0 text-[#E5B25D]" />
                    <span className="truncate text-white font-black text-xs sm:text-sm">{activeDef.skill.name}</span>
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#E5B25D]/20 text-[#E5B25D] border border-[#E5B25D]/50 flex items-center gap-1 flex-shrink-0 font-bold">
                    <ChargeGemIcon className="w-2.5 h-2.5 text-[#E5B25D]" />
                    {activeDef.skill.usesPerDuel}x / duel
                  </span>
                </div>
                <p className="text-[11px] text-[#CBD5E1] leading-snug">
                  {activeDef.skill.description}
                </p>
                {activeDef.skill.interruptibleBy.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-500/40 font-semibold">
                    <ShieldBreakWarningIcon className="w-3 h-3 flex-shrink-0 text-rose-400" />
                    <span>
                      Interruptible by: <strong className="text-white">{activeDef.skill.interruptibleBy.join(', ')}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer with Golden Crescent Medallion & Close Codex Button */}
        <div className="mt-3 pt-2.5 border-t border-[#C8A96E]/40 flex items-center justify-between min-w-0 relative z-20">
          <div className="min-w-0" />

          {/* Center Golden Crescent Moon Motif sitting on the bottom divider */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-2 sm:-top-2.5 pointer-events-none z-30 flex items-center justify-center">
            <BottomCrescentEmblem className="w-5 h-3 text-[#C8A96E]" />
          </div>

          {/* Prominent Navy-and-Gold Close Codex Button */}
          <button
            id="codex-close-button"
            data-testid="codex-close-button"
            onClick={onClose}
            className="px-7 py-2 rounded-full text-xs sm:text-sm font-bold bg-[#101738] text-[#FFF5DF] border-2 border-[#C8A96E] hover:border-[#F5C26B] hover:text-white hover:scale-105 active:scale-95 transition-all shadow-md ml-auto"
          >
            Close Codex
          </button>
        </div>
      </div>
    </div>
  );
}

