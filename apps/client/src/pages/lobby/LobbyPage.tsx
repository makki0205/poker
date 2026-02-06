import { useState } from 'react';

interface LobbyPageProps {
  tournamentId: string;
  onCreate: (input: {
    name: string;
    durationMinutes: 30 | 60 | 90;
    startingStack: number;
    botCount: number;
  }) => Promise<void>;
  onJoinPlayer: (input: { tournamentId: string; name: string }) => Promise<void>;
  onJoinSpectator: (input: { tournamentId: string; name: string }) => Promise<void>;
  onStart: (tournamentId: string) => Promise<void>;
  loading: boolean;
}

export function LobbyPage(props: LobbyPageProps) {
  const [createName, setCreateName] = useState('Daily Tournament');
  const [durationMinutes, setDurationMinutes] = useState<30 | 60 | 90>(60);
  const [startingStack, setStartingStack] = useState(20000);
  const [botCount, setBotCount] = useState(2);

  const [joinTournamentId, setJoinTournamentId] = useState(props.tournamentId);
  const [joinName, setJoinName] = useState('');

  return (
    <main className="page">
      <section className="card">
        <h1>Poker Tournament</h1>
        <p className="muted">Mobile tournament table (9-max / single table)</p>
      </section>

      <section className="card">
        <h2>Create Tournament</h2>
        <label>
          Name
          <input value={createName} onChange={(e) => setCreateName(e.target.value)} />
        </label>

        <label>
          Duration
          <select
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value) as 30 | 60 | 90)}
          >
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
            <option value={90}>90 min</option>
          </select>
        </label>

        <label>
          Starting Stack
          <input
            type="number"
            min={100}
            value={startingStack}
            onChange={(e) => setStartingStack(Number(e.target.value))}
          />
        </label>

        <label>
          Bot Count
          <input
            type="number"
            min={0}
            max={8}
            value={botCount}
            onChange={(e) => setBotCount(Number(e.target.value))}
          />
        </label>

        <button
          disabled={props.loading}
          onClick={() =>
            props.onCreate({
              name: createName,
              durationMinutes,
              startingStack,
              botCount
            })
          }
        >
          Create
        </button>
      </section>

      <section className="card">
        <h2>Join</h2>
        <label>
          Tournament ID
          <input
            value={joinTournamentId}
            onChange={(e) => setJoinTournamentId(e.target.value)}
            placeholder="trn_xxx"
          />
        </label>

        <label>
          Name
          <input value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="your name" />
        </label>

        <div className="buttonRow">
          <button
            disabled={props.loading || !joinTournamentId || !joinName}
            onClick={() => props.onJoinPlayer({ tournamentId: joinTournamentId, name: joinName })}
          >
            Join as Player
          </button>
          <button
            disabled={props.loading || !joinTournamentId || !joinName}
            onClick={() => props.onJoinSpectator({ tournamentId: joinTournamentId, name: joinName })}
          >
            Join as Spectator
          </button>
        </div>

        <button disabled={props.loading || !joinTournamentId} onClick={() => props.onStart(joinTournamentId)}>
          Start Tournament
        </button>
      </section>
    </main>
  );
}
