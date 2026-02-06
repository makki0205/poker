import type { ServerEvent, TableSnapshot } from '@poker/shared';
import { useEffect, useRef, useState } from 'react';
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

export function App() {
  const [view, setView] = useState<View>('lobby');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [tournamentId, setTournamentId] = useState('');
  const [status, setStatus] = useState('waiting');
  const [session, setSession] = useState<SessionState | null>(null);
  const [snapshot, setSnapshot] = useState<TableSnapshot | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);

  const socketRef = useRef<TournamentSocket | null>(null);

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
      setSession({
        sessionId: joined.sessionId,
        role: 'player',
        playerId: joined.playerId
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
      setSession({
        sessionId: joined.sessionId,
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
    setView('lobby');
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
        onCreate={handleCreate}
        onJoinPlayer={handleJoinPlayer}
        onJoinSpectator={handleJoinSpectator}
        onStart={handleStart}
        loading={loading}
      />
    </>
  );
}
