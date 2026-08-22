"use client";

import { X } from "lucide-react";
import { useState } from "react";

const RoomCreationForm = ({
  setIsShowingRoomCreationForm,
}: {
  setIsShowingRoomCreationForm: (show: boolean) => void;
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Room created!");
  };
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
              className="w-full rounded-xl border border-gray-300 bg-neutral-light-200 px-4 py-2 text-center outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <div>
            <label htmlFor="time-limit" className="font-medium mb-2">
              Time limit (seconds):
            </label>
            <input
              type="text"
              id="time-limit"
              className="w-full rounded-xl border border-gray-300 bg-neutral-light-200 px-4 py-2 text-center outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <div>
            <label htmlFor="prize-pool" className="font-medium mb-2">
              Prize pool(MON):
            </label>
            <input
              type="text"
              id="prize-pool"
              className="w-full rounded-xl border border-gray-300 bg-neutral-light-200 px-4 py-2 text-center outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <button
            type="submit"
            className="font-bold mt-2 w-full bg-neutral-dark-200 px-4 py-3 rounded-xl text-neutral-light-100"
          >
            Create Room
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
