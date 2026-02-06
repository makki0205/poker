import type {
  ActionAppliedEvent,
  HandFinishedEvent,
  HandStartedEvent,
  ServerEvent,
  TableSnapshot,
  TableSnapshotEvent,
  TournamentFinishedEvent
} from '@poker/shared';
import {
  createId,
  type ActionType,
  type HandHistoryItem,
  type SeatView,
  type SessionPrincipal
} from '@poker/shared';
import { chooseBotAction } from '../../bot/bot-strategy';
import { HandEngine } from '../../table/service/hand-engine';
import type { HandModel, PlayerModel, TournamentModel } from '../domain/model';
import { InMemoryStore } from '../store/in-memory-store';

interface CreateTournamentInput {
  name: string;
  durationMinutes: 30 | 60 | 90;
  maxSeats: 9;
  startingStack: number;
  botCount: number;
}

export interface EventSink {
  publishToTournament(tournamentId: string, event: ServerEvent): void;
  publishToSession(sessionId: string, event: ServerEvent): void;
}

export class TournamentManager {
  constructor(
    private readonly store: InMemoryStore,
    private readonly handEngine: HandEngine,
    private readonly sink: EventSink
  ) {}

  createTournament(input: CreateTournamentInput): { tournamentId: string; status: string } {
    const tournamentId = createId('trn');
    const createdAt = new Date().toISOString();

    const tournament: TournamentModel = {
      id: tournamentId,
      name: input.name,
      status: 'waiting',
      durationMinutes: input.durationMinutes,
      maxSeats: 9,
      startingStack: input.startingStack,
      blindLevel: 1,
      createdAt,
      dealerSeatNo: 0,
      players: [],
      spectators: [],
      currentHand: null,
      handHistory: [],
      ranking: []
    };

    for (let i = 0; i < input.botCount; i += 1) {
      const seatNo = i + 1;
      const bot: PlayerModel = {
        id: createId('bot'),
        name: `Bot-${i + 1}`,
        seatNo,
        isBot: true,
        stack: input.startingStack,
        status: 'active',
        rebuyCount: 0,
        connected: true
      };
      tournament.players.push(bot);
    }

    this.store.saveTournament(tournament);
    return { tournamentId, status: tournament.status };
  }

  getTournamentSummary(tournamentId: string): {
    id: string;
    status: string;
    durationMinutes: number;
    players: Array<{ id: string; name: string; seatNo: number; isBot: boolean; stack: number }>;
    spectatorCount: number;
  } {
    const tournament = this.requireTournament(tournamentId);
    return {
      id: tournament.id,
      status: tournament.status,
      durationMinutes: tournament.durationMinutes,
      players: tournament.players.map((player) => ({
        id: player.id,
        name: player.name,
        seatNo: player.seatNo,
        isBot: player.isBot,
        stack: player.stack
      })),
      spectatorCount: tournament.spectators.length
    };
  }

  joinPlayer(tournamentId: string, name: string): { playerId: string; sessionId: string; seatNo: number } {
    const tournament = this.requireTournament(tournamentId);
    if (tournament.status !== 'waiting') {
      throw new Error('Tournament already started');
    }

    const reconnect = tournament.players.find(
      (player) => !player.isBot && player.name === name && !player.connected
    );

    let player: PlayerModel;
    if (reconnect) {
      player = reconnect;
      player.connected = true;
      if (player.status === 'disconnected') {
        player.status = player.stack > 0 ? 'active' : 'busted';
      }
    } else {
      if (tournament.players.length >= tournament.maxSeats) {
        throw new Error('TABLE_FULL');
      }
      const seatNo = this.findSeatNo(tournament);
      player = {
        id: createId('pl'),
        name,
        seatNo,
        isBot: false,
        stack: tournament.startingStack,
        status: 'active',
        rebuyCount: 0,
        connected: false
      };
      tournament.players.push(player);
    }

    const sessionId = createId('sess');
    this.store.saveSession({
      sessionId,
      tournamentId,
      role: 'player',
      playerId: player.id
    });
    player.connected = true;

    this.store.saveTournament(tournament);

    return { playerId: player.id, sessionId, seatNo: player.seatNo };
  }

  joinSpectator(tournamentId: string, name: string): { spectatorId: string; sessionId: string } {
    const tournament = this.requireTournament(tournamentId);
    const spectatorId = createId('sp');
    const sessionId = createId('sess');

    tournament.spectators.push({ id: spectatorId, name });
    this.store.saveSession({
      sessionId,
      tournamentId,
      role: 'spectator',
      spectatorId
    });
    this.store.saveTournament(tournament);

    return { spectatorId, sessionId };
  }

  startTournament(tournamentId: string): { status: string; startedAt: string } {
    const tournament = this.requireTournament(tournamentId);
    if (tournament.status !== 'waiting') {
      throw new Error('INVALID_STATE');
    }

    const seated = tournament.players.length;
    if (seated < 2) {
      throw new Error('At least 2 players are required');
    }

    tournament.status = 'running';
    tournament.startedAt = new Date().toISOString();
    this.store.saveTournament(tournament);

    this.startNextHand(tournament);
    return { status: tournament.status, startedAt: tournament.startedAt };
  }

  rebuy(tournamentId: string, playerId: string): { playerId: string; newStack: number; rebuyCount: number } {
    const tournament = this.requireTournament(tournamentId);
    const player = tournament.players.find((item) => item.id === playerId);
    if (!player) {
      throw new Error('NOT_FOUND');
    }

    player.stack += tournament.startingStack;
    player.rebuyCount += 1;
    player.status = 'active';

    this.store.saveTournament(tournament);
    this.broadcastSnapshots(tournament.id);

    return { playerId: player.id, newStack: player.stack, rebuyCount: player.rebuyCount };
  }

  getHands(tournamentId: string, limit: number, cursor?: string): { items: HandHistoryItem[]; nextCursor: string | null } {
    const tournament = this.requireTournament(tournamentId);
    const offset = cursor ? Number(cursor) : 0;
    const safeOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
    const items = tournament.handHistory.slice(safeOffset, safeOffset + limit).map((hand) => ({
      handId: hand.id,
      startedAt: hand.startedAt,
      finishedAt: hand.finishedAt ?? hand.startedAt,
      board: hand.board,
      winners: hand.winners ?? [],
      payouts: hand.payouts ?? []
    }));
    const next = safeOffset + items.length;
    return {
      items,
      nextCursor: next < tournament.handHistory.length ? String(next) : null
    };
  }

  getSessionPrincipal(sessionId: string): SessionPrincipal | undefined {
    return this.store.getSession(sessionId);
  }

  onDisconnect(sessionId: string): void {
    const session = this.store.getSession(sessionId);
    if (!session || session.role !== 'player' || !session.playerId) {
      return;
    }
    const tournament = this.store.getTournament(session.tournamentId);
    if (!tournament) {
      return;
    }
    const player = tournament.players.find((item) => item.id === session.playerId);
    if (!player || player.isBot) {
      return;
    }
    player.connected = false;
    if (player.status === 'active') {
      player.status = 'disconnected';
    }
    this.store.saveTournament(tournament);
  }

  applyPlayerAction(
    tournamentId: string,
    sessionId: string,
    playerId: string,
    action: ActionType,
    amount: number
  ): void {
    const session = this.store.getSession(sessionId);
    if (!session || session.role !== 'player' || session.playerId !== playerId) {
      throw new Error('UNAUTHORIZED');
    }

    const tournament = this.requireTournament(tournamentId);
    if (tournament.status !== 'running' || !tournament.currentHand) {
      throw new Error('INVALID_STATE');
    }

    const handId = tournament.currentHand.id;
    const result = this.handEngine.applyAction(tournament, playerId, action, amount);

    const actionEvent: ActionAppliedEvent = {
      type: 'action.applied',
      payload: {
        handId,
        playerId,
        action,
        amount,
        nextActorId: tournament.currentHand?.currentActorId ?? null
      }
    };
    this.sink.publishToTournament(tournament.id, actionEvent);

    if (result.handFinished) {
      this.finishCurrentHand(tournament);
      return;
    }

    this.store.saveTournament(tournament);
    this.broadcastSnapshots(tournament.id);
    this.playBotsIfNeeded(tournament);
  }

  pushSnapshotToSession(sessionId: string): void {
    const principal = this.store.getSession(sessionId);
    if (!principal) {
      return;
    }
    const tournament = this.store.getTournament(principal.tournamentId);
    if (!tournament) {
      return;
    }
    this.sink.publishToSession(sessionId, this.createSnapshotEvent(tournament, principal));
  }

  private finishCurrentHand(tournament: TournamentModel): void {
    const hand = tournament.currentHand;
    if (!hand) {
      return;
    }

    tournament.handHistory.push(hand);
    tournament.currentHand = null;

    const finishEvent: HandFinishedEvent = {
      type: 'hand.finished',
      payload: {
        handId: hand.id,
        winners: hand.winners ?? [],
        payouts: hand.payouts ?? []
      }
    };
    this.sink.publishToTournament(tournament.id, finishEvent);

    const activePlayers = tournament.players.filter((player) => player.stack > 0);
    if (activePlayers.length <= 1) {
      tournament.status = 'finished';
      tournament.ranking = tournament.players
        .slice()
        .sort((a, b) => b.stack - a.stack)
        .map((player) => player.id);

      const winner = tournament.ranking[0] ?? '';
      const tournamentEvent: TournamentFinishedEvent = {
        type: 'tournament.finished',
        payload: {
          tournamentId: tournament.id,
          winnerPlayerId: winner,
          rankings: tournament.ranking
        }
      };
      this.store.saveTournament(tournament);
      this.sink.publishToTournament(tournament.id, tournamentEvent);
      this.broadcastSnapshots(tournament.id);
      return;
    }

    this.store.saveTournament(tournament);
    this.startNextHand(tournament);
  }

  private startNextHand(tournament: TournamentModel): void {
    const hand = this.handEngine.startHand(tournament);
    this.store.saveTournament(tournament);

    const handStarted: HandStartedEvent = {
      type: 'hand.started',
      payload: {
        handId: hand.id,
        dealerSeat: hand.dealerSeatNo,
        blindLevel: hand.blindLevel
      }
    };
    this.sink.publishToTournament(tournament.id, handStarted);
    this.broadcastSnapshots(tournament.id);

    this.playBotsIfNeeded(tournament);
  }

  private playBotsIfNeeded(tournament: TournamentModel): void {
    let guard = 0;
    while (guard < 200 && tournament.status === 'running' && tournament.currentHand?.currentActorId) {
      guard += 1;
      const actorId = tournament.currentHand.currentActorId;
      const actor = tournament.players.find((player) => player.id === actorId);
      if (!actor || !actor.isBot) {
        break;
      }

      const decision = chooseBotAction(tournament, actor.id);
      const handId = tournament.currentHand.id;
      const result = this.handEngine.applyAction(
        tournament,
        actor.id,
        decision.action,
        decision.amount
      );

      const actionEvent: ActionAppliedEvent = {
        type: 'action.applied',
        payload: {
          handId,
          playerId: actor.id,
          action: decision.action,
          amount: decision.amount,
          nextActorId: tournament.currentHand?.currentActorId ?? null
        }
      };
      this.sink.publishToTournament(tournament.id, actionEvent);

      if (result.handFinished) {
        this.finishCurrentHand(tournament);
        return;
      }

      this.store.saveTournament(tournament);
      this.broadcastSnapshots(tournament.id);
    }
  }

  private broadcastSnapshots(tournamentId: string): void {
    const sessions = this.store.listSessionsByTournament(tournamentId);
    const tournament = this.requireTournament(tournamentId);
    for (const session of sessions) {
      this.sink.publishToSession(session.sessionId, this.createSnapshotEvent(tournament, session));
    }
  }

  private createSnapshotEvent(
    tournament: TournamentModel,
    session: SessionPrincipal
  ): TableSnapshotEvent {
    const hand = tournament.currentHand;

    const seats: SeatView[] = tournament.players
      .slice()
      .sort((a, b) => a.seatNo - b.seatNo)
      .map((player) => {
        const handPlayer = hand?.players.find((p) => p.playerId === player.id);
        const revealAll = hand?.phase === 'showdown';
        const revealMine = session.role === 'player' && session.playerId === player.id;
        const holeCards = handPlayer
          ? revealAll || revealMine
            ? handPlayer.holeCards
            : null
          : null;

        return {
          seatNo: player.seatNo,
          playerId: player.id,
          name: player.name,
          isBot: player.isBot,
          stack: player.stack,
          status: player.status,
          isDealer: hand ? hand.dealerSeatNo === player.seatNo : tournament.dealerSeatNo === player.seatNo,
          currentBet: handPlayer?.contributionRound ?? 0,
          hasFolded: handPlayer?.hasFolded ?? false,
          isAllIn: handPlayer?.isAllIn ?? false,
          holeCards
        };
      });

    const snapshot: TableSnapshot = {
      tournamentId: tournament.id,
      status: tournament.status,
      handId: hand?.id ?? null,
      phase: hand?.phase ?? null,
      pot: hand?.pot ?? 0,
      board: hand?.board ?? [],
      blindLevel: tournament.blindLevel,
      seats,
      currentActorId: hand?.currentActorId ?? null,
      minRaiseTo: hand?.minRaiseTo ?? null,
      lastAction:
        hand && hand.actionHistory.length > 0
          ? {
              playerId: hand.actionHistory[hand.actionHistory.length - 1]?.playerId as string,
              action: hand.actionHistory[hand.actionHistory.length - 1]?.action as ActionType,
              amount: hand.actionHistory[hand.actionHistory.length - 1]?.amount as number
            }
          : undefined
    };

    return {
      type: 'table.snapshot',
      payload: {
        tournamentId: tournament.id,
        status: tournament.status,
        table: snapshot,
        you: {
          playerId: session.playerId,
          role: session.role
        }
      }
    };
  }

  private requireTournament(tournamentId: string): TournamentModel {
    const tournament = this.store.getTournament(tournamentId);
    if (!tournament) {
      throw new Error('NOT_FOUND');
    }
    return tournament;
  }

  private findSeatNo(tournament: TournamentModel): number {
    for (let seat = 1; seat <= tournament.maxSeats; seat += 1) {
      if (!tournament.players.some((player) => player.seatNo === seat)) {
        return seat;
      }
    }
    throw new Error('TABLE_FULL');
  }
}
