-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TESTER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "EvalStatus" AS ENUM ('IN_PROCESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('NONE', 'GRANTED', 'REFUSED');

-- CreateEnum
CREATE TYPE "ProcedureKey" AS ENUM ('WEIGHING', 'ECCENTRICITY', 'REPEATABILITY', 'TARE', 'DISCRIMINATION', 'SENSITIVITY', 'ZERO_RETURN', 'CREEP', 'STABILITY', 'TILT', 'WARMUP', 'VOLTAGE', 'TEMP_NOLOAD', 'DAMP_HEAT', 'SPAN_STABILITY', 'ENDURANCE', 'EMC', 'CONSTRUCTION', 'CHECKLIST');

-- CreateEnum
CREATE TYPE "ProcedureStatus" AS ENUM ('EMPTY', 'ENTERED_NOT_MARKED', 'MARKED_PASS', 'MARKED_FAIL', 'CANNOT_COMPUTE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "maxG" TEXT NOT NULL,
    "eG" TEXT NOT NULL,
    "n" INTEGER,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "status" "EvalStatus" NOT NULL DEFAULT 'IN_PROCESS',
    "packId" TEXT NOT NULL,
    "tempC" TEXT,
    "rhPct" TEXT,
    "observer" TEXT,
    "reviewDecision" "ReviewDecision" NOT NULL DEFAULT 'NONE',
    "reviewNote" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reportPdfPath" TEXT,
    "reportDocxPath" TEXT,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "key" "ProcedureKey" NOT NULL,
    "status" "ProcedureStatus" NOT NULL DEFAULT 'EMPTY',
    "payloadJson" JSONB NOT NULL,
    "resultJson" JSONB,
    "markedByPack" TEXT,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
