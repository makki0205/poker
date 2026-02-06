import type { Card, ServerEvent, TableSnapshot } from '@poker/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createTournament, joinAsSpectator, joinTournament, rebuy, startTournament } from '../shared/api';
import { connectTournamentSocket, type TournamentSocket } from '../shared/ws';
import { LobbyPage } from '../pages/lobby/LobbyPage';
import { TablePage } from '../pages/table/TablePage';
import { ResultPage } from '../pages/result/ResultPage';

type View = 'lobby' | 'table' | 'result';

interface SessionState {
  sessionId: string;
  role: 'player' | 'spectator';
  playerId?: string;
}

interface ResultState {
  winnerPlayerId: string;
  rankings: string[];
}

interface LastHandResultState {
  handId: string;
  winners: string[];
  payouts: Array<{ playerId: string; amount: number }>;
  board: Card[];
  winnerHoleCards: Array<{ playerId: string; cards: Card[] }>;
}

interface UrlState {
  tournamentId?: string | null;
  name?: string | null;
  role?: 'player' | 'spectator' | null;
}

function replaceUrlState(next: UrlState): void {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (next.tournamentId === null) {
    params.delete('tournamentId');
  } else if (typeof next.tournamentId === 'string') {
    params.set('tournamentId', next.tournamentId);
  }

  if (next.name === null) {
    params.delete('name');
  } else if (typeof next.name === 'string') {
    params.set('name', next.name);
  }

  if (next.role === null) {
    params.delete('role');
  } else if (next.role) {
    params.set('role', next.role);
  }

  const query = params.toString();
  const nextUrl = `${url.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

function buildJoinLink(tournamentId: string, role: 'player' | 'spectator', name: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('tournamentId', tournamentId);
  url.searchParams.set('role', role);
  if (name.trim()) {
    url.searchParams.set('name', name.trim());
  } else {
    url.searchParams.delete('name');
  }
  return `${url.origin}${url.pathname}?${url.searchParams.toString()}`;
}

export function App() {
  const [view, setView] = useState<View>('lobby');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [tournamentId, setTournamentId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [status, setStatus] = useState('waiting');
  const [session, setSession] = useState<SessionState | null>(null);
  const [snapshot, setSnapshot] = useState<TableSnapshot | null>(null);
  const [lastHandResult, setLastHandResult] = useState<LastHandResultState | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);

  const socketRef = useRef<TournamentSocket | null>(null);
  const autoJoinDoneRef = useRef(false);

  const playerJoinLink = useMemo(() => {
    if (!tournamentId) {
      return '';
    }
    return buildJoinLink(tournamentId, 'player', playerName);
  }, [playerName, tournamentId]);

  const spectatorJoinLink = useMemo(() => {
    if (!tournamentId) {
      return '';
    }
    return buildJoinLink(tournamentId, 'spectator', playerName);
  }, [playerName, tournamentId]);

  useEffect(() => {
    if (autoJoinDoneRef.current) {
      return;
    }
    autoJoinDoneRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlTournamentId = params.get('tournamentId')?.trim() ?? '';
    const urlName = params.get('name')?.trim() ?? '';
    const urlRole = params.get('role');

    if (urlTournamentId) {
      setTournamentId(urlTournamentId);
    }
    if (urlName) {
      setPlayerName(urlName);
    }

    if (!urlTournamentId || !urlName || (urlRole !== 'player' && urlRole !== 'spectator')) {
      return;
    }

    void (async () => {
      setLoading(true);
      setMessage('');
      try {
        if (urlRole === 'player') {
          const joined = await joinTournament(urlTournamentId, urlName);
          setSession({
            sessionId: joined.sessionId,
            role: 'player',
            playerId: joined.playerId
          });
        } else {
          const joined = await joinAsSpectator(urlTournamentId, urlName);
          setSession({
            sessionId: joined.sessionId,
            role: 'spectator'
          });
        }
        setView('table');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to auto join from URL');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!session || !tournamentId) {
      return undefined;
    }

    socketRef.current?.close();
    socketRef.current = connectTournamentSocket(
      tournamentId,
      session.sessionId,
      (event) => onServerEvent(event),
      (error) => setMessage(error)
    );

    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [session, tournamentId]);

  function onServerEvent(event: ServerEvent): void {
    if (event.type === 'table.snapshot') {
      setSnapshot(event.payload.table);
      setStatus(event.payload.status);
      setView('table');
      return;
    }

    if (event.type === 'tournament.finished') {
      setResult({
        winnerPlayerId: event.payload.winnerPlayerId,
        rankings: event.payload.rankings
      });
      setView('result');
      return;
    }

    if (event.type === 'hand.finished') {
      setLastHandResult({
        handId: event.payload.handId,
        winners: event.payload.winners,
        payouts: event.payload.payouts,
        board: event.payload.board,
        winnerHoleCards: event.payload.winnerHoleCards
      });
      return;
    }

    if (event.type === 'error') {
      setMessage(`${event.payload.code}: ${event.payload.message}`);
    }
  }

  async function handleCreate(input: {
    name: string;
    durationMinutes: 30 | 60 | 90;
    startingStack: number;
    botCount: number;
  }) {
    setLoading(true);
    setMessage('');
    try {
      const created = await createTournament({
        name: input.name,
        durationMinutes: input.durationMinutes,
        maxSeats: 9,
        startingStack: input.startingStack,
        botCount: input.botCount
      });
      setTournamentId(created.tournamentId);
      setStatus(created.status);
      replaceUrlState({
        tournamentId: created.tournamentId,
        name: playerName || null,
        role: null
      });
      setMessage(`Tournament created: ${created.tournamentId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinPlayer(input: { tournamentId: string; name: string }) {
    setLoading(true);
    setMessage('');
    try {
      const joined = await joinTournament(input.tournamentId, input.name);
      setTournamentId(input.tournamentId);
      setPlayerName(input.name);
      setSession({
        sessionId: joined.sessionId,
        role: 'player',
        playerId: joined.playerId
      });
      replaceUrlState({
        tournamentId: input.tournamentId,
        name: input.name,
        role: 'player'
      });
      setView('table');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to join player');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinSpectator(input: { tournamentId: string; name: string }) {
    setLoading(true);
    setMessage('');
    try {
      const joined = await joinAsSpectator(input.tournamentId, input.name);
      setTournamentId(input.tournamentId);
      setPlayerName(input.name);
      setSession({
        sessionId: joined.sessionId,
        role: 'spectator'
      });
      replaceUrlState({
        tournamentId: input.tournamentId,
        name: input.name,
        role: 'spectator'
      });
      setView('table');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to join spectator');
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(currentTournamentId: string) {
    setLoading(true);
    setMessage('');
    try {
      const started = await startTournament(currentTournamentId);
      setStatus(started.status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to start tournament');
    } finally {
      setLoading(false);
    }
  }

  function handleAction(action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin', amount: number) {
    if (!session || session.role !== 'player' || !session.playerId || !snapshot?.handId) {
      return;
    }

    socketRef.current?.send({
      type: 'player.action',
      payload: {
        handId: snapshot.handId,
        playerId: session.playerId,
        action,
        amount
      }
    });
  }

  async function handleRebuy() {
    if (!session?.playerId || !tournamentId) {
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await rebuy(tournamentId, session.playerId);
      setMessage('Rebuy completed');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to rebuy');
    } finally {
      setLoading(false);
    }
  }

  function backToLobby() {
    socketRef.current?.close();
    socketRef.current = null;
    setSession(null);
    setSnapshot(null);
    setLastHandResult(null);
    setResult(null);
    setView('lobby');
    replaceUrlState({
      tournamentId: tournamentId || null,
      name: playerName || null,
      role: null
    });
  }

  if (view === 'result' && result) {
    return (
      <ResultPage
        tournamentId={tournamentId}
        winnerPlayerId={result.winnerPlayerId}
        rankings={result.rankings}
        onBackToLobby={backToLobby}
      />
    );
  }

  if (view === 'table') {
    return (
      <TablePage
        snapshot={snapshot}
        role={session?.role ?? 'spectator'}
        playerId={session?.playerId}
        tournamentId={tournamentId}
        status={status}
        message={message}
        lastHandResult={lastHandResult}
        onAction={handleAction}
        onRebuy={handleRebuy}
        onBackToLobby={backToLobby}
      />
    );
  }

  return (
    <>
      {message ? (
        <div className="notice" role="alert">
          {message}
        </div>
      ) : null}
      <LobbyPage
        tournamentId={tournamentId}
        playerName={playerName}
        playerJoinLink={playerJoinLink}
        spectatorJoinLink={spectatorJoinLink}
        onTournamentIdChange={setTournamentId}
        onPlayerNameChange={setPlayerName}
        onCreate={handleCreate}
        onJoinPlayer={handleJoinPlayer}
        onJoinSpectator={handleJoinSpectator}
        onStart={handleStart}
        loading={loading}
      />
    </>
  );
}
