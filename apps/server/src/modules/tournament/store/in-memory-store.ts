import type { SessionModel, TournamentModel } from '../domain/model';

export class InMemoryStore {
  private tournaments = new Map<string, TournamentModel>();
  private sessions = new Map<string, SessionModel>();

  saveTournament(tournament: TournamentModel): void {
    this.tournaments.set(tournament.id, tournament);
  }

  getTournament(tournamentId: string): TournamentModel | undefined {
    return this.tournaments.get(tournamentId);
  }

  listTournaments(): TournamentModel[] {
    return [...this.tournaments.values()];
  }

  saveSession(session: SessionModel): void {
    this.sessions.set(session.sessionId, session);
  }

  getSession(sessionId: string): SessionModel | undefined {
    return this.sessions.get(sessionId);
  }

  listSessionsByTournament(tournamentId: string): SessionModel[] {
    return [...this.sessions.values()].filter((session) => session.tournamentId === tournamentId);
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
