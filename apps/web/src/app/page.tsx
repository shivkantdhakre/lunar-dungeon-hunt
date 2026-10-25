'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SocketProvider, useSocket } from '../../lib/socket/SocketProvider';
import { HeaderNav, ActiveTab } from '../components/HeaderNav';
import { HostScreen } from '../components/HostScreen';
import { PartyScreen } from '../components/PartyScreen';
import { ArenaScreen } from '../components/ArenaScreen';
import { RoleCodexModal } from '../components/RoleCodexModal';
import { FestiveParticles } from '../components/FestiveParticles';
import type {
  PublicMatchSnapshot,
  PrivatePartySnapshot,
  PublicFighter,
  MatchTokensRotatedPayload,
} from '@dungeon-hunt/shared-contracts';

interface StoredTokens {
  host: string;
  partyA: string;
  partyB: string;
  arena: string;
}

interface ToastNotice {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

function MainApp() {
  const { socket, connectionState, setAuthToken } = useSocket();
  const [activeTab, setActiveTab] = useState<ActiveTab>('arena');
  const activeTabRef = useRef<ActiveTab>(activeTab);
  activeTabRef.current = activeTab;

  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [matchState, setMatchState] = useState<PublicMatchSnapshot | null>(null);
  const [partyStateA, setPartyStateA] = useState<PrivatePartySnapshot | null>(null);
  const [partyStateB, setPartyStateB] = useState<PrivatePartySnapshot | null>(null);
  const [activeFighterA, setActiveFighterA] = useState<PublicFighter | null>(null);
  const [activeFighterB, setActiveFighterB] = useState<PublicFighter | null>(null);
  const [combatLogs, setCombatLogs] = useState<Array<{ actor: string; event: string }>>([]);
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [codexRole, setCodexRole] = useState<string>('paladin');
  const [toast, setToast] = useState<ToastNotice | null>(null);

  // Auto-dismiss toasts after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Synchronize active public match state and credentials from authoritative server
  const syncActivePublicMatch = useCallback(
    async (options?: { forceTokenUpdate?: boolean }) => {
      if (typeof window === 'undefined') return null;
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
      try {
        const res = await fetch(`${serverUrl}/matches/active/public`, { cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 404) {
            setMatchState(null);
            setActiveFighterA(null);
            setActiveFighterB(null);
          }
          return null;
        }
        const data = await res.json();
        if (data && data.snapshot) {
          setMatchState(data.snapshot);
          if (data.snapshot.status === 'dueling' || data.snapshot.status === 'suddenDeath') {
            if (data.snapshot.activeFighterA) setActiveFighterA(data.snapshot.activeFighterA);
            if (data.snapshot.activeFighterB) setActiveFighterB(data.snapshot.activeFighterB);
          } else if (data.snapshot.status === 'lobby' || data.snapshot.status === 'picking') {
            setActiveFighterA(null);
            setActiveFighterB(null);
          }

          if (data.arenaToken) {
            setTokens((prev) => {
              if (prev && prev.arena === data.arenaToken && !options?.forceTokenUpdate) {
                return prev;
              }
              const updated = {
                host: prev?.host ?? '',
                partyA: prev?.partyA ?? '',
                partyB: prev?.partyB ?? '',
                arena: data.arenaToken,
              };
              if (typeof window !== 'undefined') {
                localStorage.setItem('ld_stored_tokens', JSON.stringify(updated));
              }
              return updated;
            });
            if (activeTabRef.current === 'arena') {
              setAuthToken(data.arenaToken);
            }
          }
          return data;
        }
      } catch {
        // Network blip / server startup - interval will continue polling
      }
      return null;
    },
    [setAuthToken],
  );

  // Auto-discover active match and restore tokens on page load / refresh
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Try restoring tokens from localStorage
    let loadedTokens: StoredTokens | null = null;
    const saved = localStorage.getItem('ld_stored_tokens');
    if (saved) {
      try {
        loadedTokens = JSON.parse(saved);
        if (loadedTokens) {
          setTokens(loadedTokens);
        }
      } catch {
        localStorage.removeItem('ld_stored_tokens');
      }
    }

    // 2. Read query params if present (?tab=partyA&token=... or ?codex=true&role=paladin)
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as ActiveTab | null;
    const tokenParam = params.get('token');
    const codexParam = params.get('codex');
    const roleParam = params.get('role') || params.get('champion');

    if (codexParam === 'true' || codexParam === '1' || codexParam) {
      setIsCodexOpen(true);
      if (codexParam !== 'true' && codexParam !== '1') {
        setCodexRole(codexParam.toLowerCase().trim());
      }
    }
    if (roleParam) {
      setCodexRole(roleParam.toLowerCase().trim());
    }

    if (tabParam && ['arena', 'partyA', 'partyB', 'host'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    if (tokenParam) {
      setAuthToken(tokenParam);
      setTokens((prev) => {
        const updated = {
          host: tabParam === 'host' ? tokenParam : prev?.host ?? '',
          partyA: tabParam === 'partyA' ? tokenParam : prev?.partyA ?? '',
          partyB: tabParam === 'partyB' ? tokenParam : prev?.partyB ?? '',
          arena: tabParam === 'arena' ? tokenParam : prev?.arena ?? '',
        };
        localStorage.setItem('ld_stored_tokens', JSON.stringify(updated));
        return updated;
      });
      return;
    }

    // 3. Immediately sync active public match for Arena Spectator
    syncActivePublicMatch({ forceTokenUpdate: true });
  }, [setAuthToken, syncActivePublicMatch]);

  // Continuous live-sync & seamless recovery loop without page refresh
  useEffect(() => {
    const isDisconnectedOrEmpty = !matchState || connectionState !== 'connected';
    const pollIntervalMs = isDisconnectedOrEmpty ? 1500 : 4000;
    const interval = setInterval(() => {
      syncActivePublicMatch({
        forceTokenUpdate: activeTabRef.current === 'arena' && connectionState !== 'connected',
      });
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [syncActivePublicMatch, !matchState, connectionState]);

  // Synchronize WebSocket identity token with active tab
  useEffect(() => {
    if (activeTab === 'host' && tokens?.host) {
      setAuthToken(tokens.host);
    } else if (activeTab === 'partyA' && tokens?.partyA) {
      setAuthToken(tokens.partyA);
    } else if (activeTab === 'partyB' && tokens?.partyB) {
      setAuthToken(tokens.partyB);
    } else if (activeTab === 'arena') {
      if (tokens?.arena) {
        setAuthToken(tokens.arena);
      }
    }
  }, [activeTab, tokens?.host, tokens?.partyA, tokens?.partyB, tokens?.arena, setAuthToken]);

  // Socket event listeners for zero-latency live arena updates
  useEffect(() => {
    if (!socket) return;

    const onMatchState = (state: PublicMatchSnapshot) => {
      setMatchState(state);
      if (state.status === 'lobby' || state.status === 'picking') {
        setActiveFighterA(null);
        setActiveFighterB(null);
      } else if (state.status === 'dueling' || state.status === 'suddenDeath') {
        if (state.activeFighterA) setActiveFighterA(state.activeFighterA);
        if (state.activeFighterB) setActiveFighterB(state.activeFighterB);
      }
    };

    const onPartyState = (state: PrivatePartySnapshot) => {
      if (state.partySide === 'A') {
        setPartyStateA(state);
      } else {
        setPartyStateB(state);
      }
    };

    const onMatchError = ({ code, message }: { code: string; message: string }) => {
      if (
        code === 'UNAUTHORIZED' ||
        code === 'SESSION_EXPIRED' ||
        message.includes('Match not found') ||
        message.includes('Stale token') ||
        message.includes('expired')
      ) {
        syncActivePublicMatch({ forceTokenUpdate: true });
      }
      setToast({
        type: 'error',
        message: `[${code}] ${message}`,
      });
      setCombatLogs((prev) => [
        { actor: 'system', event: `⚠️ Server Error (${code}): ${message}` },
        ...prev,
      ]);
    };

    const onFighterLocked = ({ partySide }: { partySide: 'A' | 'B' }) => {
      setMatchState((prev) =>
        prev
          ? {
              ...prev,
              lockedPartyA: partySide === 'A' ? true : prev.lockedPartyA,
              lockedPartyB: partySide === 'B' ? true : prev.lockedPartyB,
            }
          : prev,
      );
      setCombatLogs((prev) => [
        { actor: partySide, event: `🔒 Party ${partySide} locked in their secret fighter pick.` },
        ...prev,
      ]);
    };

    const onActionLocked = ({ partySide }: { partySide: 'A' | 'B' }) => {
      setCombatLogs((prev) => [
        { actor: partySide, event: `🔒 Party ${partySide} committed their secret combat action.` },
        ...prev,
      ]);
    };

    const onFightersRevealed = ({
      fighterA,
      fighterB,
    }: {
      fighterA: PublicFighter;
      fighterB: PublicFighter;
    }) => {
      setActiveFighterA(fighterA);
      setActiveFighterB(fighterB);
      setToast({
        type: 'info',
        message: `⚔️ Picks Revealed: ${fighterA.roleId.toUpperCase()} vs ${fighterB.roleId.toUpperCase()}`,
      });
      setCombatLogs((prev) => [
        {
          actor: 'system',
          event: `⚔️ Fighters Revealed: ${fighterA.roleId.toUpperCase()} vs ${fighterB.roleId.toUpperCase()}`,
        },
        ...prev,
      ]);
    };

    const onTurnResolved = ({
      turnNumber,
      stateA,
      stateB,
      combatLog,
    }: {
      turnNumber: number;
      stateA: PublicFighter;
      stateB: PublicFighter;
      combatLog: Array<{ actor: 'A' | 'B' | 'system'; event: string }>;
    }) => {
      setActiveFighterA(stateA);
      setActiveFighterB(stateB);
      setMatchState((prev) =>
        prev
          ? {
              ...prev,
              currentTurnNumber: turnNumber + 1,
              activeFighterA: stateA,
              activeFighterB: stateB,
            }
          : prev,
      );
      setCombatLogs((prev) => [
        ...combatLog.map((c) => ({ actor: c.actor, event: c.event })),
        {
          actor: 'system',
          event: `Turn ${turnNumber} Resolved. (HP: Party A ${stateA.currentHp} | Party B ${stateB.currentHp})`,
        },
        ...prev,
      ]);
    };

    const onSuddenDeathStarted = ({
      fighterA,
      fighterB,
    }: {
      fighterA: PublicFighter;
      fighterB: PublicFighter;
    }) => {
      setActiveFighterA(fighterA);
      setActiveFighterB(fighterB);
      setMatchState((prev) =>
        prev
          ? {
              ...prev,
              status: 'suddenDeath',
              activeFighterA: fighterA,
              activeFighterB: fighterB,
            }
          : prev,
      );
      setToast({
        type: 'warning',
        message: '⚡ SUDDEN DEATH HAS COMMENCED!',
      });
      setCombatLogs((prev) => [
        { actor: 'system', event: '⚡⚡ SUDDEN DEATH HAS COMMENCED! ⚡⚡' },
        ...prev,
      ]);
    };

    const onDuelCompleted = ({
      winnerPartySide,
      reason,
      scoreA,
      scoreB,
    }: {
      winnerPartySide: 'A' | 'B';
      reason: string;
      scoreA: number;
      scoreB: number;
    }) => {
      setMatchState((prev) =>
        prev
          ? {
              ...prev,
              scoreA,
              scoreB,
            }
          : prev,
      );
      setToast({
        type: 'success',
        message: `🏁 Duel Concluded! Winner: Party ${winnerPartySide}. Series Score: ${scoreA} - ${scoreB}`,
      });
      setCombatLogs((prev) => [
        {
          actor: 'system',
          event: `🏁 Duel Concluded! Winner: Party ${winnerPartySide} (${reason}). Series Score: ${scoreA} - ${scoreB}`,
        },
        ...prev,
      ]);
    };

    const onTokensRotated = (payload: MatchTokensRotatedPayload) => {
      setTokens(payload.tokens);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ld_stored_tokens', JSON.stringify(payload.tokens));
      }
      const currentTab = activeTabRef.current;
      if (currentTab === 'arena' && payload.tokens.arena) {
        setAuthToken(payload.tokens.arena);
      } else if (currentTab === 'host' && payload.tokens.host) {
        setAuthToken(payload.tokens.host);
      } else if (currentTab === 'partyA' && payload.tokens.partyA) {
        setAuthToken(payload.tokens.partyA);
      } else if (currentTab === 'partyB' && payload.tokens.partyB) {
        setAuthToken(payload.tokens.partyB);
      }
      setToast({
        type: 'info',
        message: `🔄 Match Reset: Run ID incremented to ${payload.runId}`,
      });
      setCombatLogs((prev) => [
        { actor: 'system', event: `🔄 Match Reset: Run ID incremented to ${payload.runId}` },
        ...prev,
      ]);
      syncActivePublicMatch({ forceTokenUpdate: true });
    };

    const onMatchCompleted = ({
      winningPartySide,
      finalScoreA,
      finalScoreB,
    }: {
      winningPartySide: 'A' | 'B';
      finalScoreA: number;
      finalScoreB: number;
    }) => {
      setMatchState((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              scoreA: finalScoreA,
              scoreB: finalScoreB,
            }
          : prev,
      );
      setToast({
        type: 'success',
        message: `🏆 MATCH COMPLETE! PARTY ${winningPartySide} WINS THE TOURNAMENT (${finalScoreA} - ${finalScoreB})!`,
      });
      setCombatLogs((prev) => [
        {
          actor: 'system',
          event: `🏆🏆 MATCH COMPLETE! PARTY ${winningPartySide} WINS THE TOURNAMENT (${finalScoreA} - ${finalScoreB})! 🏆🏆`,
        },
        ...prev,
      ]);
    };

    socket.on('match:state', onMatchState);
    socket.on('party:state', onPartyState);
    socket.on('match:error', onMatchError);
    socket.on('duel:fighterLocked', onFighterLocked);
    socket.on('duel:actionLocked', onActionLocked);
    socket.on('duel:fightersRevealed', onFightersRevealed);
    socket.on('duel:turnResolved', onTurnResolved);
    socket.on('duel:suddenDeathStarted', onSuddenDeathStarted);
    socket.on('duel:completed', onDuelCompleted);
    socket.on('match:tokensRotated', onTokensRotated);
    socket.on('match:completed', onMatchCompleted);

    return () => {
      socket.off('match:state', onMatchState);
      socket.off('party:state', onPartyState);
      socket.off('match:error', onMatchError);
      socket.off('duel:fighterLocked', onFighterLocked);
      socket.off('duel:actionLocked', onActionLocked);
      socket.off('duel:fightersRevealed', onFightersRevealed);
      socket.off('duel:turnResolved', onTurnResolved);
      socket.off('duel:suddenDeathStarted', onSuddenDeathStarted);
      socket.off('duel:completed', onDuelCompleted);
      socket.off('match:tokensRotated', onTokensRotated);
      socket.off('match:completed', onMatchCompleted);
    };
  }, [socket, syncActivePublicMatch, setAuthToken]);

  const handleProvision = (newTokens: StoredTokens, _matchId: string) => {
    setTokens(newTokens);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ld_stored_tokens', JSON.stringify(newTokens));
    }
    setActiveTab('host');
    setAuthToken(newTokens.host);
  };

  return (
    <div className="min-h-screen pb-16 relative">
      {/* Ambient Celestial Diya Particles */}
      <FestiveParticles />

      <HeaderNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        matchId={matchState?.matchId}
        onOpenCodex={() => setIsCodexOpen(true)}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 max-w-md animate-slideIn">
          <div
            className={`p-4 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center justify-between gap-3 ${
              toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                : toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
            }`}
          >
            <span className="text-xs font-semibold">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-xs font-bold text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        {activeTab === 'host' && (
          <HostScreen
            matchState={matchState}
            tokens={tokens}
            onProvision={handleProvision}
          />
        )}

        {activeTab === 'partyA' && (
          <PartyScreen
            partySide="A"
            partyState={partyStateA}
            matchState={matchState}
            activeFighterA={activeFighterA ?? matchState?.activeFighterA}
            activeFighterB={activeFighterB ?? matchState?.activeFighterB}
          />
        )}

        {activeTab === 'partyB' && (
          <PartyScreen
            partySide="B"
            partyState={partyStateB}
            matchState={matchState}
            activeFighterA={activeFighterA ?? matchState?.activeFighterA}
            activeFighterB={activeFighterB ?? matchState?.activeFighterB}
          />
        )}

        {activeTab === 'arena' && (
          <ArenaScreen
            matchState={matchState}
            activeFighterA={activeFighterA ?? matchState?.activeFighterA}
            activeFighterB={activeFighterB ?? matchState?.activeFighterB}
            combatLogs={combatLogs}
            onNavigateToHost={() => setActiveTab('host')}
          />
        )}
      </main>

      {/* Champion Role Codex Modal */}
      <RoleCodexModal
        isOpen={isCodexOpen}
        onClose={() => setIsCodexOpen(false)}
        initialRole={codexRole}
        onRoleSelect={(roleId) => setCodexRole(roleId)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <SocketProvider>
      <MainApp />
    </SocketProvider>
  );
}
