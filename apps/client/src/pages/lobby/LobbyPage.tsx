import { useState } from 'react';

interface LobbyPageProps {
  tournamentId: string;
  playerName: string;
  playerJoinLink: string;
  spectatorJoinLink: string;
  onTournamentIdChange: (tournamentId: string) => void;
  onPlayerNameChange: (name: string) => void;
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

  return (
    <main className="page page-lobby">
      <section className="card lobbyHeroCard">
        <h1>Poker Tournament</h1>
        <p className="muted">Desktop tournament table (9-max / single table)</p>
      </section>

      <section className="card lobbyCreateCard">
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

      <section className="card lobbyJoinCard">
        <h2>Join</h2>
        <label>
          Tournament ID
          <input
            value={props.tournamentId}
            onChange={(e) => props.onTournamentIdChange(e.target.value)}
            placeholder="trn_xxx"
          />
        </label>

        <label>
          Name
          <input
            value={props.playerName}
            onChange={(e) => props.onPlayerNameChange(e.target.value)}
            placeholder="your name"
          />
        </label>

        <div className="buttonRow">
          <button
            disabled={props.loading || !props.tournamentId || !props.playerName}
            onClick={() => props.onJoinPlayer({ tournamentId: props.tournamentId, name: props.playerName })}
          >
            Join as Player
          </button>
          <button
            disabled={props.loading || !props.tournamentId || !props.playerName}
            onClick={() => props.onJoinSpectator({ tournamentId: props.tournamentId, name: props.playerName })}
          >
            Join as Spectator
          </button>
        </div>

        <button disabled={props.loading || !props.tournamentId} onClick={() => props.onStart(props.tournamentId)}>
          Start Tournament
        </button>
      </section>

      {props.tournamentId ? (
        <section className="card lobbyLinksCard">
          <h2>Join Links</h2>
          <p className="muted">このリンクを開くと、指定Nameでそのまま参加できます。</p>
          <a className="joinLink" href={props.playerJoinLink}>
            Player Link
          </a>
          <a className="joinLink" href={props.spectatorJoinLink}>
            Spectator Link
          </a>
        </section>
      ) : null}
    </main>
  );
}
