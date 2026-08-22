"use client";

import Image from "next/image";
import { useState } from "react";

const Voting = ({
  players,
  onVotingEnd,
}: {
  players: { name: string; memeImage: string }[];
  onVotingEnd: (votes: number[]) => void;
}) => {
  const [votes, setVotes] = useState<number[]>(players.map(() => 0));
  const timeDisplay = "00:59";

  const totalVotes = votes.reduce((sum, v) => sum + v, 0);

  const handleTap = (index: number) => {
    const newVotes = [...votes];
    if (newVotes[index] == null) return;
    newVotes[index]++;
    setVotes(newVotes);
  };

  // Calculate bar widths
  const leftPercent =
    totalVotes === 0 ? 50 : Math.round(((votes[0] ?? 0) / totalVotes) * 100);
  const rightPercent = 100 - leftPercent;

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto px-4">
      {/* Heading */}
      <h1 className="text-2xl font-black text-center text-neutral-dark-200 leading-tight mb-6">
        Tap as many times as you can on a meme to vote!
      </h1>

      {/* Meme cards */}
      <div className="flex flex-col gap-6 w-full mb-6">
        {players.map((player, index) => (
          <button
            key={player.name}
            type="button"
            onClick={() => handleTap(index)}
            className="w-full text-left transition-transform active:scale-[0.98]"
          >
            {/* Player header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-neutral-dark-200 rounded-xl w-10 h-10 shrink-0" />
              <p className="font-bold text-lg text-neutral-dark-200">
                {player.name}
              </p>
            </div>

            {/* Meme image */}
            <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src={player.memeImage}
                alt={`${player.name}'s meme`}
                width={500}
                height={375}
                className="w-full h-full object-cover pointer-events-none"
              />
            </div>
          </button>
        ))}
      </div>

      {/* Scoreboard */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <p className="font-black text-3xl text-neutral-dark-200">
            {votes[0] ?? 0}
          </p>
          <p className="font-bold text-lg text-neutral-dark-100">
            {timeDisplay}
          </p>
          <p className="font-black text-3xl text-neutral-dark-200">
            {votes[1] ?? 0}
          </p>
        </div>
        <div className="flex rounded-xl w-full overflow-hidden">
          <div
            className="bg-neutral-dark-200 h-8 transition-all duration-200 rounded-l-xl"
            style={{ width: `${leftPercent}%` }}
          />
          <div
            className="bg-neutral-light-200 h-8 transition-all duration-200 rounded-r-xl"
            style={{ width: `${rightPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default Voting;
