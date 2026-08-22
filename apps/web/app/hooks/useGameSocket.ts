"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import {
  getSocket,
  joinGameRoom,
  leaveGameRoom,
  type ContractEvent,
} from "../lib/socket";
import { fetchGame, type GameData } from "../lib/api";

/**
 * Hook that subscribes to a game room via Socket.IO and keeps
 * the game state in sync with the server.
 *
 * @param gameId  The DB game ID to subscribe to
 * @returns       Live game data, loading state, and a manual refetch
 */
export function useGameSocket(gameId: string | null) {
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  // Fetch latest game state from server
  const refetch = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await fetchGame(gameId);
      if (mounted.current) {
        setGame(data.game);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch game");
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [gameId]);

  useEffect(() => {
    mounted.current = true;
    if (!gameId) {
      setLoading(false);
      return;
    }

    // Initial fetch
    refetch();

    // Subscribe to Socket.IO room
    const socket = getSocket();
    joinGameRoom(gameId);

    // When the server's indexer picks up a contract event, refetch game data
    const handleContractEvent = (event: ContractEvent) => {
      console.log("[Socket] contract_event:", event.eventName, event.args);
      // Refetch game state to get the latest from the DB
      refetch();
    };

    socket.on("contract_event", handleContractEvent);

    return () => {
      mounted.current = false;
      socket.off("contract_event", handleContractEvent);
      leaveGameRoom(gameId);
    };
  }, [gameId, refetch]);

  return { game, loading, error, refetch };
}
