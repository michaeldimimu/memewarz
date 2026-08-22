"use client";

import { LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import CaptionSubmission from "../../components/caption-submission";
import MemeGenerating from "../../components/meme-generating";
import Voting from "../../components/voting";
import { useGameSocket } from "../../hooks/useGameSocket";
import {
  fetchGameByCode,
  type GameData,
  type RoundData,
  type MemeData,
  type ParticipantData,
} from "../../lib/api";
import { memeWarzContract } from "../../config/contract";

// ── Helper types ─────────────────────────────────────────────────────

type GamePhase =
  | "loading"
  | "waiting"
  | "captionSubmission"
  | "memeGenerating"
  | "voting"
  | "winner";

// ── Small reusable components ────────────────────────────────────────

const PlayerCard = ({ name }: { name: string }) => (
  <div className="flex bg-neutral-light-200 rounded-xl border-neutral-dark-100 p-2 items-center pr-4">
    <div className="bg-linear-to-br from-[#F8810C] to-[#BB1529] rounded-xl w-8 h-8" />
    <p className="ml-2 font-bold text-xl">{name}</p>
  </div>
);

const Winner = ({
  winnerName,
  winnerMeme,
  voteCount,
  onReset,
}: {
  winnerName: string;
  winnerMeme: MemeData | null;
  voteCount: number;
  onReset: () => void;
}) => (
  <>
    <p className="font-bold text-4xl mb-4 text-center text-neutral-dark-200">
      Winner!
    </p>
    <PlayerCard name={winnerName} />
    {winnerMeme?.imageUrl && (
      <Image
        src={winnerMeme.imageUrl}
        alt="Winning meme"
        height={500}
        width={500}
        className="h-120 w-120 rounded-xl mt-2"
      />
    )}
    {winnerMeme?.caption && (
      <p className="font-semibold text-lg mt-2 text-center text-neutral-dark-100 italic">
        &ldquo;{winnerMeme.caption}&rdquo;
      </p>
    )}
    <p className="font-bold text-2xl mt-4 text-center text-neutral-dark-200">
      {voteCount} Votes
    </p>
    <button
      type="button"
      onClick={onReset}
      className="font-bold w-fit mt-2 mx-auto bg-neutral-dark-200 px-4 py-3 rounded-xl text-neutral-light-100"
    >
      Back to start
    </button>
  </>
);

// ── Main page component ──────────────────────────────────────────────

const RoomPage = () => {
  const params = useParams();
  const roomCodeOrId = params.id as string;
  const { address } = useAccount();

  // First fetch by room code to get the DB game ID
  const [gameId, setGameId] = useState<string | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);

  useEffect(() => {
    fetchGameByCode(roomCodeOrId)
      .then((data) => setGameId(data.game.id))
      .catch((err) => {
        console.error("Failed to find room:", err);
        setInitialError(err instanceof Error ? err.message : "Room not found");
      });
  }, [roomCodeOrId]);

  // Subscribe to live game updates via Socket.IO
  const { game, loading, error, refetch } = useGameSocket(gameId);

  // ── Smart contract: startGame ─────────────────────────────────────
  const {
    writeContract: writeStartGame,
    data: startTxHash,
    isPending: isStartPending,
  } = useWriteContract();
  const { isLoading: isStartConfirming } = useWaitForTransactionReceipt({
    hash: startTxHash,
  });

  const handleStartGame = useCallback(() => {
    if (!game) return;

    // We need the on-chain game ID. The server stores roomCode as a string.
    // The contract maps gameCode → gameId. We call startGame with the on-chain gameId.
    // For simplicity, try to read the on-chain game ID from codeToGameId mapping
    // or use the numeric roomCode if the game was created on-chain.
    const onChainGameId = Number(game.roomCode);
    if (isNaN(onChainGameId) || onChainGameId <= 0) {
      console.error("Cannot determine on-chain game ID");
      return;
    }

    writeStartGame({
      ...memeWarzContract,
      functionName: "startGame",
      args: [BigInt(onChainGameId)],
      // Entropy fee might be needed — send a small amount
      value: BigInt(0),
    });
  }, [game, writeStartGame]);

  // Refetch when start tx confirms
  useEffect(() => {
    if (startTxHash) {
      const timer = setTimeout(refetch, 3000);
      return () => clearTimeout(timer);
    }
  }, [startTxHash, refetch]);

  // ── Determine game phase ──────────────────────────────────────────
  const currentRound = useMemo<RoundData | null>(() => {
    if (!game?.rounds?.length) return null;
    return game.rounds[game.rounds.length - 1] ?? null;
  }, [game]);

  const myParticipant = useMemo<ParticipantData | null>(() => {
    if (!game || !address) return null;
    return (
      game.participants.find(
        (p) => p.player.walletAddress.toLowerCase() === address.toLowerCase()
      ) ?? null
    );
  }, [game, address]);

  const isHost = useMemo(() => {
    if (!game || !address) return false;
    return game.host.walletAddress.toLowerCase() === address.toLowerCase();
  }, [game, address]);

  const isContestant = myParticipant?.role === "contestant";

  const gamePhase = useMemo<GamePhase>(() => {
    if (loading || !game) return "loading";
    switch (game.status) {
      case "waiting":
      case "matchmaking":
        return "waiting";
      case "generating":
        // If I'm a contestant, show caption submission
        // If I'm a voter/observer, show meme generating screen
        if (isContestant) return "captionSubmission";
        return "memeGenerating";
      case "voting":
        return "voting";
      case "finished":
        return "winner";
      default:
        return "waiting";
    }
  }, [game, loading, isContestant]);

  // ── Get contestants from current round ────────────────────────────
  const contestants = useMemo(() => {
    if (!game) return [];
    return game.participants.filter((p) => p.role === "contestant");
  }, [game]);

  const contestantMemes = useMemo<MemeData[]>(() => {
    if (!currentRound) return [];
    return currentRound.memes;
  }, [currentRound]);

  // ── Winner data ───────────────────────────────────────────────────
  const winnerData = useMemo(() => {
    if (!currentRound || !currentRound.winnerMeme) {
      return { name: "Draw!", meme: null, votes: 0 };
    }
    const winnerMeme = currentRound.winnerMeme;
    const winnerPlayer = contestantMemes.find(
      (m) => m.id === winnerMeme.id
    )?.player;
    return {
      name: winnerPlayer?.name || "Unknown",
      meme: winnerMeme,
      votes: winnerMeme.votes?.length ?? 0,
    };
  }, [currentRound, contestantMemes]);

  // ── Render ─────────────────────────────────────────────────────────

  if (initialError) {
    return (
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-500 mb-4">Room Not Found</h1>
        <p className="text-lg text-neutral-dark-100">{initialError}</p>
      </div>
    );
  }

  if (gamePhase === "loading") {
    return (
      <div className="flex flex-col items-center gap-4">
        <LoaderCircle className="animate-spin text-neutral-dark-200" size={48} />
        <p className="text-lg text-neutral-dark-100">Loading game…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <p className="text-red-500">{error}</p>
        <button
          onClick={refetch}
          className="font-bold mt-4 bg-neutral-dark-200 px-4 py-2 rounded-xl text-neutral-light-100"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {gamePhase === "waiting" && game && (
        <div className="text-center">
          <h1 className="text-4xl tracking-tight font-bold leading-[100%] mb-8">
            Waiting for Players
          </h1>

          <p className="mb-4 text-xl">Room code:</p>
          <p className="font-black text-7xl text-neutral-dark-200 tracking-[0.2em]">
            {game.roomCode}
          </p>
          <p className="font-bold text-xl mt-4">
            Winner Gets{" "}
            <span className="text-neutral-dark-200">
              {Number(game.prizePool)} MON
            </span>
          </p>

          <div className="flex gap-4 mt-8">
            <div className="flex gap-2 flex-wrap">
              {game.participants.map((p) => (
                <PlayerCard key={p.id} name={p.player.name} />
              ))}
            </div>
          </div>

          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={
                isStartPending ||
                isStartConfirming ||
                game.participants.length < 3
              }
              className="bg-linear-to-r from-[#A3FC59] to-[#6DE668] border border-[#6DE668] rounded-xl flex items-center text-neutral-dark-200 gap-2 font-bold text-lg px-4 py-2 mx-auto mt-8 justify-center disabled:opacity-50"
            >
              {isStartPending
                ? "Confirm in wallet…"
                : isStartConfirming
                  ? "Starting…"
                  : game.participants.length < 3
                    ? `Need ${3 - game.participants.length} more player(s)`
                    : "Start game"}
            </button>
          )}

          {!isHost && (
            <p className="text-neutral-dark-100 mt-8 text-lg">
              Waiting for host to start the game…
            </p>
          )}
        </div>
      )}

      {gamePhase === "captionSubmission" && game && currentRound && (
        <CaptionSubmission
          playerName={myParticipant?.player.name || "Player"}
          gameId={game.roomCode}
          roundId={currentRound.id}
          playerId={myParticipant?.playerId || ""}
          memeTemplateImageUri={
            contestantMemes.find(
              (m) => m.playerId === myParticipant?.playerId
            )?.imageUrl || "/memes/3.jpg"
          }
          onSubmitSuccess={refetch}
        />
      )}

      {gamePhase === "memeGenerating" && (
        <MemeGenerating
          players={contestants.map((c) => ({
            name: c.player.name,
            hasSubmitted:
              contestantMemes.find((m) => m.playerId === c.playerId)?.status ===
              "ready",
          }))}
        />
      )}

      {gamePhase === "voting" && game && currentRound && (
        <Voting
          game={game}
          round={currentRound}
          currentUserAddress={address || ""}
          onVotingEnd={refetch}
        />
      )}

      {gamePhase === "winner" && (
        <Winner
          winnerName={winnerData.name}
          winnerMeme={winnerData.meme}
          voteCount={winnerData.votes}
          onReset={() => {
            if (typeof window !== "undefined") {
              window.location.href = "/";
            }
          }}
        />
      )}
    </>
  );
};

export default RoomPage;
