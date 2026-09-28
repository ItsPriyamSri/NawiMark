"use client";

import { useState } from "react";
import type { Procedure, ProcedureKey, ProcedureStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { NEVER_MARK, PACK_ID, PACK_MARKS, PROCEDURE_LABELS } from "@/engine/pack";
import { explainProcedure, type MpeView } from "@/lib/reports/explainer";

const STATUS_VARIANT = {
  MARKED_PASS: "success",
  MARKED_FAIL: "destructive",
  CANNOT_COMPUTE: "destructive",
  NOT_APPLICABLE: "outline",
  ENTERED_NOT_MARKED: "secondary",
  EMPTY: "outline",
} as const;

const STATUS_LABEL: Record<ProcedureStatus, string> = {
  MARKED_PASS: "PASS",
  MARKED_FAIL: "FAIL",
  CANNOT_COMPUTE: "cannot-compute",
  NOT_APPLICABLE: "not applicable",
  ENTERED_NOT_MARKED: "entered, not marked",
  EMPTY: "not entered",
};

export function ResultMarks({
  procedures,
  failedKeys,
  packId = PACK_ID,
  passCount = 0,
  inspectorCount = 0,
  notApplicableCount = 0,
  complete = false,
}: {
  procedures: Array<Pick<Procedure, "id" | "key" | "status" | "resultJson">>;
  failedKeys: ProcedureKey[];
  packId?: string;
  passCount?: number;
  inspectorCount?: number;
  notApplicableCount?: number;
  /** every applicable numeric mark is PASS */
  complete?: boolean;
}) {
  const [view, setView] = useState<MpeView>("initial");
  const order = [...PACK_MARKS, ...NEVER_MARK] as readonly string[];
  const ordered = [...procedures].sort(
    (a, b) => rank(a.status) - rank(b.status) || order.indexOf(a.key) - order.indexOf(b.key),
  );

  return (
    <div className="flex flex-col gap-4">
      <label className="band-toggle w-fit">
        <input
          type="checkbox"
          checked={view === "in-service"}
          onChange={(e) => setView(e.target.checked ? "in-service" : "initial")}
          className="rounded-2xs"
        />
        <span className="text-xs sm:text-sm">
          Show same readings under shop 2× (demo only — stored mark stays type-eval)
        </span>
      </label>

      {failedKeys.length > 0 ? (
        <section
          key={view}
          className={`${view === "in-service" ? "fail-card fail-card-contrast" : "fail-card"} stamp-anim`}
          data-explainer="type-eval-fail"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 pb-2">
            <h2>{view === "in-service" ? "Shown on shop 2× — stored mark unchanged" : "Fail"}</h2>
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold opacity-85">
              {view === "in-service" ? "2× Table 6 in-service inspection" : "Table 6 initial evaluation"}
            </span>
          </div>
          {failedKeys.map((key) => {
            const p = procedures.find((x) => x.key === key);
            const lines = p ? explainProcedure(p.key, p.resultJson, view, packId) ?? [] : [];
            return (
              <div key={key} className="flex flex-col gap-1.5 pt-1">
                <p className="font-bold text-sm tracking-tight">{PROCEDURE_LABELS[key] ?? key}</p>
                <div className="flex flex-col gap-1 pl-1">
                  {lines.map((line, i) => (
                    <p key={i} className="text-xs sm:text-sm leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ) : procedures.some((p) => p.status === "CANNOT_COMPUTE") ? null : complete ? (
        <section className="pass-card stamp-anim">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 pb-2">
            <h2>Pass</h2>
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold opacity-85">
              Table 6 initial evaluation
            </span>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed pt-1">
            {passCount} numeric pack marks within their R 76-1 limits
            {notApplicableCount ? `; ${notApplicableCount} not applicable` : ""}
            {inspectorCount ? `; ${inspectorCount} left to inspector judgement` : ""}.
          </p>
        </section>
      ) : (
        <section className="sheet px-4 py-3">
          <h2 className="text-sm font-bold">Incomplete</h2>
          <p className="text-xs sm:text-sm text-muted-foreground pt-1">
            {passCount} numeric marks pass so far. Every applicable sheet needs readings before a verdict or a grant.
          </p>
        </section>
      )}

      <section className="sheet">
        <h2 className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
          Procedures
        </h2>
        <div className="sheet-body divide-y divide-border/40 p-0">
          {ordered.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm transition-colors hover:bg-muted/30">
              <Badge variant={STATUS_VARIANT[p.status as ProcedureStatus]}>
                {STATUS_LABEL[p.status as ProcedureStatus]}
              </Badge>
              <span className="font-medium text-foreground">{PROCEDURE_LABELS[p.key] ?? p.key}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function rank(status: ProcedureStatus | string) {
  if (status === "MARKED_FAIL" || status === "CANNOT_COMPUTE") return 0;
  if (status === "ENTERED_NOT_MARKED") return 1;
  if (status === "EMPTY") return 2;
  if (status === "NOT_APPLICABLE") return 4;
  return 3;
}
