interface ResultPageProps {
  tournamentId: string;
  winnerPlayerId: string;
  rankings: string[];
  onBackToLobby: () => void;
}

export function ResultPage(props: ResultPageProps) {
  return (
    <main className="page">
      <section className="card">
        <h1>Result</h1>
        <p className="muted">Tournament: {props.tournamentId}</p>
        <h2>Winner: {props.winnerPlayerId}</h2>
      </section>

      <section className="card">
        <h2>Rankings</h2>
        <ol>
          {props.rankings.map((playerId) => (
            <li key={playerId}>{playerId}</li>
          ))}
        </ol>
      </section>

      <section className="card">
        <button onClick={props.onBackToLobby}>Back to Lobby</button>
      </section>
    </main>
  );
}
