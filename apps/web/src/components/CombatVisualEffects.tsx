'use client';

import React from 'react';

export interface FloatingCombatTextItem {
  id: string;
  side: 'A' | 'B';
  text: string;
  type: 'damage' | 'crit' | 'guard' | 'shield' | 'interrupt';
}

interface CombatVisualEffectsProps {
  floatingTexts: FloatingCombatTextItem[];
  activeVfxA?: 'slash' | 'shield' | 'skill' | null;
  activeVfxB?: 'slash' | 'shield' | null;
}

export function CombatVisualEffects({
  floatingTexts,
  activeVfxA,
  activeVfxB,
}: CombatVisualEffectsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Floating Combat Text Container for Party A */}
      <div className="absolute left-[8%] sm:left-[12%] bottom-[45%] flex flex-col items-center">
        {floatingTexts
          .filter((t) => t.side === 'A')
          .map((item) => (
            <div
              key={item.id}
              className={`animate-float-damage font-black font-mono tracking-tight select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] ${
                item.type === 'crit'
                  ? 'text-2xl sm:text-3xl text-amber-300 drop-shadow-[0_0_20px_rgba(255,179,0,0.8)]'
                  : item.type === 'guard'
                  ? 'text-lg sm:text-xl text-cyan-300'
                  : item.type === 'shield'
                  ? 'text-lg sm:text-xl text-emerald-300'
                  : item.type === 'interrupt'
                  ? 'text-lg sm:text-xl text-rose-400'
                  : 'text-xl sm:text-2xl text-rose-400'
              }`}
            >
              {item.text}
            </div>
          ))}

        {/* Party A Vfx Overlay */}
        {activeVfxA === 'slash' && (
          <div className="absolute -top-12 -left-12 w-48 h-48 animate-screen-shake">
            <svg viewBox="0 0 200 200" className="w-full h-full filter drop-shadow-[0_0_15px_#FF7722]">
              <path
                d="M 20 180 Q 90 70 180 20"
                fill="none"
                stroke="#FFD54F"
                strokeWidth="8"
                strokeLinecap="round"
                className="animate-slash-trail"
              />
              <path
                d="M 40 190 Q 100 90 190 35"
                fill="none"
                stroke="#FF7722"
                strokeWidth="4"
                strokeLinecap="round"
                className="animate-slash-trail"
              />
            </svg>
          </div>
        )}

        {activeVfxA === 'shield' && (
          <div className="absolute -top-16 -left-16 w-56 h-56 animate-shield-barrier">
            <svg viewBox="0 0 200 200" className="w-full h-full filter drop-shadow-[0_0_25px_#7899D5]">
              <polygon
                points="100,10 180,55 180,145 100,190 20,145 20,55"
                fill="rgba(120,153,213,0.25)"
                stroke="#C9E5FF"
                strokeWidth="4"
              />
              <polygon
                points="100,30 160,65 160,135 100,170 40,135 40,65"
                fill="none"
                stroke="#E8A75A"
                strokeWidth="2"
                strokeDasharray="6,8"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Floating Combat Text Container for Party B */}
      <div className="absolute right-[8%] sm:right-[12%] bottom-[45%] flex flex-col items-center">
        {floatingTexts
          .filter((t) => t.side === 'B')
          .map((item) => (
            <div
              key={item.id}
              className={`animate-float-damage font-black font-mono tracking-tight select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] ${
                item.type === 'crit'
                  ? 'text-2xl sm:text-3xl text-amber-300 drop-shadow-[0_0_20px_rgba(255,179,0,0.8)]'
                  : item.type === 'guard'
                  ? 'text-lg sm:text-xl text-cyan-300'
                  : item.type === 'shield'
                  ? 'text-lg sm:text-xl text-emerald-300'
                  : item.type === 'interrupt'
                  ? 'text-lg sm:text-xl text-rose-400'
                  : 'text-xl sm:text-2xl text-rose-400'
              }`}
            >
              {item.text}
            </div>
          ))}

        {/* Party B Vfx Overlay */}
        {activeVfxB === 'slash' && (
          <div className="absolute -top-12 -left-12 w-48 h-48 animate-screen-shake">
            <svg viewBox="0 0 200 200" className="w-full h-full filter drop-shadow-[0_0_15px_#DC5269]">
              <path
                d="M 180 180 Q 110 70 20 20"
                fill="none"
                stroke="#FFD54F"
                strokeWidth="8"
                strokeLinecap="round"
                className="animate-slash-trail"
              />
              <path
                d="M 160 190 Q 100 90 10 35"
                fill="none"
                stroke="#DC5269"
                strokeWidth="4"
                strokeLinecap="round"
                className="animate-slash-trail"
              />
            </svg>
          </div>
        )}

        {activeVfxB === 'shield' && (
          <div className="absolute -top-16 -left-16 w-56 h-56 animate-shield-barrier">
            <svg viewBox="0 0 200 200" className="w-full h-full filter drop-shadow-[0_0_25px_#8D78D6]">
              <polygon
                points="100,10 180,55 180,145 100,190 20,145 20,55"
                fill="rgba(141,120,214,0.25)"
                stroke="#C9E5FF"
                strokeWidth="4"
              />
              <polygon
                points="100,30 160,65 160,135 100,170 40,135 40,65"
                fill="none"
                stroke="#FFB300"
                strokeWidth="2"
                strokeDasharray="6,8"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
