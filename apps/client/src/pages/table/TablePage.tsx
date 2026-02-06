import type { ActionType, Card, TableSnapshot } from '@poker/shared';
import { useEffect, useMemo, useState } from 'react';

interface TablePageProps {
  snapshot: TableSnapshot | null;
  role: 'player' | 'spectator';
  playerId?: string;
  tournamentId: string;
  status: string;
  message?: string;
  onAction: (action: ActionType, amount: number) => void;
  onRebuy: () => void;
  onBackToLobby: () => void;
}

function renderCard(card: Card): string {
  const rankMap: Record<number, string> = {
    11: 'J',
    12: 'Q',
    13: 'K',
    14: 'A'
  };
  const suitMap: Record<Card['suit'], string> = {
    c: '♣',
    d: '♦',
    h: '♥',
    s: '♠'
  };
  return `${rankMap[card.rank] ?? card.rank}${suitMap[card.suit]}`;
}

function cardClass(card: Card): string {
  if (card.suit === 'd' || card.suit === 'h') {
    return 'chip chip-red';
  }
  return 'chip';
}

export function TablePage(props: TablePageProps) {
  const [betAmount, setBetAmount] = useState(0);
  const snapshot = props.snapshot;

  const me = useMemo(
    () => snapshot?.seats.find((seat) => seat.playerId === props.playerId),
    [props.playerId, snapshot]
  );

  const highestBet = useMemo(
    () => Math.max(0, ...(snapshot?.seats.map((seat) => seat.currentBet) ?? [0])),
    [snapshot]
  );

  const myCurrentBet = me?.currentBet ?? 0;
  const myStack = me?.stack ?? 0;
  const toCall = Math.max(0, highestBet - myCurrentBet);
  const maxActionTo = myCurrentBet + myStack;
  const suggestedMinTo = snapshot?.minRaiseTo ?? (highestBet > 0 ? highestBet + Math.max(1, toCall) : 1);
  const sliderMin = Math.min(maxActionTo, Math.max(1, suggestedMinTo));
  const sliderMax = Math.max(sliderMin, maxActionTo);

  useEffect(() => {
    if (!Number.isFinite(sliderMin)) {
      return;
    }
    setBetAmount((prev) => {
      if (prev < sliderMin || prev > sliderMax || prev === 0) {
        return sliderMin;
      }
      return prev;
    });
  }, [sliderMin, sliderMax]);

  const isMyTurn = Boolean(snapshot && props.playerId && snapshot.currentActorId === props.playerId);

  function quickAmount(rate: number): number {
    const target = myCurrentBet + Math.floor(myStack * rate);
    return Math.max(sliderMin, Math.min(sliderMax, target));
  }

  return (
    <main className="page">
      <section className="card card-topline">
        <h1>Table</h1>
        <p className="muted">Tournament: {props.tournamentId}</p>
        <p className="muted">
          Status: {props.status} / Phase: {snapshot?.phase ?? '-'} / Pot: {snapshot?.pot ?? 0}
        </p>
        {props.message ? <p className="error">{props.message}</p> : null}
      </section>

      <section className="card tableArena">
        <div className="potBadge">Pot {snapshot?.pot ?? 0}</div>
        <h2>Board</h2>
        <div className="cards boardCards">
          {snapshot?.board.length ? (
            snapshot.board.map((card, idx) => (
              <span
                className={cardClass(card)}
                style={{ animationDelay: `${idx * 80}ms` }}
                key={`${idx}-${card.rank}-${card.suit}`}
              >
                {renderCard(card)}
              </span>
            ))
          ) : (
            <span className="muted">No community cards yet</span>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Players</h2>
        <div className="seatList">
          {snapshot?.seats.map((seat) => {
            const turnClass = snapshot.currentActorId === seat.playerId ? 'is-turn' : '';
            const meClass = props.playerId === seat.playerId ? 'is-me' : '';

            return (
              <article className={`seat ${turnClass} ${meClass}`.trim()} key={seat.playerId}>
                <header className="seatHead">
                  <strong>
                    #{seat.seatNo} {seat.name} {seat.isBot ? '(BOT)' : ''}
                  </strong>
                  {seat.isDealer ? <p className="badge">Dealer</p> : null}
                </header>
                <p>Stack: {seat.stack}</p>
                <p>Status: {seat.status}</p>
                <p>Bet: {seat.currentBet}</p>
                <div className="cards">
                  {seat.holeCards?.map((card, idx) => (
                    <span className={cardClass(card)} key={`${seat.playerId}-${idx}-${card.rank}-${card.suit}`}>
                      {renderCard(card)}
                    </span>
                  )) ?? <span className="muted">Hidden</span>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {props.role === 'player' ? (
        <section className="card actionsCard">
          <h2>Actions</h2>
          <p className="muted turnLabel">{isMyTurn ? 'Your turn' : 'Waiting for your turn'}</p>

          <div className="actionInfo">
            <span>To Call: {toCall}</span>
            <span>Min Raise To: {snapshot?.minRaiseTo ?? '-'}</span>
            <span>Stack: {myStack}</span>
          </div>

          <div className="buttonRow">
            <button disabled={!isMyTurn} onClick={() => props.onAction('fold', 0)}>
              Fold
            </button>
            <button disabled={!isMyTurn} onClick={() => props.onAction('check', 0)}>
              Check
            </button>
            <button disabled={!isMyTurn} onClick={() => props.onAction('call', 0)}>
              Call
            </button>
            <button disabled={!isMyTurn} onClick={() => props.onAction('allin', 0)}>
              All-in
            </button>
          </div>

          <label>
            Bet/Raise To: <strong>{betAmount}</strong>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={1}
              value={Math.min(sliderMax, Math.max(sliderMin, betAmount))}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              disabled={!isMyTurn || myStack <= 0}
              className="betSlider"
            />
            <input
              type="number"
              min={sliderMin}
              max={sliderMax}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              disabled={!isMyTurn || myStack <= 0}
            />
          </label>

          <div className="buttonRow quickRow">
            <button disabled={!isMyTurn || myStack <= 0} onClick={() => setBetAmount(sliderMin)}>
              Min
            </button>
            <button disabled={!isMyTurn || myStack <= 0} onClick={() => setBetAmount(quickAmount(0.5))}>
              50%
            </button>
            <button disabled={!isMyTurn || myStack <= 0} onClick={() => setBetAmount(quickAmount(0.75))}>
              75%
            </button>
            <button disabled={!isMyTurn || myStack <= 0} onClick={() => setBetAmount(sliderMax)}>
              Max
            </button>
          </div>

          <div className="buttonRow">
            <button disabled={!isMyTurn} onClick={() => props.onAction('bet', betAmount)}>
              Bet
            </button>
            <button disabled={!isMyTurn} onClick={() => props.onAction('raise', betAmount)}>
              Raise
            </button>
          </div>

          {me && me.stack <= 0 ? <button onClick={props.onRebuy}>Rebuy</button> : null}
        </section>
      ) : (
        <section className="card">
          <h2>Spectator</h2>
          <p className="muted">観戦モードのためアクションはできません。</p>
        </section>
      )}

      <section className="card">
        <button onClick={props.onBackToLobby}>Back to Lobby</button>
      </section>
    </main>
  );
}
