"use client";

import { useState } from "react";

const PlayerCard = ({ name }: { name: string }) => {
  return (
    <div className="flex bg-neutral-light-200 rounded-xl border-neutral-dark-100 p-2 items-center pr-4">
      <div className="bg-linear-to-br from-[#F8810C] to-[#BB1529] rounded-xl w-8 h-8" />
      <p className="ml-2 font-bold text-xl">{name}</p>
    </div>
  );
};

const Versus = () => {
  return (
    <div className="flex flex-col items-center gap-16">
      <PlayerCard name="Alice" />
      <p className="text-4xl font-bold text-neutral-dark-200">vs</p>
      <PlayerCard name="Bob" />
    </div>
  );
};

const RoomPage = () => {
  const [competitorsChosen, setCompetitorsChosen] = useState(false);
  const displayChosenCompetitors = () => {
    // mimic loading with settimeout for now
    setCompetitorsChosen(true);
    setTimeout(() => {
      setCompetitorsChosen(false);
    }, 1000);
  };
  return (
    <>
      {competitorsChosen ? (
        <Versus />
      ) : (
        <div className="text-center">
          <h1 className="text-4xl tracking-tight font-bold leading-[100%] mb-8">
            Waiting for Players
          </h1>

          <p className="mb-4 text-xl">Room code:</p>
          <p className="font-black text-7xl text-neutral-dark-200 tracking-[0.2em]">
            883927
          </p>
          <p
            className="font-bold text-xl mt-4
      "
          >
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
            onClick={displayChosenCompetitors}
            className="bg-linear-to-r from-[#A3FC59] to-[#6DE668] border border-[#6DE668] rounded-xl flex items-center text-neutral-dark-200 gap-2 font-bold text-lg px-4 py-2 mx-auto mt-8 justify-center"
          >
            Start game
          </button>
        </div>
      )}
    </>
  );
};

export default RoomPage;
