interface ApiError {
  code?: string;
  message?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(err.message ?? 'Request failed');
  }

  return (await res.json()) as T;
}

export function createTournament(input: {
  name: string;
  durationMinutes: 30 | 60 | 90;
  maxSeats: 9;
  startingStack: number;
  botCount: number;
}) {
  return request<{ tournamentId: string; status: string }>('/api/v1/tournaments', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function getTournament(tournamentId: string) {
  return request<{
    id: string;
    status: string;
    durationMinutes: number;
    players: Array<{ id: string; name: string; seatNo: number; isBot: boolean; stack: number }>;
    spectatorCount: number;
  }>(`/api/v1/tournaments/${tournamentId}`);
}

export function joinTournament(tournamentId: string, name: string) {
  return request<{ playerId: string; sessionId: string; seatNo: number }>(
    `/api/v1/tournaments/${tournamentId}/join`,
    {
      method: 'POST',
      body: JSON.stringify({ name })
    }
  );
}

export function joinAsSpectator(tournamentId: string, name: string) {
  return request<{ spectatorId: string; sessionId: string }>(
    `/api/v1/tournaments/${tournamentId}/spectators`,
    {
      method: 'POST',
      body: JSON.stringify({ name })
    }
  );
}

export function startTournament(tournamentId: string) {
  return request<{ status: string; startedAt: string }>(`/api/v1/tournaments/${tournamentId}/start`, {
    method: 'POST'
  });
}

export function rebuy(tournamentId: string, playerId: string) {
  return request<{ playerId: string; newStack: number; rebuyCount: number }>(
    `/api/v1/tournaments/${tournamentId}/rebuys`,
    {
      method: 'POST',
      body: JSON.stringify({ playerId })
    }
  );
}
