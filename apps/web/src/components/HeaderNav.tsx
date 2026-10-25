'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '../../lib/socket/SocketProvider';
import { sounds } from '../lib/sound/sound-effects';

import Image from 'next/image';
import { LUNAR_ICONS } from '../lib/assets/game-assets';
import { CodexTomeIcon } from './RoleCodexIcons';

export type ActiveTab = 'host' | 'partyA' | 'partyB' | 'arena';

interface HeaderNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  matchId?: string;
  onOpenCodex?: () => void;
}

export function HeaderNav({ activeTab, onTabChange, matchId, onOpenCodex }: HeaderNavProps) {
  const { connectionState, rtt, sendPing } = useSocket();
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsMuted(sounds.isMuted());
  }, []);

  const handleToggleSound = () => {
    const newMuted = sounds.toggleMute();
    setIsMuted(newMuted);
    if (!newMuted) {
      sounds.playClick();
    }
  };

  const getStatusBadge = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Connected {rtt !== null ? `(${rtt}ms)` : ''}
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Connecting...
          </span>
        );
      case 'reconnecting':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Reconnecting...
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Offline
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-3.5 mb-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Title & Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 via-purple-600/30 to-cyan-400/20 border border-amber-400/30 flex items-center justify-center p-1.5 shadow-lg shadow-purple-500/20 backdrop-blur-md">
            <Image
              src={LUNAR_ICONS.crest}
              alt="Lunar Crest"
              width={28}
              height={28}
              className="w-7 h-7"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              LUNAR DUNGEON <span className="text-xs px-2 py-0.5 rounded bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 font-mono border border-amber-500/30">PARTY CLASH</span>
            </h1>
            <p className="text-xs text-amber-200/70 flex items-center gap-1">
              <span>🪔</span> AAYANSH’26 Festival of Light {matchId ? `• Match #${matchId.slice(0, 8)}` : ''}
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => onTabChange('arena')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'arena'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            🌌 Public Arena
          </button>
          <button
            onClick={() => onTabChange('partyA')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'partyA'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            🛡️ Party A Console
          </button>
          <button
            onClick={() => onTabChange('partyB')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'partyB'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            ⚔️ Party B Console
          </button>
          <button
            onClick={() => onTabChange('host')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'host'
                ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-amber-300 border border-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            🎛️ Host Desk
          </button>
        </nav>

        {/* Connection status and audio controls */}
        <div className="flex items-center gap-2.5">
          {getStatusBadge()}
          {onOpenCodex && (
            <button
              onClick={onOpenCodex}
              title="View the 8 Canonical Roles, Stats & Skills"
              className="text-xs px-2.5 py-1 rounded-lg border border-amber-500/30 hover:border-amber-400 text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 transition flex items-center gap-1.5 font-medium shadow-sm hover:shadow-amber-500/10"
            >
              <CodexTomeIcon className="w-3.5 h-3.5 text-amber-300" />
              <span>Roles</span>
            </button>
          )}
          <button
            onClick={sendPing}
            title="Send diagnostic ping to measure RTT"
            className="text-xs px-2.5 py-1 rounded-lg border border-white/10 hover:border-amber-400/40 text-slate-300 hover:text-white bg-slate-800/40 transition"
          >
            ⚡ Ping
          </button>
          <button
            onClick={handleToggleSound}
            title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
            className={`text-xs px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 ${
              isMuted
                ? 'border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'
                : 'border-white/10 hover:border-amber-400/40 text-slate-300 hover:text-white bg-slate-800/40'
            }`}
          >
            {isMuted ? '🔇 Muted' : '🔊 Audio'}
          </button>
        </div>
      </div>
    </header>
  );
}
