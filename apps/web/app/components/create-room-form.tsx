"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, decodeEventLog } from "viem";
import { useRouter } from "next/navigation";
import { memeWarzContract, MEME_WARZ_ABI } from "../config/contract";

const RoomCreationForm = ({
  setIsShowingRoomCreationForm,
}: {
  setIsShowingRoomCreationForm: (show: boolean) => void;
}) => {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { writeContract, data: txHash, isPending: isSigning } = useWriteContract();
  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [roomName, setRoomName] = useState("");
  const [timeLimit, setTimeLimit] = useState("60");
  const [prizePool, setPrizePool] = useState("0.01");
  const [error, setError] = useState<string | null>(null);

  // Parse game code from tx receipt logs
  if (receipt && receipt.status === "success") {
    try {
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: MEME_WARZ_ABI,
            data: log.data,
            topics: log.topics,
          }) as unknown as { eventName: string; args: { gameCode: number } };
          if (decoded.eventName === "GameCreated" && decoded.args.gameCode) {
            const code = String(decoded.args.gameCode);
            router.push(`/rooms/${code}`);
          }
        } catch {
          // Not the event we're looking for
        }
      }
    } catch {
      // ignore
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isConnected || !address) {
      setError("Please connect your wallet first");
      return;
    }

    const seconds = Number(timeLimit);
    if (isNaN(seconds) || seconds < 30) {
      setError("Time limit must be at least 30 seconds");
      return;
    }

    const prizeValue = Number(prizePool);
    if (isNaN(prizeValue) || prizeValue <= 0) {
      setError("Prize pool must be greater than 0");
      return;
    }

    writeContract({
      ...memeWarzContract,
      functionName: "createGame",
      args: [roomName || "MemeWarz Room", BigInt(seconds), BigInt(0)],
      value: parseEther(prizePool),
    });
  };

  const isLoading = isSigning || isConfirming;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 max-w-75 sm:max-w-sm rounded-xl shadow-md"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsShowingRoomCreationForm(false)}
            className="font-bold bg-neutral-light-200 size-8 grid place-content-center rounded-xl text-neutral-dark-200"
          >
            <X />
          </button>
        </div>
        <h2 className="text-2xl font-bold leading-[100%] mb-8">Create Room</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="room-name" className="font-medium mb-2">
              Room name:
            </label>
            <input
              type="text"
              id="room-name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="MemeWarz Room"
              className="w-full rounded-xl border border-gray-300 bg-neutral-light-200 px-4 py-2 text-center outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <div>
            <label htmlFor="time-limit" className="font-medium mb-2">
              Voting duration (seconds):
            </label>
            <input
              type="number"
              id="time-limit"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
              min={30}
              className="w-full rounded-xl border border-gray-300 bg-neutral-light-200 px-4 py-2 text-center outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <div>
            <label htmlFor="prize-pool" className="font-medium mb-2">
              Prize pool (MON):
            </label>
            <input
              type="text"
              id="prize-pool"
              value={prizePool}
              onChange={(e) => setPrizePool(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-neutral-light-200 px-4 py-2 text-center outline-none placeholder:text-muted-foreground/50"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          {txHash && !receipt && (
            <p className="text-sm text-center text-neutral-dark-100">
              Confirming transaction…
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="font-bold mt-2 w-full bg-neutral-dark-200 px-4 py-3 rounded-xl text-neutral-light-100 disabled:opacity-50"
          >
            {isSigning
              ? "Confirm in wallet…"
              : isConfirming
                ? "Confirming…"
                : "Create Room"}
          </button>
        </div>
      </form>
    </div>
  );
};

const CreateRoomForm = () => {
  const [isShowingRoomCreationForm, setIsShowingRoomCreationForm] =
    useState(false);
  return (
    <>
      <p className="text-center text-lg text-neutral-dark-200 mt-4">
        <button
          onClick={() => setIsShowingRoomCreationForm(true)}
          className="font-bold underline text-neutral-dark-200"
        >
          Create my own room
        </button>{" "}
        instead
      </p>

      {isShowingRoomCreationForm && (
        <RoomCreationForm
          setIsShowingRoomCreationForm={setIsShowingRoomCreationForm}
        />
      )}
    </>
  );
};

export default CreateRoomForm;
