import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PACK_ID, PACK_MARKS } from "@/engine/pack";
import { buildShowWorking, MPE_USED_LINE } from "@/lib/reports/explainer";
import { AttachmentForm } from "./attachments";
import { ResultMarks } from "./band-toggle";
import { ReviewForm } from "./review-form";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const evaluation = await db.evaluation.findUnique({
    where: { id },
    include: { instrument: true, procedures: true, attachments: true },
  });
  if (!evaluation) notFound();

  const isReviewer = session?.user.role === "REVIEWER";
  const isOwnerTester =
    session?.user.role === "TESTER" && session.user.id === evaluation.instrument.createdById;
  if (!isOwnerTester && !isReviewer) redirect("/dashboard");

  const marks = evaluation.procedures.filter((p) => (PACK_MARKS as readonly string[]).includes(p.key));
  const failedMarks = marks.filter((p) => p.status === "MARKED_FAIL");
  const canGrant = PACK_MARKS.every((k) => marks.find((p) => p.key === k)?.status === "MARKED_PASS");
  const showWorking = buildShowWorking(evaluation.procedures);
  const cannotCompute = marks.some((p) => p.status === "CANNOT_COMPUTE");
  const decided = evaluation.reviewDecision !== "NONE";

  return (
    <div className="flex flex-col gap-4">
      <header className="page-head">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>
              {evaluation.instrument.manufacturer} {evaluation.instrument.model}
            </h1>
            <p>
              Class {evaluation.instrument.class} · Max {evaluation.instrument.maxG} g · e {evaluation.instrument.eG} g
              · n={evaluation.instrument.n ?? "?"}
            </p>
          </div>
          {isOwnerTester && !decided ? (
            <Link href={`/evaluations/${evaluation.id}/observations`} className="text-sm underline underline-offset-4">
              Edit observations
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{PACK_ID}</Badge>
          <span>{MPE_USED_LINE}</span>
          <Badge>{evaluation.status}</Badge>
          <Badge
            variant={
              evaluation.reviewDecision === "GRANTED"
                ? "default"
                : evaluation.reviewDecision === "REFUSED"
                  ? "destructive"
                  : "secondary"
            }
          >
            {evaluation.reviewDecision}
          </Badge>
        </div>
      </header>

      <ResultMarks
        procedures={evaluation.procedures.map((p) => ({
          id: p.id,
          key: p.key,
          status: p.status,
          resultJson: p.resultJson,
        }))}
        failedKeys={failedMarks.map((p) => p.key)}
      />

      <details className="sheet">
        <summary>Show every calculation</summary>
        <div className="sheet-body">
          {showWorking.map((row) => (
            <div key={row.key} className="text-sm">
              <p className="font-medium">{row.key}</p>
              {row.computed ? (
                row.lines.length > 0 ? (
                  row.lines.map((line, i) => (
                    <p key={i} className="text-muted-foreground">
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="text-muted-foreground">Not computed yet.</p>
                )
              ) : (
                <p className="text-muted-foreground">{row.note}</p>
              )}
              {row.note && row.computed ? <p className="text-destructive">{row.note}</p> : null}
            </div>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        {cannotCompute ? (
          <p className="text-sm text-destructive">No PDF or Word — cannot-compute (illegal instrument or lab out of band).</p>
        ) : (
          <>
            <Button render={<a href={`/api/evaluations/${evaluation.id}/export?format=pdf`} />} nativeButton={false} variant="outline">
              Export PDF
            </Button>
            <Button render={<a href={`/api/evaluations/${evaluation.id}/export?format=docx`} />} nativeButton={false} variant="outline">
              Export Word
            </Button>
          </>
        )}
      </div>

      <AttachmentForm
        evaluationId={evaluation.id}
        files={evaluation.attachments.map((a) => ({ id: a.id, filename: a.filename }))}
        canUpload={isOwnerTester && !decided}
      />

      {isReviewer ? (
        <ReviewForm evaluationId={evaluation.id} canGrant={canGrant} decided={decided} />
      ) : null}
    </div>
  );
}
