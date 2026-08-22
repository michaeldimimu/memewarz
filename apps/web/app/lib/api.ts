const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as Record<string, string>).error || `Request failed: ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}

// ── Game / Room endpoints ─────────────────────────────────────────────

export type GameData = {
  id: string;
  roomName: string;
  roomCode: string;
  prompt: string | null;
  status: "waiting" | "matchmaking" | "generating" | "voting" | "finished";
  entryFee: number;
  prizePool: number;
  roundDurationMs: number;
  maxPlayers: number;
  hostId: string;
  host: PlayerData;
  participants: ParticipantData[];
  rounds: RoundData[];
};

export type PlayerData = {
  id: string;
  name: string;
  walletAddress: string;
};

export type ParticipantData = {
  id: string;
  gameId: string;
  playerId: string;
  role: "host" | "contestant" | "voter";
  isReady: boolean;
  player: PlayerData;
  memes: MemeData[];
};

export type RoundData = {
  id: string;
  gameId: string;
  roundNumber: number;
  status: "pending" | "generating" | "voting" | "finished";
  prompt: string | null;
  votingEndsAt: string | null;
  winnerMemeId: string | null;
  memes: MemeData[];
  votes: VoteData[];
  winnerMeme: MemeData | null;
};

export type MemeData = {
  id: string;
  roundId: string;
  participantId: string;
  playerId: string;
  imageUrl: string | null;
  caption: string | null;
  status: "creating" | "ready" | "locked";
  player: PlayerData;
  votes: VoteData[];
};

export type VoteData = {
  id: string;
  roundId: string;
  memeId: string;
  voterId: string;
};

export type TemplateData = {
  id: number;
  imageURI: string;
};

// ── API functions ─────────────────────────────────────────────────────

export function listGames() {
  return request<{ games: GameData[] }>("/rooms");
}

export function fetchGame(gameId: string) {
  return request<{ game: GameData }>(`/rooms/${gameId}`);
}

export function fetchGameByCode(roomCode: string) {
  return request<{ game: GameData }>(`/rooms/code/${roomCode}`);
}

export function joinGameAPI(
  roomCode: string,
  payload: { name: string; walletAddress: string; role?: "contestant" | "voter" }
) {
  return request<{ game: GameData }>(`/rooms/${roomCode}/join`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function setReadyAPI(gameId: string, playerId: string, isReady: boolean) {
  return request<{ game: GameData }>(`/rooms/${gameId}/ready`, {
    method: "PATCH",
    body: JSON.stringify({ playerId, isReady }),
  });
}

export function startRoundAPI(
  gameId: string,
  contestantIds: string[],
  prompt?: string
) {
  return request<{ round: RoundData }>(`/rooms/${gameId}/rounds`, {
    method: "POST",
    body: JSON.stringify({ contestantIds, prompt }),
  });
}

export function submitMemeAPI(
  roundId: string,
  payload: { playerId: string; imageUrl: string; caption?: string }
) {
  return request<{ meme: MemeData }>(`/rooms/rounds/${roundId}/memes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function castVoteAPI(
  roundId: string,
  payload: { voterId: string; memeId: string }
) {
  return request<{ vote: VoteData }>(`/rooms/rounds/${roundId}/votes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function finishRoundAPI(roundId: string) {
  return request<{ game: GameData }>(`/rooms/rounds/${roundId}/finish`, {
    method: "POST",
  });
}

export function renderMeme(payload: {
  templateId?: number;
  templateUri?: string;
  topText?: string;
  bottomText?: string;
  caption?: string;
}) {
  return request<{
    templateId: number;
    imageUri: string;
    caption: string;
    status: string;
  }>("/memes/render", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchTemplates() {
  return request<{ templates: TemplateData[] }>("/templates");
}
