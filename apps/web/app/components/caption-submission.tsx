"use client";

import Image from "next/image";
import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { memeWarzContract } from "../config/contract";
import { submitMemeAPI } from "../lib/api";

const CaptionSubmission = ({
  playerName,
  gameId,
  roundId,
  playerId,
  memeTemplateImageUri,
  onSubmitSuccess,
}: {
  playerName: string;
  gameId: string;
  roundId: string;
  playerId: string;
  memeTemplateImageUri: string;
  onSubmitSuccess: () => void;
}) => {
  const [caption, setCaption] = useState("");
  const [isSubmittingServer, setIsSubmittingServer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending: isSigning } = useWriteContract();
  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // When transaction confirms on-chain, update the server
  if (receipt && receipt.status === "success" && !isSubmittingServer) {
    setIsSubmittingServer(true);
    submitMemeAPI(roundId, {
      playerId,
      imageUrl: memeTemplateImageUri,
      caption,
    })
      .then(() => {
        onSubmitSuccess();
      })
      .catch((err) => {
        console.warn("Server meme submission error:", err);
        onSubmitSuccess();
      });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim()) return;
    setError(null);

    const numericGameId = Number(gameId);
    if (!isNaN(numericGameId) && numericGameId > 0) {
      writeContract({
        ...memeWarzContract,
        functionName: "submitMeme",
        args: [BigInt(numericGameId), caption.trim()],
      });
    } else {
      // Fallback to server submit if no numeric on-chain ID
      setIsSubmittingServer(true);
      submitMemeAPI(roundId, {
        playerId,
        imageUrl: memeTemplateImageUri,
        caption: caption.trim(),
      })
        .then(() => onSubmitSuccess())
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to submit");
          setIsSubmittingServer(false);
        });
    }
  };

  const isLoading = isSigning || isConfirming || isSubmittingServer;

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto px-4">
      {/* Player header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-neutral-dark-200 rounded-xl w-10 h-10 shrink-0" />
        <p className="font-bold text-lg text-neutral-dark-200">{playerName}</p>
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-black text-center text-neutral-dark-200 leading-tight mb-6">
        You have been selected to compete!
      </h1>

      {/* Meme image */}
      <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden mb-6 relative">
        <Image
          src={memeTemplateImageUri || "/memes/3.jpg"}
          alt="Meme to caption"
          width={500}
          height={375}
          className="w-full h-full object-cover"
        />
        {caption && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white font-black text-center p-2 rounded-xl text-lg uppercase tracking-wide">
            {caption}
          </div>
        )}
      </div>

      {/* Instruction */}
      <p className="text-center text-lg font-semibold text-neutral-dark-200 leading-snug mb-4">
        Write the funniest caption you can think of for this image (funniest
        caption wins)
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={isLoading}
          placeholder="Type your caption here..."
          rows={4}
          maxLength={280}
          className="w-full rounded-2xl border border-gray-300 bg-neutral-light-200 px-4 py-3 text-lg outline-none resize-none placeholder:text-neutral-dark-100/40 disabled:opacity-50"
        />

        {error && (
          <p className="text-red-500 text-sm text-center mt-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading || !caption.trim()}
          className="font-bold mt-3 w-full bg-neutral-dark-200 px-4 py-4 rounded-2xl text-neutral-light-100 text-lg disabled:opacity-50 transition-opacity"
        >
          {isSigning
            ? "Confirm in wallet…"
            : isConfirming
              ? "Confirming on-chain…"
              : isSubmittingServer
                ? "Locked in! ✓"
                : "Lock it in!"}
        </button>
      </form>
    </div>
  );
};

export default CaptionSubmission;
