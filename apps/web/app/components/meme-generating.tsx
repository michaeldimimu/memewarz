"use client";

import { LoaderCircle } from "lucide-react";

const MemeGenerating = ({
  players,
}: {
  players: { name: string }[];
}) => {
  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto px-4 gap-8">
      {players.map((player) => (
        <div key={player.name} className="w-full">
          {/* Player header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-neutral-dark-200 rounded-xl w-10 h-10 shrink-0" />
            <p className="font-bold text-xl text-neutral-dark-200">
              {player.name}
            </p>
          </div>

          {/* Loading card */}
          <div className="w-full aspect-square rounded-2xl bg-neutral-light-200 flex flex-col items-center justify-center gap-4">
            <p className="text-xl font-semibold text-neutral-dark-100">
              Creating meme...
            </p>
            <LoaderCircle
              className="animate-spin text-neutral-dark-200"
              size={40}
              strokeWidth={2.5}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default MemeGenerating;
