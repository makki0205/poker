import type { ActionType, Card, HandPhase } from '@poker/shared';
import { createId } from '@poker/shared';
import { getBlindAtMinute } from '../domain/blind-structure';
import { createDeck, deal, shuffleDeck } from '../domain/deck';
import { compareHandRank, evaluateBestHand } from '../domain/evaluator';
import type {
  HandModel,
  HandPlayerState,
  PlayerModel,
  TournamentModel
} from '../../tournament/domain/model';

export interface AppliedActionResult {
  handFinished: boolean;
  winners: string[];
  payouts: Array<{ playerId: string; amount: number }>;
}

export class HandEngine {
  startHand(tournament: TournamentModel, now = new Date()): HandModel {
    const activePlayers = tournament.players
      .filter((player) => player.stack > 0)
      .sort((a, b) => a.seatNo - b.seatNo);

    if (activePlayers.length < 2) {
      throw new Error('Not enough players to start hand');
    }

    const level = this.getCurrentBlindLevel(tournament, now);
    tournament.blindLevel = level.level;

    const dealer = this.getNextDealer(activePlayers, tournament.dealerSeatNo);
    tournament.dealerSeatNo = dealer.seatNo;

    const deck = shuffleDeck(createDeck());
    const handPlayers: HandPlayerState[] = activePlayers.map((player) => ({
      playerId: player.id,
      seatNo: player.seatNo,
      holeCards: deal(deck, 2),
      contributionTotal: 0,
      contributionRound: 0,
      hasFolded: false,
      isAllIn: false,
      acted: false
    }));

    const hand: HandModel = {
      id: createId('h'),
      startedAt: now.toISOString(),
      dealerSeatNo: dealer.seatNo,
      blindLevel: level.level,
      phase: 'preflop',
      board: [],
      pot: 0,
      currentBet: 0,
      minRaiseTo: level.bb * 2,
      currentActorId: null,
      deck,
      players: handPlayers,
      actionHistory: []
    };

    for (const hp of hand.players) {
      const player = this.getTournamentPlayer(tournament, hp.playerId);
      const paid = this.takeChips(player, level.ante);
      hp.contributionTotal += paid;
      hand.pot += paid;
      if (player.stack === 0) {
        hp.isAllIn = true;
        player.status = 'allin';
      }
    }

    const sb = this.getNextFromSeat(hand.players, dealer.seatNo);
    const bb = this.getNextFromSeat(hand.players, sb.seatNo);

    const sbPlayer = this.getTournamentPlayer(tournament, sb.playerId);
    const sbPaid = this.takeChips(sbPlayer, level.sb);
    sb.contributionRound += sbPaid;
    sb.contributionTotal += sbPaid;
    hand.pot += sbPaid;
    if (sbPlayer.stack === 0) {
      sb.isAllIn = true;
      sbPlayer.status = 'allin';
    }

    const bbPlayer = this.getTournamentPlayer(tournament, bb.playerId);
    const bbPaid = this.takeChips(bbPlayer, level.bb);
    bb.contributionRound += bbPaid;
    bb.contributionTotal += bbPaid;
    hand.pot += bbPaid;
    if (bbPlayer.stack === 0) {
      bb.isAllIn = true;
      bbPlayer.status = 'allin';
    }

    hand.currentBet = Math.max(sb.contributionRound, bb.contributionRound);
    hand.minRaiseTo = Math.max(hand.currentBet + level.bb, level.bb * 2);

    hand.currentActorId = this.findNextActor(
      hand,
      tournament,
      this.getNextFromSeat(hand.players, bb.seatNo).seatNo
    );

    tournament.currentHand = hand;
    return hand;
  }

  applyAction(
    tournament: TournamentModel,
    playerId: string,
    action: ActionType,
    amount: number,
    now = new Date()
  ): AppliedActionResult {
    const hand = tournament.currentHand;
    if (!hand) {
      throw new Error('No active hand');
    }

    if (hand.currentActorId !== playerId) {
      throw new Error('Not your turn');
    }

    const hp = this.getHandPlayer(hand, playerId);
    const player = this.getTournamentPlayer(tournament, playerId);

    if (hp.hasFolded || hp.isAllIn) {
      throw new Error('Player can no longer act');
    }

    const toCall = Math.max(0, hand.currentBet - hp.contributionRound);
    let added = 0;

    switch (action) {
      case 'fold': {
        hp.hasFolded = true;
        hp.acted = true;
        player.status = 'folded';
        break;
      }
      case 'check': {
        if (toCall !== 0) {
          throw new Error('Cannot check when facing a bet');
        }
        hp.acted = true;
        break;
      }
      case 'call': {
        if (toCall === 0) {
          throw new Error('Nothing to call');
        }
        added = this.takeChips(player, toCall);
        hp.contributionRound += added;
        hp.contributionTotal += added;
        hand.pot += added;
        hp.acted = true;
        if (player.stack === 0) {
          hp.isAllIn = true;
          player.status = 'allin';
        }
        break;
      }
      case 'bet': {
        if (hand.currentBet !== 0) {
          throw new Error('Bet is not allowed when there is an active bet');
        }
        if (amount <= 0) {
          throw new Error('Bet amount must be positive');
        }
        added = this.takeChips(player, amount);
        if (added <= 0) {
          throw new Error('No chips available');
        }
        hp.contributionRound += added;
        hp.contributionTotal += added;
        hand.pot += added;
        const previousBet = hand.currentBet;
        if (hp.contributionRound > previousBet) {
          hand.currentBet = hp.contributionRound;
          const raiseSize = hand.currentBet - previousBet;
          hand.minRaiseTo = hand.currentBet + raiseSize;
          this.markOthersUnacted(hand, playerId);
        }
        hp.acted = true;
        if (player.stack === 0) {
          hp.isAllIn = true;
          player.status = 'allin';
        }
        break;
      }
      case 'raise': {
        if (hand.currentBet === 0) {
          throw new Error('Raise requires a current bet');
        }
        if (amount < hand.minRaiseTo) {
          throw new Error('Raise amount below minimum');
        }
        const diff = amount - hp.contributionRound;
        if (diff <= 0) {
          throw new Error('Raise amount is invalid');
        }
        added = this.takeChips(player, diff);
        hp.contributionRound += added;
        hp.contributionTotal += added;
        hand.pot += added;
        if (hp.contributionRound > hand.currentBet) {
          const previousBet = hand.currentBet;
          hand.currentBet = hp.contributionRound;
          const raiseSize = hand.currentBet - previousBet;
          hand.minRaiseTo = hand.currentBet + raiseSize;
          this.markOthersUnacted(hand, playerId);
        }
        hp.acted = true;
        if (player.stack === 0) {
          hp.isAllIn = true;
          player.status = 'allin';
        }
        break;
      }
      case 'allin': {
        if (player.stack <= 0) {
          throw new Error('No chips available');
        }
        added = this.takeChips(player, player.stack);
        hp.contributionRound += added;
        hp.contributionTotal += added;
        hand.pot += added;

        if (hp.contributionRound > hand.currentBet) {
          const previousBet = hand.currentBet;
          hand.currentBet = hp.contributionRound;
          const raiseSize = hand.currentBet - previousBet;
          if (raiseSize > 0) {
            hand.minRaiseTo = hand.currentBet + raiseSize;
            this.markOthersUnacted(hand, playerId);
          }
        }

        hp.acted = true;
        hp.isAllIn = true;
        player.status = 'allin';
        break;
      }
      default:
        throw new Error('Unknown action');
    }

    hand.actionHistory.push({
      playerId,
      action,
      amount: added,
      phase: hand.phase,
      at: now.toISOString()
    });

    const alive = hand.players.filter((p) => !p.hasFolded);
    if (alive.length === 1) {
      const winner = alive[0] as HandPlayerState;
      const winnerPlayer = this.getTournamentPlayer(tournament, winner.playerId);
      winnerPlayer.stack += hand.pot;
      hand.finishedAt = now.toISOString();
      hand.winners = [winner.playerId];
      hand.payouts = [{ playerId: winner.playerId, amount: hand.pot }];
      hand.phase = 'showdown';
      hand.currentActorId = null;
      this.refreshPlayerStatusesAfterHand(tournament, hand);
      return { handFinished: true, winners: hand.winners, payouts: hand.payouts };
    }

    if (this.isBettingRoundComplete(hand, tournament)) {
      this.advancePhase(hand, tournament);
      if (hand.phase === 'showdown') {
        const result = this.resolveShowdown(hand, tournament, now);
        this.refreshPlayerStatusesAfterHand(tournament, hand);
        return { handFinished: true, winners: result.winners, payouts: result.payouts };
      }
    }

    if (hand.phase !== 'showdown') {
      const currentSeat = this.getHandPlayer(hand, playerId).seatNo;
      hand.currentActorId = this.findNextActor(hand, tournament, this.nextSeatAfter(hand, currentSeat));
      if (!hand.currentActorId) {
        const result = this.resolveShowdown(hand, tournament, now);
        this.refreshPlayerStatusesAfterHand(tournament, hand);
        return { handFinished: true, winners: result.winners, payouts: result.payouts };
      }
    }

    return { handFinished: false, winners: [], payouts: [] };
  }

  private refreshPlayerStatusesAfterHand(tournament: TournamentModel, hand: HandModel): void {
    for (const player of tournament.players) {
      if (player.stack <= 0) {
        player.status = 'busted';
      } else if (player.status !== 'disconnected') {
        player.status = 'active';
      }
    }

    hand.players.forEach((hp) => {
      const player = this.getTournamentPlayer(tournament, hp.playerId);
      if (player.stack <= 0) {
        player.status = 'busted';
      }
    });
  }

  private resolveShowdown(
    hand: HandModel,
    tournament: TournamentModel,
    now: Date
  ): { winners: string[]; payouts: Array<{ playerId: string; amount: number }> } {
    while (hand.board.length < 5) {
      hand.board.push(...deal(hand.deck, 1));
    }

    const levels = [...new Set(hand.players.map((p) => p.contributionTotal).filter((v) => v > 0))].sort(
      (a, b) => a - b
    );

    const payoutMap = new Map<string, number>();
    let previous = 0;

    for (const level of levels) {
      const contributors = hand.players.filter((p) => p.contributionTotal >= level);
      const potPart = (level - previous) * contributors.length;
      previous = level;
      if (potPart <= 0) {
        continue;
      }

      const eligible = contributors.filter((p) => !p.hasFolded);
      if (eligible.length === 0) {
        continue;
      }

      let best: HandPlayerState[] = [];
      let bestRank: ReturnType<typeof evaluateBestHand> | null = null;

      for (const contender of eligible) {
        const rank = evaluateBestHand([...contender.holeCards, ...hand.board]);
        if (!bestRank || compareHandRank(rank, bestRank) > 0) {
          bestRank = rank;
          best = [contender];
        } else if (compareHandRank(rank, bestRank) === 0) {
          best.push(contender);
        }
      }

      const sortedWinners = best.sort((a, b) => a.seatNo - b.seatNo);
      const share = Math.floor(potPart / sortedWinners.length);
      let remainder = potPart % sortedWinners.length;

      for (const winner of sortedWinners) {
        const bonus = remainder > 0 ? 1 : 0;
        remainder = Math.max(0, remainder - 1);
        const current = payoutMap.get(winner.playerId) ?? 0;
        payoutMap.set(winner.playerId, current + share + bonus);
      }
    }

    const payouts = [...payoutMap.entries()].map(([playerId, amount]) => ({ playerId, amount }));
    for (const payout of payouts) {
      const player = this.getTournamentPlayer(tournament, payout.playerId);
      player.stack += payout.amount;
    }

    hand.finishedAt = now.toISOString();
    hand.phase = 'showdown';
    hand.currentActorId = null;
    hand.payouts = payouts;
    hand.winners = payouts
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .map((p) => p.playerId);

    return { winners: hand.winners, payouts };
  }

  private advancePhase(hand: HandModel, tournament: TournamentModel): void {
    for (const hp of hand.players) {
      hp.contributionRound = 0;
      hp.acted = hp.isAllIn || hp.hasFolded;
    }
    hand.currentBet = 0;

    if (hand.phase === 'preflop') {
      hand.phase = 'flop';
      hand.board.push(...deal(hand.deck, 3));
    } else if (hand.phase === 'flop') {
      hand.phase = 'turn';
      hand.board.push(...deal(hand.deck, 1));
    } else if (hand.phase === 'turn') {
      hand.phase = 'river';
      hand.board.push(...deal(hand.deck, 1));
    } else if (hand.phase === 'river') {
      hand.phase = 'showdown';
      return;
    }

    const actor = this.findNextActor(
      hand,
      tournament,
      this.nextSeatAfter(hand, hand.dealerSeatNo)
    );
    hand.currentActorId = actor;
    hand.minRaiseTo = hand.currentBet + this.getCurrentBlindLevel(tournament, new Date()).bb;
  }

  private isBettingRoundComplete(hand: HandModel, tournament: TournamentModel): boolean {
    const actionable = hand.players.filter((hp) => {
      if (hp.hasFolded || hp.isAllIn) {
        return false;
      }
      const player = this.getTournamentPlayer(tournament, hp.playerId);
      return player.stack > 0;
    });

    if (actionable.length === 0) {
      return true;
    }

    return actionable.every((hp) => hp.acted && hp.contributionRound === hand.currentBet);
  }

  private markOthersUnacted(hand: HandModel, actorId: string): void {
    for (const hp of hand.players) {
      if (hp.playerId !== actorId && !hp.hasFolded && !hp.isAllIn) {
        hp.acted = false;
      }
    }
  }

  private nextSeatAfter(hand: HandModel, seatNo: number): number {
    const seats = hand.players.map((p) => p.seatNo).sort((a, b) => a - b);
    const next = seats.find((seat) => seat > seatNo);
    return next ?? (seats[0] as number);
  }

  private findNextActor(
    hand: HandModel,
    tournament: TournamentModel,
    startSeatNo: number
  ): string | null {
    const orderedSeats = hand.players.map((p) => p.seatNo).sort((a, b) => a - b);
    const startIndex = orderedSeats.findIndex((seat) => seat === startSeatNo);
    if (startIndex < 0) {
      return null;
    }

    for (let offset = 0; offset < orderedSeats.length; offset += 1) {
      const seat = orderedSeats[(startIndex + offset) % orderedSeats.length] as number;
      const hp = hand.players.find((p) => p.seatNo === seat);
      if (!hp || hp.hasFolded || hp.isAllIn) {
        continue;
      }
      const player = this.getTournamentPlayer(tournament, hp.playerId);
      if (player.stack <= 0) {
        continue;
      }
      return hp.playerId;
    }
    return null;
  }

  private getNextDealer(players: PlayerModel[], previousDealerSeatNo: number): PlayerModel {
    const sorted = players.sort((a, b) => a.seatNo - b.seatNo);
    const next = sorted.find((player) => player.seatNo > previousDealerSeatNo);
    return next ?? (sorted[0] as PlayerModel);
  }

  private getCurrentBlindLevel(tournament: TournamentModel, now: Date) {
    const startedAt = tournament.startedAt ? new Date(tournament.startedAt).getTime() : now.getTime();
    const elapsedMs = Math.max(0, now.getTime() - startedAt);
    const elapsedMin = Math.floor(elapsedMs / 60000);
    return getBlindAtMinute(tournament.durationMinutes, elapsedMin);
  }

  private getTournamentPlayer(tournament: TournamentModel, playerId: string): PlayerModel {
    const player = tournament.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }
    return player;
  }

  private getHandPlayer(hand: HandModel, playerId: string): HandPlayerState {
    const hp = hand.players.find((p) => p.playerId === playerId);
    if (!hp) {
      throw new Error(`Hand player not found: ${playerId}`);
    }
    return hp;
  }

  private getNextFromSeat(players: HandPlayerState[], seatNo: number): HandPlayerState {
    const sorted = [...players].sort((a, b) => a.seatNo - b.seatNo);
    const next = sorted.find((p) => p.seatNo > seatNo);
    return next ?? (sorted[0] as HandPlayerState);
  }

  private takeChips(player: PlayerModel, amount: number): number {
    const paid = Math.min(player.stack, Math.max(0, amount));
    player.stack -= paid;
    return paid;
  }
}
