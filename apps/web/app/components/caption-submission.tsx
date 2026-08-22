"use client";

import Image from "next/image";
import { useState } from "react";

const CaptionSubmission = ({
  playerName,
  onSubmit,
}: {
  playerName: string;
  onSubmit: (caption: string) => void;
}) => {
  const [caption, setCaption] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim()) return;
    setIsSubmitted(true);
    onSubmit(caption);
  };

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
      <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden mb-6">
        <Image
          src="/memes/3.jpg"
          alt="Meme to caption"
          width={500}
          height={375}
          className="w-full h-full object-cover"
        />
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
          disabled={isSubmitted}
          placeholder="Type your caption here..."
          rows={4}
          className="w-full rounded-2xl border border-gray-300 bg-neutral-light-200 px-4 py-3 text-lg outline-none resize-none placeholder:text-neutral-dark-100/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isSubmitted || !caption.trim()}
          className="font-bold mt-3 w-full bg-neutral-dark-200 px-4 py-4 rounded-2xl text-neutral-light-100 text-lg disabled:opacity-50 transition-opacity"
        >
          {isSubmitted ? "Locked in! ✓" : "Lock it in!"}
        </button>
      </form>
    </div>
  );
};

export default CaptionSubmission;
