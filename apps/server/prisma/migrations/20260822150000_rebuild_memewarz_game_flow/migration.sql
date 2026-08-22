-- Rebuild MemeWarz persistence around the Figma game flow.
-- This intentionally replaces the earlier Host/Game/Player/Meme draft schema.

DROP TABLE IF EXISTS "_GameToPlayer" CASCADE;
DROP TABLE IF EXISTS "Vote" CASCADE;
DROP TABLE IF EXISTS "Meme" CASCADE;
DROP TABLE IF EXISTS "Round" CASCADE;
DROP TABLE IF EXISTS "GameParticipant" CASCADE;
DROP TABLE IF EXISTS "Game" CASCADE;
DROP TABLE IF EXISTS "Host" CASCADE;
DROP TABLE IF EXISTS "Player" CASCADE;

DROP TYPE IF EXISTS "PlayerType" CASCADE;
DROP TYPE IF EXISTS "ParticipantRole" CASCADE;
DROP TYPE IF EXISTS "GameStatus" CASCADE;
DROP TYPE IF EXISTS "RoundStatus" CASCADE;
DROP TYPE IF EXISTS "MemeStatus" CASCADE;

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('host', 'contestant', 'voter');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('waiting', 'matchmaking', 'generating', 'voting', 'finished');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('pending', 'generating', 'voting', 'finished');

-- CreateEnum
CREATE TYPE "MemeStatus" AS ENUM ('creating', 'ready', 'locked');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "walletBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "prompt" TEXT,
    "status" "GameStatus" NOT NULL DEFAULT 'waiting',
    "entryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "prizePool" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "roundDurationMs" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL DEFAULT 10,
    "hostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'voter',
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'pending',
    "prompt" TEXT,
    "votingEndsAt" TIMESTAMP(3),
    "winnerMemeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meme" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "caption" TEXT,
    "status" "MemeStatus" NOT NULL DEFAULT 'creating',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "memeId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_walletAddress_key" ON "Player"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Game_roomCode_key" ON "Game"("roomCode");

-- CreateIndex
CREATE INDEX "Game_hostId_idx" ON "Game"("hostId");

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE INDEX "GameParticipant_playerId_idx" ON "GameParticipant"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_gameId_playerId_key" ON "GameParticipant"("gameId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_winnerMemeId_key" ON "Round"("winnerMemeId");

-- CreateIndex
CREATE INDEX "Round_gameId_status_idx" ON "Round"("gameId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Round_gameId_roundNumber_key" ON "Round"("gameId", "roundNumber");

-- CreateIndex
CREATE INDEX "Meme_playerId_idx" ON "Meme"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Meme_roundId_participantId_key" ON "Meme"("roundId", "participantId");

-- CreateIndex
CREATE INDEX "Vote_memeId_idx" ON "Vote"("memeId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_roundId_voterId_key" ON "Vote"("roundId", "voterId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_winnerMemeId_fkey" FOREIGN KEY ("winnerMemeId") REFERENCES "Meme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meme" ADD CONSTRAINT "Meme_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meme" ADD CONSTRAINT "Meme_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meme" ADD CONSTRAINT "Meme_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_memeId_fkey" FOREIGN KEY ("memeId") REFERENCES "Meme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
