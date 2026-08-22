import { io, type Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
  "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function joinGameRoom(gameId: string) {
  const s = getSocket();
  s.emit("join_game", gameId);
}

export function leaveGameRoom(gameId: string) {
  const s = getSocket();
  s.emit("leave_game", gameId);
}

// ── Event types ───────────────────────────────────────────────────────

export type ContractEvent = {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: string;
  txHash: string;
};
