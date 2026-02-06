interface ResultPageProps {
  tournamentId: string;
  winnerPlayerId: string;
  rankings: string[];
  onBackToLobby: () => void;
}

export function ResultPage(props: ResultPageProps) {
  return (
    <main className="page page-result">
      <section className="card resultSummaryCard">
        <h1>Result</h1>
        <p className="muted">Tournament: {props.tournamentId}</p>
        <h2>Winner: {props.winnerPlayerId}</h2>
      </section>

      <section className="card resultRankingCard">
        <h2>Rankings</h2>
        <ol>
          {props.rankings.map((playerId) => (
            <li key={playerId}>{playerId}</li>
          ))}
        </ol>
      </section>

      <section className="card resultFooterCard">
        <button onClick={props.onBackToLobby}>Back to Lobby</button>
      </section>
    </main>
  );
}
