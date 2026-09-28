import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PACK_ID, PACK_MARKS, PROCEDURE_LABELS } from "@/engine/pack";
import { buildShowWorking, grantable, MPE_USED_LINE, testerWaivers } from "@/lib/reports/explainer";
import { AttachmentForm } from "./attachments";
import { ResultMarks } from "./band-toggle";
import { ReviewForm } from "./review-form";

const DECISION_LABEL = {
  NONE: "Not yet reviewed",
  GRANTED: "Granted",
  REFUSED: "Refused",
} as const;

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

  const packId = evaluation.packId || PACK_ID;
  const marks = evaluation.procedures.filter((p) => (PACK_MARKS as readonly string[]).includes(p.key));
  const failedMarks = marks.filter((p) => p.status === "MARKED_FAIL");
  const cannotMarks = marks.filter((p) => p.status === "CANNOT_COMPUTE");
  const canGrant = grantable(evaluation.procedures);
  const waivers = testerWaivers(evaluation.procedures);
  const showWorking = buildShowWorking(evaluation.procedures, "initial", packId);
  const cannotCompute = cannotMarks.length > 0;
  const decided = evaluation.reviewDecision !== "NONE";
  const cannotReason =
    cannotMarks
      .map((p) => {
        const r = p.resultJson;
        return r && typeof r === "object" && "reason" in r ? String((r as { reason: unknown }).reason) : null;
      })
      .find((x) => x) ?? "cannot-compute";
  const grantBlockedBy = failedMarks[0]
    ? `${PROCEDURE_LABELS[failedMarks[0].key] ?? failedMarks[0].key} failed`
    : cannotCompute
      ? cannotReason
      : marks.some((p) => p.status === "EMPTY")
        ? "a numeric pack mark is still empty"
        : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="page-head flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
                &larr; Desk
              </Link>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {evaluation.instrument.manufacturer} {evaluation.instrument.model}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono">
              Class {evaluation.instrument.class} · Max {evaluation.instrument.maxG} g · e {evaluation.instrument.eG} g
              · n={evaluation.instrument.n ?? "?"}
            </p>
          </div>
          {isOwnerTester && !decided ? (
            <Link
              href={`/evaluations/${evaluation.id}/observations`}
              className="text-xs sm:text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Edit observations &rarr;
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{packId}</Badge>
          <span className="font-mono text-muted-foreground">{MPE_USED_LINE}</span>
          <Badge variant="secondary">{evaluation.status === "COMPLETED" ? "Completed" : "In process"}</Badge>
          <Badge
            variant={
              evaluation.reviewDecision === "GRANTED"
                ? "default"
                : evaluation.reviewDecision === "REFUSED"
                  ? "destructive"
                  : "secondary"
            }
          >
            {DECISION_LABEL[evaluation.reviewDecision]}
          </Badge>
        </div>
      </header>

      {cannotCompute ? (
        <section className="cannot-card">
          <h2 className="text-sm font-bold text-destructive mb-1">Cannot compute</h2>
          <p className="text-xs sm:text-sm font-mono text-destructive mb-1">{cannotReason}</p>
          <p className="text-xs text-muted-foreground">
            No PDF or Word until the instrument and lab band are legal and every marked sheet has numbers the engine can read.
          </p>
        </section>
      ) : null}

      <ResultMarks
        procedures={evaluation.procedures.map((p) => ({
          id: p.id,
          key: p.key,
          status: p.status,
          resultJson: p.resultJson,
        }))}
        failedKeys={failedMarks.map((p) => p.key)}
        packId={packId}
        passCount={marks.filter((p) => p.status === "MARKED_PASS").length}
        notApplicableCount={marks.filter((p) => p.status === "NOT_APPLICABLE").length}
        inspectorCount={evaluation.procedures.filter((p) => p.status === "ENTERED_NOT_MARKED").length}
        complete={canGrant}
      />

      <details className="sheet">
        <summary>
          <span>Show every calculation</span>
          <span className="text-xs text-muted-foreground">▾</span>
        </summary>
        <div className="sheet-body divide-y divide-border/60">
          {showWorking.map((row) => (
            <div key={row.key} className="py-2.5 first:pt-0 last:pb-0 text-xs sm:text-sm">
              <p className="font-bold text-foreground mb-1">{PROCEDURE_LABELS[row.key] ?? row.key}</p>
              {row.computed ? (
                row.lines.length > 0 ? (
                  <div className="flex flex-col gap-0.5 pl-2 font-mono text-xs">
                    {row.lines.map((line, i) => (
                      <p key={i} className="text-muted-foreground">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs pl-2">{row.note ?? "Not computed yet."}</p>
                )
              ) : (
                <p className="text-muted-foreground text-xs pl-2">{row.note}</p>
              )}
              {row.note && row.computed && row.lines.length > 0 ? (
                <p className="text-destructive text-xs font-mono pl-2 mt-1">{row.note}</p>
              ) : null}
              {row.table ? (
                <div className="overflow-x-auto pl-2 mt-2">
                  <table className="text-[11px] font-mono tabular-nums border-collapse">
                    <thead>
                      <tr>
                        {row.table.headers.map((h, i) => (
                          <th key={i} scope="col" className="px-2 py-1 text-left font-semibold text-muted-foreground border-b border-border">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {row.table.rows.map((cells, ri) => (
                        <tr key={ri} className={cells.at(-1) === "NO" ? "text-destructive font-semibold" : undefined}>
                          {cells.map((c, ci) => (
                            <td key={ci} className="px-2 py-0.5 whitespace-nowrap">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        {cannotCompute ? (
          <p className="text-xs text-destructive font-mono">No PDF or Word — {cannotReason}</p>
        ) : (
          <>
            <a
              href={`/api/evaluations/${evaluation.id}/export?format=pdf`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Export PDF
            </a>
            <a
              href={`/api/evaluations/${evaluation.id}/export?format=docx`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Export Word
            </a>
          </>
        )}
      </div>

      <AttachmentForm
        evaluationId={evaluation.id}
        files={evaluation.attachments.map((a) => ({ id: a.id, filename: a.filename }))}
        canUpload={isOwnerTester && !decided}
      />

      {waivers.length ? (
        <section className="sheet px-4 py-3" aria-label="Tester waivers">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Declared not applicable by the tester</h2>
          <ul className="pt-1.5 flex flex-col gap-1 text-xs sm:text-sm">
            {waivers.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {isReviewer ? (
        <ReviewForm
          evaluationId={evaluation.id}
          canGrant={canGrant}
          decided={decided}
          grantBlockedBy={grantBlockedBy}
        />
      ) : null}
    </div>
  );
}
