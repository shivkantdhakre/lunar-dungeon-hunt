'use client';

import React, { useState, useEffect } from 'react';
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
  const { socket, setAuthToken } = useSocket();
  const [activeTab, setActiveTab] = useState<ActiveTab>('arena');
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

    // 3. If no tokens or active match loaded, auto-fetch active public match for Arena Spectator
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
    fetch(`${serverUrl}/matches/active/public`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.snapshot) {
          setMatchState(data.snapshot);
          if (data.snapshot.activeFighterA) setActiveFighterA(data.snapshot.activeFighterA);
          if (data.snapshot.activeFighterB) setActiveFighterB(data.snapshot.activeFighterB);
          if (data.arenaToken && (!loadedTokens || !loadedTokens.arena)) {
            setAuthToken(data.arenaToken);
            setTokens((prev) => {
              const updated = {
                host: prev?.host ?? '',
                partyA: prev?.partyA ?? '',
                partyB: prev?.partyB ?? '',
                arena: data.arenaToken,
              };
              localStorage.setItem('ld_stored_tokens', JSON.stringify(updated));
              return updated;
            });
          }
        }
      })
      .catch(() => {});
  }, [setAuthToken]);

  // Synchronize WebSocket identity token with active tab
  useEffect(() => {
    if (!tokens) return;
    if (activeTab === 'host' && tokens.host) {
      setAuthToken(tokens.host);
    } else if (activeTab === 'partyA' && tokens.partyA) {
      setAuthToken(tokens.partyA);
    } else if (activeTab === 'partyB' && tokens.partyB) {
      setAuthToken(tokens.partyB);
    } else if (activeTab === 'arena' && tokens.arena) {
      setAuthToken(tokens.arena);
    }
  }, [activeTab, tokens, setAuthToken]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const onMatchState = (state: PublicMatchSnapshot) => {
      setMatchState(state);
      if (state.activeFighterA) setActiveFighterA(state.activeFighterA);
      if (state.activeFighterB) setActiveFighterB(state.activeFighterB);
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
        code === 'UNAUTHORIZED' &&
        (message.includes('Match not found') ||
          message.includes('Stale token') ||
          message.includes('expired'))
      ) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('ld_stored_tokens');
        }
        setTokens(null);
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
      setToast({
        type: 'info',
        message: `🔄 Match Reset: Run ID incremented to ${payload.runId}`,
      });
      setCombatLogs((prev) => [
        { actor: 'system', event: `🔄 Match Reset: Run ID incremented to ${payload.runId}` },
        ...prev,
      ]);
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
  }, [socket]);

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
