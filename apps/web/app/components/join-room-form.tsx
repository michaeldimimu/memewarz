"use client";

import { ArrowRight, X } from "lucide-react";
import { useState } from "react";

const PlayerDetailsForm = ({
  setIsShowingPlayerDetailsPopup,
}: {
  setIsShowingPlayerDetailsPopup: (show: boolean) => void;
}) => {
  const [playerName, setPlayerName] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(playerName);
  };
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
              onClick={() => setIsShowingPlayerDetailsPopup(false)}
              className="font-bold bg-neutral-light-200 size-8 grid place-content-center rounded-xl text-neutral-dark-200"
            >
              <X />
            </button>
          </div>
          <h2 className="text-2xl text-center font-bold leading-[100%]">
            Join Room - Monad Blitz Hackathon
          </h2>
          <div className="bg-linear-to-br from-[#F8810C] to-[#BB1529] size-32 mx-auto mb-4 rounded-xl" />
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
              className="w-full rounded-xl border border-gray-300 bg-neutral-light-200 px-4 py-2 text-center outline-none placeholder:text-muted-foreground/50"
            />
            <button
              type="submit"
              className="font-bold mt-2 w-full bg-neutral-dark-200 px-4 py-3 rounded-xl text-neutral-light-100"
            >
              Enter
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const JoinRoomForm = () => {
  const [roomCode, setRoomCode] = useState("");
  const [isShowingPlayerDetailsPopup, setIsShowingPlayerDetailsPopup] =
    useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsShowingPlayerDetailsPopup(true);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          name="room-code"
          id="room-code"
          value={roomCode}
          // 1. Strip non-digits and limit to 6 characters in state
          onChange={(e) => {
            const onlyNumbers = e.target.value.replace(/\D/g, "");
            if (onlyNumbers.length <= 6) {
              setRoomCode(onlyNumbers);
            }
          }}
          // 2. HTML constraints for better UX
          maxLength={6}
          inputMode="numeric"
          pattern="\d*"
          placeholder="e.g. 127399"
          className="w-full rounded-xl border border-gray-300 bg-neutral-light-200 text-neutral-dark-200 px-4 py-4 text-center text-3xl font-black tracking-[0.2em] outline-none placeholder:text-muted-foreground/50"
        />
        <button className="bg-linear-to-r from-[#A3FC59] to-[#6DE668] rounded-xl flex items-center text-neutral-dark-200 gap-2 font-bold text-lg px-4 py-4 justify-center">
          <span>Join Room</span>
          <ArrowRight />
        </button>
      </form>

      {isShowingPlayerDetailsPopup && (
        <PlayerDetailsForm
          setIsShowingPlayerDetailsPopup={setIsShowingPlayerDetailsPopup}
        />
      )}
    </>
  );
};

export default JoinRoomForm;
