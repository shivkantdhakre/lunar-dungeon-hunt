'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, MatchTokensRotatedPayload } from '@dungeon-hunt/shared-contracts';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface PendingPing {
  sentPerf: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface SocketContextValue {
  socket: AppSocket | null;
  connectionState: ConnectionState;
  rtt: number | null;
  sendPing: () => void;
  setAuthToken: (token: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connectionState: 'idle',
  rtt: null,
  sendPing: () => {},
  setAuthToken: () => {},
});

export function SocketProvider({
  children,
  authToken,
  onTokensRotated,
}: {
  children: ReactNode;
  authToken?: string;
  onTokensRotated?: (payload: MatchTokensRotatedPayload) => void;
}) {
  const socketRef = useRef<AppSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [rtt, setRtt] = useState<number | null>(null);
  const [activeToken, setActiveToken] = useState<string | undefined>(authToken);
  const pendingPings = useRef<Map<string, PendingPing>>(new Map());
  const onTokensRotatedRef = useRef(onTokensRotated);

  useEffect(() => {
    onTokensRotatedRef.current = onTokensRotated;
  }, [onTokensRotated]);

  useEffect(() => {
    setActiveToken(authToken);
  }, [authToken]);

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
    const socket: AppSocket = io(serverUrl, {
      autoConnect: false,
      withCredentials: true,
      auth: { token: activeToken },
      transports: ['polling', 'websocket'],
    });
    socketRef.current = socket;

    const onConnect = () => setConnectionState('connected');
    const onDisconnect = () => setConnectionState('disconnected');
    const onConnectError = () => setConnectionState('reconnecting');
    const onPong = ({ requestId }: { requestId: string; serverReceivedAt: number }) => {
      const pending = pendingPings.current.get(requestId);
      if (pending) {
        clearTimeout(pending.timeoutId);
        setRtt(Math.round(performance.now() - pending.sentPerf));
        pendingPings.current.delete(requestId);
      }
    };

    // P0.1, P1.3, P2.5: Listen for rotated credentials on match reset and reconnect with new token
    const onTokensRotatedHandler = (payload: MatchTokensRotatedPayload) => {
      onTokensRotatedRef.current?.(payload);
      if (payload.tokens.host) {
        setActiveToken(payload.tokens.host);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('pong', onPong);
    socket.on('match:tokensRotated', onTokensRotatedHandler);

    setConnectionState('connecting');
    socket.connect();

    return () => {
      for (const [, pending] of pendingPings.current) {
        clearTimeout(pending.timeoutId);
      }
      pendingPings.current.clear();

      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('pong', onPong);
      socket.off('match:tokensRotated', onTokensRotatedHandler);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeToken]);

  const sendPing = useCallback(() => {
    const s = socketRef.current;
    if (!s || !s.connected) return;

    const requestId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `ping-${Date.now()}-${Math.random()}`;
    const timeoutId = setTimeout(() => {
      pendingPings.current.delete(requestId);
    }, 5000);

    pendingPings.current.set(requestId, {
      sentPerf: performance.now(),
      timeoutId,
    });

    s.emit('ping', { requestId, sentAt: Date.now() });
  }, []);

  const setAuthToken = useCallback((token: string) => {
    setActiveToken(token);
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connectionState, rtt, sendPing, setAuthToken }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
