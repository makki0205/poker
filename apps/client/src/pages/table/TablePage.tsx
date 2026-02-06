import type { ActionType, Card, TableSnapshot } from '@poker/shared';
import { useEffect, useMemo, useState } from 'react';

interface TablePageProps {
  snapshot: TableSnapshot | null;
  role: 'player' | 'spectator';
  playerId?: string;
  tournamentId: string;
  status: string;
  message?: string;
  lastHandResult: {
    handId: string;
    winners: string[];
    payouts: Array<{ playerId: string; amount: number }>;
    board: Card[];
    winnerHoleCards: Array<{ playerId: string; cards: Card[] }>;
  } | null;
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

function seatPositionClass(seatNo: number): string {
  return `seat-pos-${seatNo}`;
}

export function TablePage(props: TablePageProps) {
  const [betAmount, setBetAmount] = useState(0);
  const [winnerFlashIds, setWinnerFlashIds] = useState<string[]>([]);
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
  const hasExistingBet = highestBet > 0;
  const canCheck = toCall === 0;
  const canCall = toCall > 0;
  const maxActionTo = myCurrentBet + myStack;
  const suggestedMinTo = snapshot?.minRaiseTo ?? (highestBet > 0 ? highestBet + Math.max(1, toCall) : 1);
  const sliderMin = Math.min(maxActionTo, Math.max(1, suggestedMinTo));
  const sliderMax = Math.max(sliderMin, maxActionTo);
  const canRaise = hasExistingBet && typeof snapshot?.minRaiseTo === 'number' && sliderMax >= snapshot.minRaiseTo;
  const canAggressiveAction = hasExistingBet ? canRaise : myStack > 0;
  const aggressiveLabel = hasExistingBet ? 'Raise' : 'Bet';
  const aggressiveActionType: ActionType = hasExistingBet ? 'raise' : 'bet';

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

  useEffect(() => {
    if (!props.lastHandResult?.winners.length) {
      return;
    }
    setWinnerFlashIds(props.lastHandResult.winners);
    const timer = window.setTimeout(() => setWinnerFlashIds([]), 2500);
    return () => window.clearTimeout(timer);
  }, [props.lastHandResult?.handId, props.lastHandResult?.winners]);

  const isMyTurn = Boolean(snapshot && props.playerId && snapshot.currentActorId === props.playerId);
  const seatNameMap = useMemo(() => {
    const map = new Map<string, string>();
    snapshot?.seats.forEach((seat) => map.set(seat.playerId, seat.name));
    return map;
  }, [snapshot]);

  const payoutRows = useMemo(() => {
    if (!props.lastHandResult) {
      return [];
    }
    return props.lastHandResult.payouts
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .map((row) => ({
        ...row,
        name: seatNameMap.get(row.playerId) ?? row.playerId
      }));
  }, [props.lastHandResult, seatNameMap]);

  const winnerCardRows = useMemo(() => {
    if (!props.lastHandResult) {
      return [];
    }
    return props.lastHandResult.winnerHoleCards.map((row) => ({
      ...row,
      name: seatNameMap.get(row.playerId) ?? row.playerId
    }));
  }, [props.lastHandResult, seatNameMap]);

  function quickAmount(rate: number): number {
    const target = myCurrentBet + Math.floor(myStack * rate);
    return Math.max(sliderMin, Math.min(sliderMax, target));
  }

  return (
    <main className="page page-table">
      <section className="card card-topline tableHeaderCard">
        <h1>Table</h1>
        <p className="muted">Tournament: {props.tournamentId}</p>
        <p className="muted">
          Status: {props.status} / Phase: {snapshot?.phase ?? '-'} / Pot: {snapshot?.pot ?? 0}
        </p>
        {props.message ? <p className="error">{props.message}</p> : null}
      </section>

      {props.lastHandResult ? (
        <section className="card handResultCard tableResultCard">
          <h2>Last Hand Result</h2>
          <p className="muted">Hand: {props.lastHandResult.handId}</p>
          <p className="resultWinners">
            Winner:{' '}
            {props.lastHandResult.winners
              .map((winnerId) => seatNameMap.get(winnerId) ?? winnerId)
              .join(', ')}
          </p>
          <div className="resultPayoutList">
            {payoutRows.map((row) => (
              <div key={`${row.playerId}-${row.amount}`} className="resultPayoutRow">
                <span>{row.name}</span>
                <strong>+{row.amount}</strong>
              </div>
            ))}
          </div>
          {props.lastHandResult.board.length > 0 ? (
            <>
              <p className="muted">Board</p>
              <div className="cards">
                {props.lastHandResult.board.map((card, idx) => (
                  <span className={cardClass(card)} key={`result-board-${idx}-${card.rank}-${card.suit}`}>
                    {renderCard(card)}
                  </span>
                ))}
              </div>
            </>
          ) : null}
          {winnerCardRows.length > 0 ? (
            <div className="winnerHands">
              {winnerCardRows.map((row) => (
                <div key={`winner-cards-${row.playerId}`} className="winnerHandRow">
                  <span className="winnerName">{row.name}</span>
                  <div className="cards">
                    {row.cards.map((card, idx) => (
                      <span className={cardClass(card)} key={`${row.playerId}-${idx}-${card.rank}-${card.suit}`}>
                        {renderCard(card)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card tableArena tableMapCard">
        <h2>Table Positions</h2>
        <div className="tableMap">
          <div className="tableCenter">
            <div className="potBadge">Pot {snapshot?.pot ?? 0}</div>
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
          </div>

          {snapshot?.seats.map((seat) => {
            const turnClass = snapshot.currentActorId === seat.playerId ? 'is-turn' : '';
            const meClass = props.playerId === seat.playerId ? 'is-me' : '';
            const winnerClass = winnerFlashIds.includes(seat.playerId) ? 'is-winner' : '';

            return (
              <article
                className={`tableSeat ${seatPositionClass(seat.seatNo)} ${turnClass} ${meClass} ${winnerClass}`.trim()}
                key={seat.playerId}
              >
                <p className="tableSeatName">
                  #{seat.seatNo} {seat.name} {seat.isBot ? '(BOT)' : ''}
                </p>
                <p className="tableSeatMeta">Stack: {seat.stack}</p>
                <p className="tableSeatMeta">Bet: {seat.currentBet}</p>
                {seat.isDealer ? <p className="badge">Dealer</p> : null}
                <div className="cards tableSeatCards">
                  {seat.holeCards?.map((card, idx) => (
                    <span className={cardClass(card)} key={`${seat.playerId}-${idx}-${card.rank}-${card.suit}`}>
                      {renderCard(card)}
                    </span>
                  )) ?? <span className="hiddenTag">Hidden</span>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {me?.holeCards ? (
        <section className="card tableMyHandCard">
          <h2>My Hand</h2>
          <div className="cards">
            {me.holeCards.map((card, idx) => (
              <span className={cardClass(card)} key={`${idx}-${card.rank}-${card.suit}`}>
                {renderCard(card)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {props.role === 'player' ? (
        <section className="card actionsCard tableActionsCard">
          <h2>Actions</h2>
          <p className="muted turnLabel">{isMyTurn ? 'Your turn' : 'Waiting for your turn'}</p>

          <div className="actionInfo">
            <span>To Call: {toCall}</span>
            <span>Min Raise To: {snapshot?.minRaiseTo ?? '-'}</span>
            <span>Stack: {myStack}</span>
          </div>

          <div className="buttonRow">
            {canCall ? (
              <button disabled={!isMyTurn} onClick={() => props.onAction('fold', 0)}>
                Fold
              </button>
            ) : null}
            <button disabled={!isMyTurn} onClick={() => props.onAction(canCheck ? 'check' : 'call', 0)}>
              {canCheck ? 'Check' : 'Call'}
            </button>
          </div>

          {canAggressiveAction ? (
            <>
              <label>
                {aggressiveLabel} To: <strong>{betAmount}</strong>
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
                <button
                  disabled={!isMyTurn}
                  onClick={() => props.onAction(aggressiveActionType, betAmount)}
                >
                  {aggressiveLabel}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">現在のスタックでは{hasExistingBet ? 'レイズ' : 'ベット'}できません。</p>
          )}

          {me && me.stack <= 0 ? <button onClick={props.onRebuy}>Rebuy</button> : null}
        </section>
      ) : (
        <section className="card tableActionsCard">
          <h2>Spectator</h2>
          <p className="muted">観戦モードのためアクションはできません。</p>
        </section>
      )}

      <section className="card tableFooterCard">
        <button onClick={props.onBackToLobby}>Back to Lobby</button>
      </section>
    </main>
  );
}
