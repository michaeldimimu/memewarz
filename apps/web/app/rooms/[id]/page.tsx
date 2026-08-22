"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import CaptionSubmission from "../../components/caption-submission";
import MemeGenerating from "../../components/meme-generating";
import Voting from "../../components/voting";

type GamePhase =
  | "waiting"
  | "captionSubmission"
  | "memeGenerating"
  | "voting"
  | "winner";

const PHASES: GamePhase[] = [
  "waiting",
  "captionSubmission",
  "memeGenerating",
  "voting",
  "winner",
];

const PlayerCard = ({ name }: { name: string }) => {
  return (
    <div className="flex bg-neutral-light-200 rounded-xl border-neutral-dark-100 p-2 items-center pr-4">
      <div className="bg-linear-to-br from-[#F8810C] to-[#BB1529] rounded-xl w-8 h-8" />
      <p className="ml-2 font-bold text-xl">{name}</p>
    </div>
  );
};

const Winner = ({ onReset }: { onReset: () => void }) => {
  return (
    <>
      <p className="font-bold text-4xl mb-4 text-center text-neutral-dark-200">
        Winner!
      </p>
      <PlayerCard name="Alice" />
      <Image
        src="/memes/1.jpg"
        alt="Meme"
        height={500}
        width={500}
        className="h-120 w-120 rounded-xl mt-2"
      />
      <p className="font-bold text-2xl mt-4 text-center text-neutral-dark-200">
        54 Votes
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
};

const Versus = () => {
  return (
    <>
      <div className="flex gap-16">
        <div className="flex flex-col gap-2">
          <PlayerCard name="Alice" />
          <Image
            src="/memes/1.jpg"
            alt="Meme"
            height={500}
            width={500}
            className="h-96 w-96 rounded-xl"
          />
          <div className="flex items-center gap-2">
            <LoaderCircle className="animate-spin" />
            <p>Waiting for caption</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <PlayerCard name="Charlie" />
          <Image
            src="/memes/1.jpg"
            alt="Meme"
            height={500}
            width={500}
            className="h-96 w-96 rounded-xl"
          />
          <div className="flex items-center gap-2">
            <LoaderCircle className="animate-spin" />
            <p>Waiting for caption</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <p className="font-black text-3xl text-neutral-dark-200">54</p>
          <p className="font-bold text-lg">00:40</p>
          <p className="font-black text-3xl text-neutral-dark-200">40</p>
        </div>
        <div className="flex rounded-xl w-full">
          <div className="bg-linear-to-r from-[#A3FC59] to-[#6DE668] h-8 rounded-l-xl w-1/2" />
          <div className="bg-linear-to-r from-[#F8810C] to-[#BB1529] h-8 rounded-r-xl w-1/2" />
        </div>
      </div>
    </>
  );
};

const RoomPage = () => {
  const [gamePhase, setGamePhase] = useState<GamePhase>("waiting");

  const nextPhase = () => {
    const currentIndex = PHASES.indexOf(gamePhase);
    const nextIndex = (currentIndex + 1) % PHASES.length;
    const nextPhaseValue = PHASES[nextIndex];
    if (nextPhaseValue) {
      setGamePhase(nextPhaseValue);
    }
  };

  const resetToWaiting = () => {
    setGamePhase("waiting");
  };

  return (
    <>
      {/* Dev controls */}
      <button
        onClick={nextPhase}
        className="fixed top-4 right-4 z-50 bg-neutral-dark-200 text-neutral-light-100 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
      >
        Next Phase <ArrowRight size={14} />
      </button>

      {gamePhase === "waiting" && (
        <div className="text-center">
          <h1 className="text-4xl tracking-tight font-bold leading-[100%] mb-8">
            Waiting for Players
          </h1>

          <p className="mb-4 text-xl">Room code:</p>
          <p className="font-black text-7xl text-neutral-dark-200 tracking-[0.2em]">
            883927
          </p>
          <p className="font-bold text-xl mt-4">
            Winner Gets <span className="text-neutral-dark-200">50 MON</span>
          </p>

          <div className="flex gap-4 mt-8">
            <div className="flex gap-2 flex-wrap">
              <PlayerCard name="Alice" />
              <PlayerCard name="Bob" />
              <PlayerCard name="Charlie" />
            </div>
          </div>

          <button
            onClick={nextPhase}
            className="bg-linear-to-r from-[#A3FC59] to-[#6DE668] border border-[#6DE668] rounded-xl flex items-center text-neutral-dark-200 gap-2 font-bold text-lg px-4 py-2 mx-auto mt-8 justify-center"
          >
            Start game
          </button>
        </div>
      )}

      {gamePhase === "captionSubmission" && (
        <CaptionSubmission
          playerName="Superphoenix"
          onSubmit={(caption) => {
            console.log("Caption submitted:", caption);
          }}
        />
      )}

      {gamePhase === "memeGenerating" && (
        <MemeGenerating
          players={[{ name: "Superphoenix" }, { name: "Amazingbear" }]}
        />
      )}

      {gamePhase === "voting" && (
        <Voting
          players={[
            { name: "Superphoenix", memeImage: "/memes/5.jpg" },
            { name: "Amazingbear", memeImage: "/memes/10.jpg" },
          ]}
          onVotingEnd={(votes) => {
            console.log("Final votes:", votes);
          }}
        />
      )}

      {gamePhase === "winner" && <Winner onReset={resetToWaiting} />}
    </>
  );
};

export default RoomPage;
