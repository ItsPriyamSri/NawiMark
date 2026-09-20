"use client";

import { useActionState } from "react";
import { ProcedureKey } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NEVER_MARK } from "@/engine/pack";
import { WEIGHING_LABELS } from "@/lib/demo-payloads";
import { saveObservationsAction, type SaveObservationsState } from "../../actions";

const initialState: SaveObservationsState = { error: null };

type Weigh = { rows?: Array<{ load: string; indicated: string }> };
type Repeat = { trueLoad?: string; indications?: string[] };
type Ecc = { trueLoad?: string; positions?: Record<string, string> };

export function ObservationsForm(props: {
  evaluationId: string;
  locked?: boolean;
  env: { tempC: string; rhPct: string; observer: string };
  weighing?: Weigh;
  tare?: Weigh;
  damp?: Weigh;
  repeat?: Repeat;
  ecc?: Ecc;
  roll?: Ecc;
  disc?: { indicatedBefore?: string; indicatedAfter?: string; extraLoad?: string };
  sens?: { indicatedBefore?: string; indicatedAfter?: string; extraLoad?: string };
  zero?: { residual?: string };
  creep?: { load?: string; i0?: string; i15?: string; i30?: string };
  stab?: { i1?: string; i2?: string };
  tilt?: { noLoadLevel?: string; noLoadTilt?: string; load?: string; indicatedTilt?: string };
  warmup?: { zeros?: string[]; load?: string; indicated?: string[] };
  volt?: { rows?: Array<{ voltage: string; load: string; indicated: string }> };
  tnl?: { readings?: Array<{ tempC: string; zero: string }> };
  span?: { indications?: string[] };
  endurance?: { before?: Weigh; after?: Weigh };
  never: Array<{ key: ProcedureKey; entered: boolean; note: string }>;
}) {
  const action = saveObservationsAction.bind(null, props.evaluationId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const disabled = props.locked;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Sheet title="Lab & environment" open>
        <p className="sheet-note">Out of band (−10…40 °C, 0…85 % RH) or a non-number → cannot-compute, no report.</p>
        <div className="flex flex-wrap gap-3">
          <Field label="Temperature (°C)" name="tempC" defaultValue={props.env.tempC} disabled={disabled} />
          <Field label="Relative humidity (%)" name="rhPct" defaultValue={props.env.rhPct} disabled={disabled} />
          <Field label="Observer" name="observer" defaultValue={props.env.observer} disabled={disabled} />
        </div>
      </Sheet>

      <Sheet title="Weighing performance" open>
        <WeighRows prefix="weighing" labels={WEIGHING_LABELS} rows={props.weighing?.rows} disabled={disabled} />
      </Sheet>

      <Sheet title="Repeatability" open>
        <div className="flex flex-col gap-3 max-w-lg">
          <Field label="True load (g)" name="repeat.trueLoad" defaultValue={props.repeat?.trueLoad ?? ""} disabled={disabled} />
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Repeated indications (½ Max, 10 weighings)
            </span>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground text-center">#{i + 1}</span>
                  <Input
                    name={`repeat.${i}`}
                    defaultValue={props.repeat?.indications?.[i] ?? ""}
                    inputMode="decimal"
                    className="tabular-nums text-xs text-center"
                    disabled={disabled}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Sheet>

      <Sheet title="Eccentricity — 4 corner, load ≈ Max/3" open>
        <p className="sheet-note">
          A.4.7 load is Max/3. Pass corners sit on the e-step. Fail fixture C is P = I + ½e − ΔL (locked 11 g line).
        </p>
        <CornerPad
          loadName="ecc.trueLoad"
          loadValue={props.ecc?.trueLoad ?? ""}
          positions={["A", "B", "C", "D"]}
          prefix="ecc"
          values={props.ecc?.positions ?? {}}
          disabled={disabled}
        />
      </Sheet>

      <Sheet title="Tare weighing">
        <WeighRows prefix="tare" labels={WEIGHING_LABELS} rows={props.tare?.rows} disabled={disabled} />
      </Sheet>

      <Sheet title="Discrimination (digital)">
        <p className="sheet-note">Extra load ≥ 1.4e. Indication must change by at least e (d = e).</p>
        <div className="flex flex-wrap gap-3">
          <Field label="I before (g)" name="disc.before" defaultValue={props.disc?.indicatedBefore ?? ""} disabled={disabled} />
          <Field label="Extra (g)" name="disc.extra" defaultValue={props.disc?.extraLoad ?? ""} disabled={disabled} />
          <Field label="I after (g)" name="disc.after" defaultValue={props.disc?.indicatedAfter ?? ""} disabled={disabled} />
        </div>
      </Sheet>

      <Sheet title="Sensitivity (analogue)">
        <div className="flex flex-wrap gap-3">
          <Field label="I before (g)" name="sens.before" defaultValue={props.sens?.indicatedBefore ?? ""} disabled={disabled} />
          <Field label="Extra (g)" name="sens.extra" defaultValue={props.sens?.extraLoad ?? ""} disabled={disabled} />
          <Field label="I after (g)" name="sens.after" defaultValue={props.sens?.indicatedAfter ?? ""} disabled={disabled} />
        </div>
      </Sheet>

      <Sheet title="Zero return">
        <Field label="Residual after unload (g)" name="zero.residual" defaultValue={props.zero?.residual ?? ""} disabled={disabled} />
      </Sheet>

      <Sheet title="Creep">
        <div className="flex flex-wrap gap-3">
          <Field label="Load (g)" name="creep.load" defaultValue={props.creep?.load ?? ""} disabled={disabled} />
          <Field label="I at 0 min" name="creep.i0" defaultValue={props.creep?.i0 ?? ""} disabled={disabled} />
          <Field label="I at 15 min" name="creep.i15" defaultValue={props.creep?.i15 ?? ""} disabled={disabled} />
          <Field label="I at 30 min" name="creep.i30" defaultValue={props.creep?.i30 ?? ""} disabled={disabled} />
        </div>
      </Sheet>

      <Sheet title="Stability of equilibrium">
        <div className="flex flex-wrap gap-3">
          <Field label="Indication 1" name="stab.i1" defaultValue={props.stab?.i1 ?? ""} disabled={disabled} />
          <Field label="Indication 2" name="stab.i2" defaultValue={props.stab?.i2 ?? ""} disabled={disabled} />
        </div>
      </Sheet>

      <Sheet title="Tilt">
        <p className="sheet-note">No-load change ≤ 2e. Loaded indication vs Table 6 MPE.</p>
        <div className="flex flex-wrap gap-3">
          <Field label="No-load level" name="tilt.noLoadLevel" defaultValue={props.tilt?.noLoadLevel ?? ""} disabled={disabled} />
          <Field label="No-load tilted" name="tilt.noLoadTilt" defaultValue={props.tilt?.noLoadTilt ?? ""} disabled={disabled} />
          <Field label="Load (g)" name="tilt.load" defaultValue={props.tilt?.load ?? ""} disabled={disabled} />
          <Field label="I tilted (g)" name="tilt.indicatedTilt" defaultValue={props.tilt?.indicatedTilt ?? ""} disabled={disabled} />
        </div>
      </Sheet>

      <Sheet title="Warm-up">
        <div className="flex flex-wrap gap-2.5">
          {[0, 1, 2].map((i) => (
            <Field key={i} label={`Zero #${i + 1}`} name={`warmup.zero.${i}`} defaultValue={props.warmup?.zeros?.[i] ?? ""} compact disabled={disabled} />
          ))}
          <Field label="Test load (g)" name="warmup.load" defaultValue={props.warmup?.load ?? ""} disabled={disabled} />
          {[0, 1].map((i) => (
            <Field key={i} label={`I #${i + 1}`} name={`warmup.ind.${i}`} defaultValue={props.warmup?.indicated?.[i] ?? ""} compact disabled={disabled} />
          ))}
        </div>
      </Sheet>

      <Sheet title="Voltage variations">
        <div className="flex flex-col gap-2 max-w-lg">
          <div className="grid grid-cols-[3.5rem_1fr_1fr] sm:grid-cols-[4.5rem_1fr_1fr] gap-2 items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">
            <span>Voltage (V)</span>
            <span>Load (g)</span>
            <span>Indicated (g)</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid grid-cols-[3.5rem_1fr_1fr] sm:grid-cols-[4.5rem_1fr_1fr] gap-2 items-center">
                <Input
                  name={`volt.${i}.voltage`}
                  defaultValue={props.volt?.rows?.[i]?.voltage ?? ""}
                  inputMode="decimal"
                  className="tabular-nums text-xs sm:text-sm"
                  disabled={disabled}
                  placeholder="230"
                />
                <Input
                  name={`volt.${i}.load`}
                  defaultValue={props.volt?.rows?.[i]?.load ?? ""}
                  inputMode="decimal"
                  className="tabular-nums text-xs sm:text-sm"
                  disabled={disabled}
                  placeholder="15000"
                />
                <Input
                  name={`volt.${i}.indicated`}
                  defaultValue={props.volt?.rows?.[i]?.indicated ?? ""}
                  inputMode="decimal"
                  className="tabular-nums text-xs sm:text-sm"
                  disabled={disabled}
                  placeholder="15000"
                />
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet title="Temperature effect on no-load">
        <div className="flex flex-col gap-2 max-w-md">
          <div className="grid grid-cols-[1fr_1fr] gap-2 items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">
            <span>Temperature (°C)</span>
            <span>Zero indication (g)</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr] gap-2 items-center">
                <Input
                  name={`tnl.${i}.tempC`}
                  defaultValue={props.tnl?.readings?.[i]?.tempC ?? ""}
                  inputMode="decimal"
                  className="tabular-nums text-xs sm:text-sm"
                  disabled={disabled}
                  placeholder="20"
                />
                <Input
                  name={`tnl.${i}.zero`}
                  defaultValue={props.tnl?.readings?.[i]?.zero ?? ""}
                  inputMode="decimal"
                  className="tabular-nums text-xs sm:text-sm"
                  disabled={disabled}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet title="Damp heat — weighing at stated humidity">
        <WeighRows prefix="damp" labels={WEIGHING_LABELS} rows={props.damp?.rows} disabled={disabled} />
      </Sheet>

      <Sheet title="Span stability">
        <div className="flex flex-wrap gap-2.5">
          {[0, 1, 2].map((i) => (
            <Field key={i} label={`I at Max #${i + 1}`} name={`span.${i}`} defaultValue={props.span?.indications?.[i] ?? ""} compact disabled={disabled} />
          ))}
        </div>
      </Sheet>

      <Sheet title="Endurance — before / after">
        <div className="flex flex-col gap-4">
          <div>
            <p className="sheet-note mb-2 font-semibold uppercase tracking-wider text-muted-foreground">Before</p>
            <WeighRows prefix="end.before" labels={["empty", "Max", "Max", "empty"]} rows={props.endurance?.before?.rows} disabled={disabled} />
          </div>
          <div>
            <p className="sheet-note mb-2 font-semibold uppercase tracking-wider text-muted-foreground">After</p>
            <WeighRows prefix="end.after" labels={["empty", "Max", "Max", "empty"]} rows={props.endurance?.after?.rows} disabled={disabled} />
          </div>
        </div>
      </Sheet>

      <Sheet title="Rolling-load eccentricity">
        <CornerPad
          loadName="roll.trueLoad"
          loadValue={props.roll?.trueLoad ?? ""}
          positions={["A", "B", "C", "D", "E", "F"]}
          prefix="roll"
          values={props.roll?.positions ?? {}}
          disabled={disabled}
        />
      </Sheet>

      <Sheet title="Not marked — inspector only">
        <p className="sheet-note">
          EMC, construction examination, and the software checklist are never auto-PASS. A tick here only records that the inspector filled the section.
        </p>
        <div className="flex flex-col gap-2.5 pt-1">
          {props.never.map((p) => (
            <div key={p.key} className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-44">
                <input
                  type="checkbox"
                  name={`entered.${p.key}`}
                  defaultChecked={p.entered}
                  disabled={disabled}
                  className="size-4 accent-primary rounded-2xs"
                />
                {NEVER_MARK.includes(p.key as (typeof NEVER_MARK)[number]) ? p.key : p.key}
              </label>
              <Input
                name={`note.${p.key}`}
                defaultValue={p.note}
                placeholder="inspector note"
                disabled={disabled}
                className="flex-1 min-w-48"
              />
            </div>
          ))}
        </div>
      </Sheet>

      {state.error ? (
        <p className="rounded-2xs border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="pt-2">
        <Button type="submit" disabled={pending || disabled} className="min-w-36">
          {disabled ? "Locked after review" : pending ? "Marking…" : "Save and mark"}
        </Button>
      </div>
    </form>
  );
}

function Sheet({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="sheet">
      <summary className="group">
        <span className="font-bold text-sm text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground transition-transform duration-200 group-open:rotate-90">
          ▸
        </span>
      </summary>
      <div className="sheet-body">{children}</div>
    </details>
  );
}

function WeighRows({
  prefix,
  labels,
  rows,
  disabled,
}: {
  prefix: string;
  labels: string[];
  rows?: Array<{ load: string; indicated: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 max-w-lg">
      <div className="grid grid-cols-[4.5rem_1fr_1fr] sm:grid-cols-[5.5rem_1fr_1fr] gap-2 items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">
        <span>Step</span>
        <span>Load (g)</span>
        <span>Indicated (g)</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {labels.map((label, i) => (
          <div key={i} className="grid grid-cols-[4.5rem_1fr_1fr] sm:grid-cols-[5.5rem_1fr_1fr] gap-2 items-center">
            <span className="text-xs font-mono font-medium text-muted-foreground truncate">{label}</span>
            <Input
              name={`${prefix}.${i}.load`}
              defaultValue={rows?.[i]?.load ?? ""}
              inputMode="decimal"
              className="tabular-nums text-xs sm:text-sm"
              disabled={disabled}
              placeholder="0"
            />
            <Input
              name={`${prefix}.${i}.indicated`}
              defaultValue={rows?.[i]?.indicated ?? ""}
              inputMode="decimal"
              className="tabular-nums text-xs sm:text-sm"
              disabled={disabled}
              placeholder="0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CornerPad({
  loadName,
  loadValue,
  positions,
  prefix,
  values,
  disabled,
}: {
  loadName: string;
  loadValue: string;
  positions: string[];
  prefix: string;
  values: Record<string, string>;
  disabled?: boolean;
}) {
  const is6 = positions.length > 4;
  return (
    <div className="flex flex-col gap-3">
      <Field label="True load (g)" name={loadName} defaultValue={loadValue} disabled={disabled} />
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Platter positions {is6 ? "(rolling load)" : "(4-corner)"}
        </span>
        <div className={is6 ? "corner-pad corner-pad-6" : "corner-pad"} aria-label="Platform positions">
          {positions.map((pos) => (
            <label key={pos} className="corner">
              <span className="text-[11px] font-bold text-muted-foreground">Corner {pos}</span>
              <Input name={`${prefix}.${pos}`} defaultValue={values[pos] ?? ""} inputMode="decimal" disabled={disabled} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  compact,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue}
        inputMode="decimal"
        className={`tabular-nums ${compact ? "w-24 sm:w-28" : "w-36 sm:w-44"}`}
        disabled={disabled}
      />
    </div>
  );
}
