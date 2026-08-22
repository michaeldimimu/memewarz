"use client";

import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useRouter } from "next/navigation";
import { fetchGameByCode, joinGameAPI, type GameData } from "../lib/api";
import { memeWarzContract } from "../config/contract";

const PlayerDetailsForm = ({
  game,
  onClose,
}: {
  game: GameData;
  onClose: () => void;
}) => {
  const router = useRouter();
  const { address } = useAccount();
  const [playerName, setPlayerName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending: isSigning } = useWriteContract();
  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Once the on-chain tx is confirmed, register the player name on the server
  if (receipt && receipt.status === "success" && !isJoining) {
    setIsJoining(true);
    const walletAddr = address || "";
    joinGameAPI(game.roomCode, {
      name: playerName || walletAddr.slice(0, 6),
      walletAddress: walletAddr,
      role: "voter",
    })
      .then(() => {
        router.push(`/rooms/${game.roomCode}`);
      })
      .catch((err) => {
        // The server's indexer may have already registered us — navigate anyway
        console.warn("Server join failed (may already be indexed):", err);
        router.push(`/rooms/${game.roomCode}`);
      });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!address) {
      setError("Please connect your wallet first");
      return;
    }

    const entryFee = BigInt(
      Math.round(Number(game.entryFee) * 1e18)
    );

    // Call the smart contract joinGame
    writeContract({
      ...memeWarzContract,
      functionName: "joinGame",
      args: [Number(game.roomCode)],
      value: entryFee,
    });
  };

  const isLoading = isSigning || isConfirming || isJoining;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 max-w-75 sm:max-w-sm rounded-xl shadow-md"
      >
        <div className="flex flex-col gap-8">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="font-bold bg-neutral-light-200 size-8 grid place-content-center rounded-xl text-neutral-dark-200"
            >
              <X />
            </button>
          </div>
          <h2 className="text-2xl text-center font-bold leading-[100%]">
            Join Room — {game.roomName}
          </h2>

          <div className="flex flex-col items-center gap-2">
            <div className="bg-linear-to-br from-[#F8810C] to-[#BB1529] size-32 mx-auto mb-2 rounded-xl" />
            <p className="text-sm text-neutral-dark-100">
              {game.participants.length}/{game.maxPlayers} players •{" "}
              <span className="font-bold text-neutral-dark-200">
                {Number(game.prizePool)} MON
              </span>{" "}
              prize pool
            </p>
          </div>

          <div>
            <label
              htmlFor="player-name"
              className="font-medium block text-center mb-2"
            >
              Player name:
            </label>
            <input
              type="text"
              id="player-name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your display name"
              className="w-full rounded-xl border border-gray-300 bg-neutral-light-200 px-4 py-2 text-center outline-none placeholder:text-muted-foreground/50"
            />

            {error && (
              <p className="text-red-500 text-sm text-center mt-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="font-bold mt-2 w-full bg-neutral-dark-200 px-4 py-3 rounded-xl text-neutral-light-100 disabled:opacity-50"
            >
              {isSigning
                ? "Confirm in wallet…"
                : isConfirming
                  ? "Confirming tx…"
                  : isJoining
                    ? "Joining…"
                    : "Enter"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const JoinRoomForm = () => {
  const [roomCode, setRoomCode] = useState("");
  const [game, setGame] = useState<GameData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await fetchGameByCode(roomCode);
      setGame(data.game);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Room not found"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          name="room-code"
          id="room-code"
          value={roomCode}
          onChange={(e) => {
            const onlyNumbers = e.target.value.replace(/\D/g, "");
            if (onlyNumbers.length <= 6) {
              setRoomCode(onlyNumbers);
            }
          }}
          maxLength={6}
          inputMode="numeric"
          pattern="\d*"
          placeholder="e.g. 127399"
          required
          className="w-full rounded-xl border border-gray-300 bg-neutral-light-200 text-neutral-dark-200 px-4 py-4 text-center text-3xl font-black tracking-[0.2em] outline-none placeholder:text-muted-foreground/50"
        />
        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}
        <button
          disabled={isLoading}
          className="bg-linear-to-r from-[#A3FC59] to-[#6DE668] border border-[#6DE668] rounded-xl flex items-center text-neutral-dark-200 gap-2 font-bold text-lg px-4 py-4 justify-center"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <>
              <span>Join Room</span>
              <ArrowRight />
            </>
          )}
        </button>
      </form>

      {game && (
        <PlayerDetailsForm game={game} onClose={() => setGame(null)} />
      )}
    </>
  );
};

export default JoinRoomForm;
