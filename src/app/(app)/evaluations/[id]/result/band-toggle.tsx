"use client";

import { useState } from "react";
import type { Procedure, ProcedureKey, ProcedureStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { explainProcedure, type MpeView } from "@/lib/reports/explainer";

const STATUS_VARIANT = {
  MARKED_PASS: "default",
  MARKED_FAIL: "destructive",
  CANNOT_COMPUTE: "destructive",
  ENTERED_NOT_MARKED: "secondary",
  EMPTY: "outline",
} as const;

export function ResultMarks({
  procedures,
  failedKeys,
}: {
  procedures: Array<Pick<Procedure, "id" | "key" | "status" | "resultJson">>;
  failedKeys: ProcedureKey[];
}) {
  const [view, setView] = useState<MpeView>("initial");

  return (
    <div className="flex flex-col gap-4">
      <label className="band-toggle">
        <input
          type="checkbox"
          checked={view === "in-service"}
          onChange={(e) => setView(e.target.checked ? "in-service" : "initial")}
        />
        <span>Show same readings under shop 2× (demo only — stored mark stays type-eval)</span>
      </label>

      {failedKeys.length > 0 ? (
        <section className={view === "in-service" ? "fail-card fail-card-contrast" : "fail-card"} data-explainer="type-eval-fail">
          <h2>{view === "in-service" ? "Would pass on 2× — we still refuse" : "Fail"}</h2>
          {failedKeys.map((key) => {
            const p = procedures.find((x) => x.key === key);
            const lines = p ? explainProcedure(p.key, p.resultJson, view) ?? [] : [];
            return (
              <div key={key} className="flex flex-col gap-1">
                <p className="font-medium">{key}</p>
                {lines.map((line, i) => (
                  <p key={i} className="text-sm">
                    {line}
                  </p>
                ))}
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="sheet">
        <h2 className="px-4 pt-3 text-sm font-semibold">Procedures</h2>
        <div className="sheet-body">
          {procedures.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <Badge variant={STATUS_VARIANT[p.status as ProcedureStatus]}>{p.status}</Badge>
              <span className="w-44">{p.key}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
