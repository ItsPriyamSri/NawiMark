-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_evaluationId_fkey";

-- DropForeignKey
ALTER TABLE "Procedure" DROP CONSTRAINT "Procedure_evaluationId_fkey";

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
