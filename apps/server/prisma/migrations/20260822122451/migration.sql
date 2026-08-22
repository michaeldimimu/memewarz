-- AlterTable
ALTER TABLE "Host" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "Host_id_seq";

-- AlterTable
ALTER TABLE "Player" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "Player_id_seq";
