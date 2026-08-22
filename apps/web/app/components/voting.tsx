"use client";

import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { memeWarzContract } from "../config/contract";
import { castVoteAPI, type GameData, type RoundData } from "../lib/api";

const Voting = ({
  game,
  round,
  currentUserAddress,
  onVotingEnd,
}: {
  game: GameData;
  round: RoundData;
  currentUserAddress: string;
  onVotingEnd: () => void;
}) => {
  const [hasVotedLocally, setHasVotedLocally] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending: isSigning } = useWriteContract();
  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const memes = round.memes || [];
  const comp0Meme = memes[0];
  const comp1Meme = memes[1];

  const comp0Player = comp0Meme?.player;
  const comp1Player = comp1Meme?.player;

  const votes0 = comp0Meme?.votes?.length ?? 0;
  const votes1 = comp1Meme?.votes?.length ?? 0;
  const totalVotes = votes0 + votes1;

  // Calculate percentage bar
  const leftPercent =
    totalVotes === 0 ? 50 : Math.round((votes0 / totalVotes) * 100);
  const rightPercent = 100 - leftPercent;

  // Countdown timer calculation
  useEffect(() => {
    const durationSeconds = Math.floor((game.roundDurationMs || 60000) / 1000);
    setTimeLeft(durationSeconds);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onVotingEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [game.roundDurationMs, onVotingEnd]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Sync with server API after on-chain vote receipt
  useEffect(() => {
    if (receipt && receipt.status === "success" && selectedCompetitor) {
      setHasVotedLocally(true);
      const targetMeme = memes.find(
        (m) => m.player?.walletAddress.toLowerCase() === selectedCompetitor.toLowerCase()
      );
      const currentParticipant = game.participants.find(
        (p) => p.player.walletAddress.toLowerCase() === currentUserAddress.toLowerCase()
      );

      if (targetMeme && currentParticipant) {
        castVoteAPI(round.id, {
          voterId: currentParticipant.playerId,
          memeId: targetMeme.id,
        }).catch((err) => console.warn("Server vote sync failed:", err));
      }
    }
  }, [receipt, selectedCompetitor, memes, game.participants, currentUserAddress, round.id]);

  const handleVote = (competitorWallet: string) => {
    if (hasVotedLocally || isSigning || isConfirming) return;
    setError(null);
    setSelectedCompetitor(competitorWallet);

    const numericGameId = Number(game.roomCode);
    if (!isNaN(numericGameId) && numericGameId > 0) {
      writeContract({
        ...memeWarzContract,
        functionName: "vote",
        args: [BigInt(numericGameId), competitorWallet as `0x${string}`],
      });
    } else {
      // Fallback off-chain vote if numeric game ID isn't available
      const targetMeme = memes.find(
        (m) => m.player?.walletAddress.toLowerCase() === competitorWallet.toLowerCase()
      );
      const currentParticipant = game.participants.find(
        (p) => p.player.walletAddress.toLowerCase() === currentUserAddress.toLowerCase()
      );
      if (targetMeme && currentParticipant) {
        castVoteAPI(round.id, {
          voterId: currentParticipant.playerId,
          memeId: targetMeme.id,
        })
          .then(() => setHasVotedLocally(true))
          .catch((err) => setError(err instanceof Error ? err.message : "Vote failed"));
      }
    }
  };

  const isLoading = isSigning || isConfirming;

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto px-4">
      {/* Heading */}
      <h1 className="text-2xl font-black text-center text-neutral-dark-200 leading-tight mb-6">
        {hasVotedLocally ? "Vote recorded! Watch live results:" : "Tap a meme to cast your vote!"}
      </h1>

      {/* Meme cards */}
      <div className="flex flex-col gap-6 w-full mb-6">
        {[comp0Meme, comp1Meme].map((meme, index) => {
          if (!meme) return null;
          const player = meme.player;
          const isThisCompetitor =
            player?.walletAddress.toLowerCase() === selectedCompetitor?.toLowerCase();

          return (
            <button
              key={meme.id || index}
              type="button"
              disabled={hasVotedLocally || isLoading}
              onClick={() => handleVote(player?.walletAddress || "")}
              className={`w-full text-left transition-transform active:scale-[0.98] rounded-2xl p-2 border-2 ${
                isThisCompetitor ? "border-green-500 bg-green-50/50" : "border-transparent"
              }`}
            >
              {/* Player header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-neutral-dark-200 rounded-xl w-10 h-10 shrink-0" />
                <p className="font-bold text-lg text-neutral-dark-200">
                  {player?.name || `Player ${index + 1}`}
                </p>
              </div>

              {/* Meme image & caption */}
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden relative">
                <Image
                  src={meme.imageUrl || `/memes/${index === 0 ? "1" : "5"}.jpg`}
                  alt={`${player?.name || "Player"}'s meme`}
                  width={500}
                  height={375}
                  className="w-full h-full object-cover pointer-events-none"
                />
                {meme.caption && (
                  <div className="absolute bottom-2 left-2 right-2 bg-black/75 text-white font-black text-center p-2 rounded-xl text-lg uppercase tracking-wide">
                    {meme.caption}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

      {isLoading && (
        <p className="text-neutral-dark-100 text-sm text-center mb-4 font-bold">
          {isSigning ? "Confirming in wallet…" : "Casting vote on-chain…"}
        </p>
      )}

      {/* Scoreboard */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <p className="font-black text-3xl text-neutral-dark-200">{votes0}</p>
          <p className="font-bold text-lg text-neutral-dark-100 font-mono">
            {formatTime(timeLeft)}
          </p>
          <p className="font-black text-3xl text-neutral-dark-200">{votes1}</p>
        </div>
        <div className="flex rounded-xl w-full overflow-hidden">
          <div
            className="bg-neutral-dark-200 h-8 transition-all duration-300 rounded-l-xl"
            style={{ width: `${leftPercent}%` }}
          />
          <div
            className="bg-neutral-light-200 h-8 transition-all duration-300 rounded-r-xl"
            style={{ width: `${rightPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default Voting;
