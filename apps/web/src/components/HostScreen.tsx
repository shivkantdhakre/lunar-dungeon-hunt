'use client';

import React, { useState } from 'react';
import type { PublicMatchSnapshot } from '@dungeon-hunt/shared-contracts';
import { useSocket } from '../../lib/socket/SocketProvider';
import { generateUUID } from '../lib/uuid';

const CANONICAL_ROLES = [
  'swordsman',
  'archer',
  'mage',
  'tank',
  'rogue',
  'assassin',
  'vanguard',
  'paladin',
] as const;

interface HostTokens {
  host: string;
  partyA: string;
  partyB: string;
  arena: string;
}

interface HostScreenProps {
  matchState: PublicMatchSnapshot | null;
  tokens: HostTokens | null;
  onProvision: (tokens: HostTokens, matchId: string) => void;
}

export function HostScreen({ matchState, tokens, onProvision }: HostScreenProps) {
  const { socket } = useSocket();
  const [partyAName, setPartyAName] = useState('Solar Vanguard');
  const [partyBName, setPartyBName] = useState('Lunar Wardens');
  const [adminKey, setAdminKey] = useState(
    process.env.NEXT_PUBLIC_HOST_ADMIN_KEY ?? '552c905fa64b7a452efba0fd9d4bd5ef6456e628da174b53aeecb21c25ca0ca9',
  );
  const [customLineups, setCustomLineups] = useState(false);
  const [rolesA, setRolesA] = useState<string[]>(['swordsman', 'archer', 'mage', 'tank', 'rogue']);
  const [rolesB, setRolesB] = useState<string[]>(['swordsman', 'archer', 'mage', 'assassin', 'vanguard']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [pauseReasonInput, setPauseReasonInput] = useState('Tournament desk timeout');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  // Emergency override state
  const [overrideOp, setOverrideOp] = useState<'declareDuelWinner' | 'forcePhase' | 'forceNextDuel'>('declareDuelWinner');
  const [overrideWinner, setOverrideWinner] = useState<'A' | 'B'>('A');
  const [overrideReason, setOverrideReason] = useState('Referee decision / timeout override');
  const [overrideLoading, setOverrideLoading] = useState(false);

  // Audit modal state
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>> | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  // Results modal state
  const [resultsData, setResultsData] = useState<{
    matchId: string;
    scoreA: number;
    scoreB: number;
    status: string;
    duelHistory: Array<{
      duelNumber: number;
      winner: string;
      reason: string;
      roleIdA: string;
      roleIdB: string;
      resolvedTurns: number;
    }>;
  } | null>(null);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);

  const toggleRoleA = (role: string) => {
    if (rolesA.includes(role)) {
      setRolesA(rolesA.filter((r) => r !== role));
    } else {
      if (rolesA.length < 5) setRolesA([...rolesA, role]);
    }
  };

  const toggleRoleB = (role: string) => {
    if (rolesB.includes(role)) {
      setRolesB(rolesB.filter((r) => r !== role));
    } else {
      if (rolesB.length < 5) setRolesB([...rolesB, role]);
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessBanner(null);

    if (customLineups) {
      if (rolesA.length !== 5 || rolesB.length !== 5) {
        setErrorMsg('Each party must have exactly 5 distinct roles selected.');
        setLoading(false);
        return;
      }
    }

    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
      const payload: Record<string, unknown> = {
        partyAName,
        partyBName,
      };
      if (customLineups) {
        payload.rosterRolesA = rolesA;
        payload.rosterRolesB = rolesB;
      }

      const res = await fetch(`${serverUrl}/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-host-admin-key': adminKey,
          'x-idempotency-key': generateUUID(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to create match (${res.status}): ${text}`);
      }

      const data = await res.json();
      onProvision(data.tokens, data.matchId);
      setSuccessBanner(`Match ${data.matchId} provisioned with Run ID ${data.runId}!`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStartMatch = () => {
    if (!socket || !matchState) return;
    socket.emit('match:start', { matchId: matchState.matchId });
    setSuccessBanner('Match start signal transmitted.');
  };

  const handlePauseMatch = () => {
    if (!socket || !matchState) return;
    socket.emit('match:pause', {
      matchId: matchState.matchId,
      reason: pauseReasonInput || 'Tournament desk timeout',
    });
    setSuccessBanner(`Match paused: ${pauseReasonInput}`);
  };

  const handleResumeMatch = () => {
    if (!socket || !matchState) return;
    socket.emit('match:resume', { matchId: matchState.matchId });
    setSuccessBanner('Match resumed.');
  };

  const handleConfirmReset = () => {
    if (!socket || !matchState) return;
    socket.emit('match:reset', { matchId: matchState.matchId, reason: 'Host desk reset' });
    setResetConfirmOpen(false);
    setSuccessBanner('Match reset command broadcasted. Run ID incremented & tokens rotated.');
  };

  const handleExecuteOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchState) return;
    setOverrideLoading(true);
    setErrorMsg(null);

    const payload = {
      matchId: matchState.matchId,
      operation: overrideOp,
      reason: overrideReason,
      ...(overrideOp === 'declareDuelWinner' ? { winnerSide: overrideWinner } : {}),
    };

    try {
      // Execute via WebSocket if connected, fallback to REST
      if (socket && socket.connected) {
        socket.emit('host:override', payload);
        setSuccessBanner(`Emergency override "${overrideOp}" sent via WebSocket.`);
      } else {
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (tokens?.host) {
          headers['Authorization'] = `Bearer ${tokens.host}`;
        } else {
          headers['x-host-admin-key'] = adminKey;
        }

        const res = await fetch(`${serverUrl}/matches/${matchState.matchId}/override`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Override failed (${res.status}): ${text}`);
        }
        setSuccessBanner(`Emergency override "${overrideOp}" applied via REST.`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleFetchAudit = async () => {
    if (!matchState) return;
    setAuditLoading(true);
    setErrorMsg(null);
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
      const headers: Record<string, string> = {};
      if (tokens?.host) {
        headers['Authorization'] = `Bearer ${tokens.host}`;
      } else {
        headers['x-host-admin-key'] = adminKey;
      }

      const res = await fetch(`${serverUrl}/matches/${matchState.matchId}/audit`, {
        headers,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load audit trail (${res.status}): ${text}`);
      }

      const data = await res.json();
      setAuditLogs(data.auditLog ?? []);
      setAuditModalOpen(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setAuditLoading(false);
    }
  };

  const handleFetchResults = async () => {
    if (!matchState) return;
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
      const res = await fetch(`${serverUrl}/matches/${matchState.matchId}/results`);
      if (!res.ok) {
        throw new Error(`Failed to fetch results (${res.status})`);
      }
      const data = await res.json();
      setResultsData(data);
      setResultsModalOpen(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Creation / Provisioning Card */}
      <section className="glass-panel rounded-2xl p-6 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <span>⚔️</span> Match Provisioning & Tournament Desk
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Provision an authoritative in-memory Best-of-Three match, customize canonical 5-role party rosters, and mint signed JWT tokens.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-rose-400 ml-2">✕</button>
          </div>
        )}

        {successBanner && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
            <span>✓ {successBanner}</span>
            <button onClick={() => setSuccessBanner(null)} className="text-xs font-bold text-emerald-400 ml-2">✕</button>
          </div>
        )}

        <form onSubmit={handleCreateMatch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Party A Name
              </label>
              <input
                type="text"
                value={partyAName}
                onChange={(e) => setPartyAName(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Party B Name
              </label>
              <input
                type="text"
                value={partyBName}
                onChange={(e) => setPartyBName(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-purple-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Host Admin Key
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400 font-mono"
                required
              />
            </div>
          </div>

          {/* Custom Roster Toggle */}
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={customLineups}
                  onChange={(e) => setCustomLineups(e.target.checked)}
                  className="rounded bg-slate-900 border-white/20 text-amber-500 focus:ring-amber-400"
                />
                <span>Customize Party Rosters (Select 5 Roles per Party)</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {customLineups ? 'Enforcing 5 distinct roles per party' : 'Default: Balanced automatic draft'}
              </span>
            </div>

            {customLineups && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/50 border border-white/5 text-xs">
                {/* Party A Role Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-amber-300">Party A Roles ({rolesA.length}/5)</span>
                    <span className="text-[10px] text-slate-400">Click to toggle</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CANONICAL_ROLES.map((role) => {
                      const isSelected = rolesA.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleRoleA(role)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-black/30 text-slate-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{role}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Party B Role Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-purple-300">Party B Roles ({rolesB.length}/5)</span>
                    <span className="text-[10px] text-slate-400">Click to toggle</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CANONICAL_ROLES.map((role) => {
                      const isSelected = rolesB.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleRoleB(role)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                            isSelected
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : 'bg-black/30 text-slate-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{role}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
            >
              {loading ? 'Initializing Match...' : '✨ Initialize New Match'}
            </button>
          </div>
        </form>
      </section>

      {/* Match Control & State Operations */}
      {matchState && (
        <section className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase">Match ID: {matchState.matchId}</span>
              <h3 className="text-2xl font-black text-white mt-1">
                Score: <span className="text-amber-400">{matchState.scoreA}</span> — <span className="text-purple-400">{matchState.scoreB}</span>
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-3 py-1 rounded-full uppercase font-bold tracking-wider border ${
                matchState.status === 'paused'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
              }`}>
                Phase: {matchState.status}
              </span>
              <span className="text-xs px-3 py-1 rounded-full uppercase font-mono bg-slate-800 text-slate-300 border border-white/10">
                Duel {matchState.currentDuelNumber} of 3
              </span>
              <button
                onClick={handleFetchAudit}
                disabled={auditLoading}
                className="text-xs px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 font-medium transition"
              >
                {auditLoading ? 'Loading...' : '📜 Audit Trail'}
              </button>
              <button
                onClick={handleFetchResults}
                className="text-xs px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-cyan-500/30 font-medium transition"
              >
                📊 Results
              </button>
            </div>
          </div>

          {/* Pause Reason Alert Banner */}
          {matchState.status === 'paused' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
              <span className="flex items-center gap-2">
                <span className="text-base">⏸️</span>
                <span><strong>MATCH PAUSED:</strong> {matchState.pauseReason || 'Tournament desk timeout'}</span>
              </span>
              <button
                onClick={handleResumeMatch}
                className="px-3 py-1 rounded-lg font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
              >
                Resume Match Now
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {matchState.status === 'lobby' && (
              <button
                onClick={handleStartMatch}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition active:scale-95"
              >
                ▶️ Start Match (Begin Picking)
              </button>
            )}

            {matchState.status !== 'paused' && matchState.status !== 'completed' && matchState.status !== 'lobby' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Pause reason..."
                  value={pauseReasonInput}
                  onChange={(e) => setPauseReasonInput(e.target.value)}
                  className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-48"
                />
                <button
                  onClick={handlePauseMatch}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white transition active:scale-95"
                >
                  ⏸️ Pause Match
                </button>
              </div>
            )}

            {matchState.status === 'paused' && (
              <button
                onClick={handleResumeMatch}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition active:scale-95"
              >
                ▶️ Resume Match
              </button>
            )}

            <button
              onClick={() => setResetConfirmOpen(true)}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-rose-600/80 hover:bg-rose-600 text-white transition active:scale-95 ml-auto"
            >
              🔄 Reset Match (Rotate Tokens)
            </button>
          </div>

          {/* Emergency Override Control Panel */}
          <div className="rounded-xl p-4 bg-slate-950/60 border border-rose-500/20 space-y-3">
            <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <span>⚡</span> Host Emergency Overrides & Interventions
            </h4>
            <p className="text-[11px] text-slate-400">
              Judges and tournament directors can manually rule on duels, advance stalled turns, or declare winners with authoritative audit logging.
            </p>

            <form onSubmit={handleExecuteOverride} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                  Operation
                </label>
                <select
                  value={overrideOp}
                  onChange={(e) =>
                    setOverrideOp(
                      e.target.value as 'declareDuelWinner' | 'forcePhase' | 'forceNextDuel',
                    )
                  }
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                >
                  <option value="declareDuelWinner">Declare Duel Winner</option>
                  <option value="forceNextDuel">Force Advance Next Duel</option>
                  <option value="forcePhase">Force Phase Transition</option>
                </select>
              </div>

              {overrideOp === 'declareDuelWinner' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                    Award Winner To
                  </label>
                  <select
                    value={overrideWinner}
                    onChange={(e) => setOverrideWinner(e.target.value as 'A' | 'B')}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                  >
                    <option value="A">Party A</option>
                    <option value="B">Party B</option>
                  </select>
                </div>
              )}

              <div className={overrideOp === 'declareDuelWinner' ? 'md:col-span-1' : 'md:col-span-2'}>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                  Mandatory Justification Reason
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for intervention..."
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                  required
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={overrideLoading}
                  className="w-full py-1.5 rounded-lg text-xs font-bold bg-rose-600/80 hover:bg-rose-600 text-white shadow-md shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  {overrideLoading ? 'Applying...' : 'Execute Override'}
                </button>
              </div>
            </form>
          </div>

          {/* Tokens & Direct Access Links Inspector */}
          {tokens && (() => {
            const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
            const roleConfigs = [
              {
                key: 'partyA',
                title: 'Party A Console',
                label: matchState?.partyAName ?? partyAName ?? 'Solar Vanguard',
                icon: '🦁',
                textColor: 'text-amber-400',
                badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                cardBorder: 'border-amber-500/30',
                token: tokens.partyA,
                url: `${origin}/?tab=partyA&token=${tokens.partyA}`,
              },
              {
                key: 'partyB',
                title: 'Party B Console',
                label: matchState?.partyBName ?? partyBName ?? 'Lunar Eclipse',
                icon: '🦅',
                textColor: 'text-purple-400',
                badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                cardBorder: 'border-purple-500/30',
                token: tokens.partyB,
                url: `${origin}/?tab=partyB&token=${tokens.partyB}`,
              },
              {
                key: 'arena',
                title: 'Arena Projector HUD',
                label: 'Public Spectator Broadcast',
                icon: '🏟️',
                textColor: 'text-cyan-400',
                badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
                cardBorder: 'border-cyan-500/30',
                token: tokens.arena,
                url: `${origin}/?tab=arena&token=${tokens.arena}`,
              },
              {
                key: 'host',
                title: 'Host Tournament Desk',
                label: 'Match Operations & Referee',
                icon: '👑',
                textColor: 'text-emerald-400',
                badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                cardBorder: 'border-emerald-500/30',
                token: tokens.host,
                url: `${origin}/?tab=host&token=${tokens.host}`,
              },
            ];

            return (
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>🔗</span> Direct Role Links & Session Credentials
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Open in separate browser windows/devices or share with players and projector screens.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roleConfigs.map((cfg) => (
                    <div
                      key={cfg.key}
                      className={`p-4 rounded-xl bg-black/50 border ${cfg.cardBorder} flex flex-col justify-between space-y-3`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cfg.icon}</span>
                          <div>
                            <span className={`text-xs font-bold ${cfg.textColor} block`}>
                              {cfg.title}
                            </span>
                            <span className="text-[11px] text-slate-400">{cfg.label}</span>
                          </div>
                        </div>
                        <a
                          href={cfg.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        >
                          Open ↗
                        </a>
                      </div>

                      {/* Direct URL input with copy */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Full URL:
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={cfg.url}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-white/30 truncate"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(cfg.url, `url-${cfg.key}`)}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap"
                          >
                            {copiedKey === `url-${cfg.key}` ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      {/* Token utilities */}
                      <div className="pt-1 flex items-center justify-between gap-2 border-t border-white/5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(cfg.token, `token-${cfg.key}`)}
                          className="text-slate-400 hover:text-slate-200 font-mono transition-colors"
                        >
                          {copiedKey === `token-${cfg.key}` ? '✓ Token Copied' : 'Copy Token (JWT)'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedToken(expandedToken === cfg.key ? null : cfg.key)
                          }
                          className="text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {expandedToken === cfg.key ? 'Hide Token ▲' : 'View Full Token ▼'}
                        </button>
                      </div>

                      {expandedToken === cfg.key && (
                        <div className="mt-2 p-2 bg-slate-950 rounded border border-white/5">
                          <p className="text-[10px] font-mono text-slate-400 break-all select-all leading-relaxed">
                            {cfg.token}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* Confirmation Modal for Reset */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-rose-500/30 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-rose-400">⚠️</span> Confirm Match Reset
            </h3>
            <p className="text-sm text-slate-300">
              Resetting will increment the match run ID, rotate all party tokens, invalidate existing browser sessions, and restore rosters to the lobby state.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
              >
                Yes, Reset & Evict
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-3xl w-full rounded-2xl p-6 border border-white/10 max-h-[80vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📜</span> Authoritative Match Audit Trail
              </h3>
              <button
                onClick={() => setAuditModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {auditLogs && auditLogs.length > 0 ? (
                auditLogs.map((log, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-slate-300 font-bold">
                      <span className="text-cyan-400">{String(log.event ?? 'EVENT')}</span>
                      <span className="text-[10px] text-slate-500">{String(log.timestamp ?? '')}</span>
                    </div>
                    <pre className="text-[11px] text-slate-400 whitespace-pre-wrap">
                      {JSON.stringify(log, null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 italic p-4 text-center">No audit log records found.</p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {resultsModalOpen && resultsData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full rounded-2xl p-6 border border-cyan-500/30 max-h-[80vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📊</span> Series Results & Duel Summary
              </h3>
              <button
                onClick={() => setResultsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-center p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <span className="text-xs uppercase text-slate-400 font-mono">Series Standings</span>
              <div className="text-3xl font-black text-white mt-1">
                <span className="text-amber-400">{resultsData.scoreA}</span> — <span className="text-purple-400">{resultsData.scoreB}</span>
              </div>
              <span className="text-xs text-cyan-400 mt-1 block uppercase font-bold">Status: {resultsData.status}</span>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1 text-xs">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Duel Breakdown:</h4>
              {resultsData.duelHistory && resultsData.duelHistory.length > 0 ? (
                resultsData.duelHistory.map((d, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">Duel {d.duelNumber}: Winner Party {d.winner}</span>
                      <p className="text-[11px] text-slate-400">
                        {(d.roleIdA || 'Fighter A').toUpperCase()} vs {(d.roleIdB || 'Fighter B').toUpperCase()} ({d.resolvedTurns} turns, {d.reason})
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      Party {d.winner} Victory
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 italic p-3 text-center">No completed duels yet.</p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setResultsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
