import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NEVER_MARK, RH_MAX, RH_MIN, TEMP_MAX, TEMP_MIN } from "@/engine/pack";
import { ObservationsForm } from "./form";

export default async function ObservationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const evaluation = await db.evaluation.findUnique({
    where: { id },
    include: { instrument: true, procedures: true },
  });
  if (!evaluation) notFound();
  if (session?.user.role !== "TESTER" || session.user.id !== evaluation.instrument.createdById) {
    redirect(`/evaluations/${id}/result`);
  }

  const byKey = Object.fromEntries(evaluation.procedures.map((p) => [p.key, p]));
  const payload = (key: string) => byKey[key]?.payloadJson as Record<string, unknown> | undefined;

  return (
    <div className="flex flex-col gap-6">
      <header className="page-head flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href={`/evaluations/${id}/result`} className="text-xs text-muted-foreground hover:text-foreground">
              &larr; Evaluation result
            </Link>
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Observation sheet</h1>
        <p className="text-xs sm:text-sm font-mono text-muted-foreground">
          {evaluation.instrument.manufacturer} {evaluation.instrument.model} · class {evaluation.instrument.class} · Max{" "}
          {evaluation.instrument.maxG} g · e {evaluation.instrument.eG} g
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 p-2.5 rounded-2xs border border-border">
          Lab band [{TEMP_MIN}, {TEMP_MAX}] °C, RH [{RH_MIN}, {RH_MAX}] %. Pack marks every numeric section. EMC /
          construction / checklist never get a green PASS from the engine.
        </p>
      </header>

      <ObservationsForm
        evaluationId={id}
        locked={evaluation.reviewDecision !== "NONE"}
        env={{ tempC: evaluation.tempC ?? "", rhPct: evaluation.rhPct ?? "", observer: evaluation.observer ?? "" }}
        weighing={payload("WEIGHING") as never}
        tare={payload("TARE") as never}
        damp={payload("DAMP_HEAT") as never}
        repeat={payload("REPEATABILITY") as never}
        ecc={payload("ECCENTRICITY") as never}
        roll={payload("ROLLING_ECC") as never}
        disc={payload("DISCRIMINATION") as never}
        sens={payload("SENSITIVITY") as never}
        zero={payload("ZERO_RETURN") as never}
        creep={payload("CREEP") as never}
        stab={payload("STABILITY") as never}
        tilt={payload("TILT") as never}
        warmup={payload("WARMUP") as never}
        volt={payload("VOLTAGE") as never}
        tnl={payload("TEMP_NOLOAD") as never}
        span={payload("SPAN_STABILITY") as never}
        endurance={payload("ENDURANCE") as never}
        never={evaluation.procedures
          .filter((p) => (NEVER_MARK as readonly string[]).includes(p.key))
          .map((p) => ({
            key: p.key,
            entered: p.status === "ENTERED_NOT_MARKED",
            note: (p.payloadJson as { note?: string } | null)?.note ?? "",
          }))}
      />
    </div>
  );
}
