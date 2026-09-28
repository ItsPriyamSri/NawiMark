"use client";

import { useActionState } from "react";
import { ProcedureKey } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDITION_LABELS, DAMP_CONDITIONS, STATIC_CONDITIONS, TARE_LABELS, WEIGHING_LABELS } from "@/lib/demo-payloads";
import { saveObservationsAction, type SaveObservationsState } from "../../actions";

const initialState: SaveObservationsState = { error: null };

/** Displayed indication I plus ΔL (A.4.4.3). Legacy payloads stored a bare string. */
type Reading = string | { i?: string; dL?: string } | undefined;
const iOf = (r: Reading) => (typeof r === "string" ? r : (r?.i ?? ""));
const dLOf = (r: Reading) => (typeof r === "string" ? "" : (r?.dL ?? ""));

type Row = { load?: string; indicated?: Reading };
type Weigh = { rows?: Row[] };
type Ecc = { trueLoad?: string; positions?: Record<string, Reading>; zero?: Reading; notApplicable?: string };
type Conditions = { conditions?: Array<{ tempC?: string; rhPct?: string; rows?: Row[] }> };
type Setting = { tare?: string; load?: string; trials?: Reading[]; notApplicable?: string };
type TiltPos = { load?: string; ref?: Reading; tilts?: Reading[] };
const TILT_DIRS = ["Forward", "Backward", "Left", "Right"];

export function ObservationsForm(props: {
  evaluationId: string;
  locked?: boolean;
  e: string;
  env: { tempC: string; rhPct: string; observer: string; resolutionG: string };
  weighing?: Weigh;
  tare?: Weigh & { tare?: string; notApplicable?: string };
  damp?: Conditions;
  staticTemp?: Conditions;
  zeroSet?: Setting;
  tareSet?: Setting;
  repeat?: { series?: Array<{ trueLoad?: string; indications?: Reading[] }> };
  ecc?: Ecc;
  roll?: Ecc;
  disc?: { rows?: Array<{ load?: string; before?: string; after?: string; extra?: string }> };
  zero?: { before?: Reading; after?: Reading };
  creep?: { load?: string; i0?: Reading; i15?: Reading; i30?: Reading; i240?: Reading };
  stab?: { trials?: Array<{ printed?: string; min?: string; max?: string }> };
  tilt?: { notApplicable?: string; noLoad?: TiltPos; loads?: TiltPos[] };
  warmup?: { load?: string; rows?: Array<{ zero?: Reading; loaded?: Reading }> };
  volt?: { rows?: Array<{ voltage?: string; load?: string; indicated?: Reading }> };
  tnl?: { readings?: Array<{ tempC?: string; zero?: Reading }> };
  span?: { load?: string; indications?: Reading[] };
  endurance?: { before?: Weigh; after?: Weigh };
  notApplicable: Array<{ key: ProcedureKey; label: string; reason: string }>;
  never: Array<{ key: ProcedureKey; label: string; entered: boolean; note: string }>;
}) {
  const action = saveObservationsAction.bind(null, props.evaluationId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const disabled = props.locked;
  const na = new Set(props.notApplicable.map((n) => n.key));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Sheet title="Lab & environment" open>
        <p className="sheet-note">
          Out of band (−10…40 °C, 0…85 % RH) or a non-number → cannot-compute, no report. Resolution during test
          (R 76-2 header): at resolution e = {props.e} g every reading needs ΔL, the additional load at the changeover
          point, so P = I + ½e − ΔL (R 76-1 3.5.3.2, A.4.4.3). At a resolution ≤ 0.2e leave ΔL blank.
        </p>
        <div className="flex flex-wrap gap-3">
          <Field label="Temperature (°C)" name="tempC" defaultValue={props.env.tempC} disabled={disabled} />
          <Field label="Relative humidity (%)" name="rhPct" defaultValue={props.env.rhPct} disabled={disabled} />
          <Field label="Resolution during test (g)" name="resolutionG" defaultValue={props.env.resolutionG} disabled={disabled} />
          <Field label="Observer" name="observer" defaultValue={props.env.observer} disabled={disabled} inputMode="text" />
        </div>
      </Sheet>

      {props.notApplicable.length > 0 ? (
        <Sheet title="Not applicable to this instrument">
          <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {props.notApplicable.map((n) => (
              <li key={n.key}>
                <span className="font-semibold text-foreground">{n.label}</span> — {n.reason}
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}

      <Sheet title="Weighing performance (A.4.4.1)" open>
        <p className="sheet-note">At least 10 loads including Min, Max and the MPE change points, loading up and back to zero. E0 is the no-load row.</p>
        <WeighRows prefix="weighing" labels={WEIGHING_LABELS} rows={props.weighing?.rows} disabled={disabled} />
      </Sheet>

      <Sheet title="Accuracy of zero-setting (A.4.2.3)">
        <p className="sheet-note">
          Set zero, then find the changeover point. L0 is 0, or 10e when automatic zero-tracking is on. Each |E0| = |P − L0| ≤ 0.25e (4.5.2).
        </p>
        <SettingTrials prefix="zeroset" value={props.zeroSet} disabled={disabled} />
      </Sheet>

      <Sheet title="Repeatability (A.4.10)" open>
        <p className="sheet-note">Type approval: two series, about ½ Max and close to Max; 10 weighings each when Max &lt; 1000 kg.</p>
        {[0, 1].map((s) => (
          <div key={s} className="flex flex-col gap-2 pb-3">
            <Field
              label={s === 0 ? "Series 1 load, ~½ Max (g)" : "Series 2 load, close to Max (g)"}
              name={`repeat.${s}.trueLoad`}
              defaultValue={props.repeat?.series?.[s]?.trueLoad ?? ""}
              disabled={disabled}
            />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => (
                <ReadingField
                  key={i}
                  label={`#${i + 1}`}
                  name={`repeat.${s}.${i}`}
                  value={props.repeat?.series?.[s]?.indications?.[i]}
                  disabled={disabled}
                  compact
                />
              ))}
            </div>
          </div>
        ))}
      </Sheet>

      <Sheet title="Eccentricity — 4 corner, load ≈ Max/3 (A.4.7)" open>
        <p className="sheet-note">Load Max/3 (instruments without additive tare). Ec = P − L − E0, with E0 the zero error before the test (blank = 0; must be ≤ 0.25e).</p>
        <ReadingField label="Zero before test" name="ecc.zero" value={props.ecc?.zero} disabled={disabled} />
        <CornerPad
          loadName="ecc.trueLoad"
          loadValue={props.ecc?.trueLoad ?? ""}
          positions={["A", "B", "C", "D"]}
          prefix="ecc"
          values={props.ecc?.positions ?? {}}
          disabled={disabled}
        />
      </Sheet>

      <Sheet title="Tare weighing (A.4.6.1)">
        <p className="sheet-note">
          Subtractive tare T between ⅓ and ⅔ of maximum tare. Net loads after taring, at least 5 steps, net + T ≤ Max. MPE applies to the net
          value (3.5.3.3).
        </p>
        <Waive name="waive.TARE" value={props.tare?.notApplicable} disabled={disabled} hint="No tare device" />
        <div className="pt-2">
          <Field label="Tare value T (g)" name="tare.value" defaultValue={props.tare?.tare ?? ""} disabled={disabled} />
        </div>
        <div className="pt-2">
          <WeighRows prefix="tare" labels={TARE_LABELS} rows={props.tare?.rows} disabled={disabled} />
        </div>
      </Sheet>

      <Sheet title="Accuracy of tare setting (A.4.6.2)">
        <p className="sheet-note">Tare a load, then find the changeover point at zero. Each |E0| ≤ 0.25e (4.6.3).</p>
        <Waive name="waive.TARE_SETTING" value={props.tareSet?.notApplicable} disabled={disabled} hint="No tare device" />
        <div className="pt-2">
          <Field label="Tare load (g)" name="tareset.tare" defaultValue={props.tareSet?.tare ?? ""} disabled={disabled} />
        </div>
        <SettingTrials prefix="tareset" value={props.tareSet} disabled={disabled} />
      </Sheet>

      <Sheet title="Discrimination — digital (A.4.8.2)">
        <p className="sheet-note">
          Three loads, e.g. Min, ½ Max, Max. I1 after stepping back to I − d and adding 1/10 d; I2 after adding 1.4d. Pass if I2 − I1 ≥ d.
        </p>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Field label="Load (g)" name={`disc.${i}.load`} defaultValue={props.disc?.rows?.[i]?.load ?? ""} disabled={disabled} compact />
              <Field label="I1 (g)" name={`disc.${i}.before`} defaultValue={props.disc?.rows?.[i]?.before ?? ""} disabled={disabled} compact />
              <Field label="Extra = 1.4d (g)" name={`disc.${i}.extra`} defaultValue={props.disc?.rows?.[i]?.extra ?? ""} disabled={disabled} compact />
              <Field label="I2 (g)" name={`disc.${i}.after`} defaultValue={props.disc?.rows?.[i]?.after ?? ""} disabled={disabled} compact />
            </div>
          ))}
        </div>
      </Sheet>

      {na.has("ZERO_RETURN") ? null : (
        <Sheet title="Zero return (A.4.11.2)">
          <p className="sheet-note">Zero before loading (P0) and after a load close to Max has stayed 30 min (P30). |P30 − P0| ≤ 0.5e.</p>
          <div className="flex flex-wrap gap-3">
            <ReadingField label="Zero before, P0" name="zero.before" value={props.zero?.before} disabled={disabled} />
            <ReadingField label="Zero after 30 min, P30" name="zero.after" value={props.zero?.after} disabled={disabled} />
          </div>
        </Sheet>
      )}

      {na.has("CREEP") ? null : (
        <Sheet title="Creep (A.4.11.1)">
          <p className="sheet-note">
            Load close to Max. Stops at 30 min if the change is ≤ 0.5e and 15→30 min ≤ 0.2e; otherwise run 4 h and enter the reading furthest from
            the first (must stay ≤ |MPE|).
          </p>
          <div className="flex flex-wrap gap-3">
            <Field label="Load (g)" name="creep.load" defaultValue={props.creep?.load ?? ""} disabled={disabled} />
            <ReadingField label="0 min" name="creep.i0" value={props.creep?.i0} disabled={disabled} />
            <ReadingField label="15 min" name="creep.i15" value={props.creep?.i15} disabled={disabled} />
            <ReadingField label="30 min" name="creep.i30" value={props.creep?.i30} disabled={disabled} />
            <ReadingField label="Worst in 4 h (if needed)" name="creep.i240" value={props.creep?.i240} disabled={disabled} />
          </div>
        </Sheet>
      )}

      <Sheet title="Stability of equilibrium (A.4.12)">
        <p className="sheet-note">
          About ½ Max. Disturb, print at once, then read for 5 s. Five trials. Printed value, min and max must be within 1e (two adjacent values).
        </p>
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Field label={`#${i + 1} printed`} name={`stab.${i}.printed`} defaultValue={props.stab?.trials?.[i]?.printed ?? ""} disabled={disabled} compact />
              <Field label="5 s min" name={`stab.${i}.min`} defaultValue={props.stab?.trials?.[i]?.min ?? ""} disabled={disabled} compact />
              <Field label="5 s max" name={`stab.${i}.max`} defaultValue={props.stab?.trials?.[i]?.max ?? ""} disabled={disabled} compact />
            </div>
          ))}
        </div>
      </Sheet>

      {na.has("TILT") ? null : (
        <Sheet title="Tilt (A.5.1)">
          <p className="sheet-note">
            Reference position, then tilted forward, backward, left and right to the limiting value. No load: each |tilted − reference| ≤ 2e (not
            for class II). Loaded (zero set in each position), a load near the lowest MPE change and one near Max: each ≤ MPE.
          </p>
          <Waive name="waive.TILT" value={props.tilt?.notApplicable} disabled={disabled} hint="Fixed installation or freely suspended (3.9.1.2)" />
          {[0, 1, 2].map((i) => {
            const pos = i === 0 ? props.tilt?.noLoad : props.tilt?.loads?.[i - 1];
            return (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 items-end gap-2 pt-3">
                {i === 0 ? (
                  <span className="text-xs font-semibold text-muted-foreground pb-2">No load</span>
                ) : (
                  <Field label={`Load ${i} (g)`} name={`tilt.${i}.load`} defaultValue={pos?.load ?? ""} disabled={disabled} compact />
                )}
                <ReadingField label="Reference" name={`tilt.${i}.ref`} value={pos?.ref} disabled={disabled} compact />
                {TILT_DIRS.map((dir, d) => (
                  <ReadingField key={dir} label={dir} name={`tilt.${i}.t${d}`} value={pos?.tilts?.[d]} disabled={disabled} compact />
                ))}
              </div>
            );
          })}
        </Sheet>
      )}

      <Sheet title="Warm-up time (A.5.2)">
        <p className="sheet-note">After ≥ 8 h off. Zero then a load close to Max at 0, 5, 15, 30 min. Each |EL − E0| ≤ |MPE|.</p>
        <Field label="Load (g)" name="warmup.load" defaultValue={props.warmup?.load ?? ""} disabled={disabled} />
        <div className="flex flex-col gap-2 pt-2">
          {[0, 5, 15, 30].map((m, i) => (
            <div key={m} className="flex flex-wrap gap-3">
              <ReadingField label={`${m} min, unloaded`} name={`warmup.${i}.zero`} value={props.warmup?.rows?.[i]?.zero} disabled={disabled} />
              <ReadingField label={`${m} min, loaded`} name={`warmup.${i}.loaded`} value={props.warmup?.rows?.[i]?.loaded} disabled={disabled} />
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet title="Voltage variations (A.5.4)">
        <p className="sheet-note">Loads of 10e and one between ½ Max and Max, at Unom, 1.10 Unom and 0.85 Unom (AC mains).</p>
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Field label="Voltage (V)" name={`volt.${i}.voltage`} defaultValue={props.volt?.rows?.[i]?.voltage ?? ""} disabled={disabled} compact />
              <Field label="Load (g)" name={`volt.${i}.load`} defaultValue={props.volt?.rows?.[i]?.load ?? ""} disabled={disabled} compact />
              <ReadingField label="Indication" name={`volt.${i}.indicated`} value={props.volt?.rows?.[i]?.indicated} disabled={disabled} />
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet title="Static temperatures (A.5.3.1)">
        <p className="sheet-note">
          Weighing test at 20 °C, the high and low limits, 5 °C when the low limit is ≤ 0 °C, and 20 °C again. At least 5 loads each, up and down.
        </p>
        <ConditionBlocks prefix="st" labels={STATIC_CONDITIONS} value={props.staticTemp} disabled={disabled} />
      </Sheet>

      <Sheet title="Temperature effect on no-load (A.5.3.2)">
        <p className="sheet-note">Enter temperatures in test order (e.g. 20, 40, −10, 5, 20 °C). Zero change per 5 °C (1 °C class I) ≤ e.</p>
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Field label="Temperature (°C)" name={`tnl.${i}.tempC`} defaultValue={props.tnl?.readings?.[i]?.tempC ?? ""} disabled={disabled} compact />
              <ReadingField label="Zero indication" name={`tnl.${i}.zero`} value={props.tnl?.readings?.[i]?.zero} disabled={disabled} />
            </div>
          ))}
        </div>
      </Sheet>

      {na.has("DAMP_HEAT") ? null : (
        <Sheet title="Damp heat, steady state (B.2)">
          <p className="sheet-note">
            Reference (20 °C, 50 % RH), then the high temperature at 85 % RH after two days, then reference again. At least five loads each; all
            within MPE.
          </p>
          <ConditionBlocks prefix="damp" labels={DAMP_CONDITIONS} value={props.damp} disabled={disabled} withRh />
        </Sheet>
      )}

      {na.has("SPAN_STABILITY") ? null : (
        <Sheet title="Span stability (B.4)">
          <p className="sheet-note">
            Load near Max, at least 8 measurements over the test period. Each |E| ≤ MPE; variation ≤ ½e or ½|MPE|, whichever is greater.
          </p>
          <Field label="Load (g)" name="span.load" defaultValue={props.span?.load ?? ""} disabled={disabled} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {Array.from({ length: 8 }, (_, i) => (
              <ReadingField key={i} label={`#${i + 1}`} name={`span.${i}`} value={props.span?.indications?.[i]} disabled={disabled} compact />
            ))}
          </div>
        </Sheet>
      )}

      {na.has("ENDURANCE") ? null : (
        <Sheet title="Endurance — before / after 100 000 loadings (A.6)">
          <p className="sheet-note">Same five loads before and after. Durability error |E after − E before| ≤ |MPE|.</p>
          <div className="flex flex-col gap-4">
            {(["before", "after"] as const).map((when) => (
              <div key={when}>
                <p className="sheet-note mb-2 font-semibold uppercase tracking-wider text-muted-foreground">{when}</p>
                <WeighRows
                  prefix={`end.${when}`}
                  labels={["empty", "500e", "1500e", "2000e", "Max"]}
                  rows={props.endurance?.[when]?.rows}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        </Sheet>
      )}

      <Sheet title="Rolling-load eccentricity (A.4.7.4)">
        <p className="sheet-note">Vehicle and rail scales only. Beginning, middle and end, both directions. Load ≤ 0.8 Max.</p>
        <Waive name="waive.ROLLING_ECC" value={props.roll?.notApplicable} disabled={disabled} hint="Not a rolling-load instrument (3.6.2.4)" />
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
                {p.label}
              </label>
              <Input
                name={`note.${p.key}`}
                defaultValue={p.note}
                placeholder="inspector note"
                aria-label={`${p.label} inspector note`}
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
        <span className="text-xs text-muted-foreground transition-transform duration-200 group-open:rotate-90">▸</span>
      </summary>
      <div className="sheet-body">{children}</div>
    </details>
  );
}

function SettingTrials({ prefix, value, disabled }: { prefix: string; value?: Setting; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <Field label="L0 (g)" name={`${prefix}.load`} defaultValue={value?.load ?? ""} disabled={disabled} compact />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <ReadingField key={i} label={`#${i + 1}`} name={`${prefix}.${i}`} value={value?.trials?.[i]} disabled={disabled} compact />
        ))}
      </div>
    </div>
  );
}

function ConditionBlocks({
  prefix,
  labels,
  value,
  disabled,
  withRh,
}: {
  prefix: string;
  labels: string[];
  value?: Conditions;
  disabled?: boolean;
  withRh?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {labels.map((label, c) => (
        <div key={c} className="flex flex-col gap-2 border-t border-border/60 pt-3 first:border-0 first:pt-0">
          <p className="text-xs font-bold text-foreground">
            {c + 1}. {label}
          </p>
          <div className="flex flex-wrap gap-3">
            <Field label="Temperature (°C)" name={`${prefix}.${c}.tempC`} defaultValue={value?.conditions?.[c]?.tempC ?? ""} disabled={disabled} compact />
            {withRh ? (
              <Field label="RH (%)" name={`${prefix}.${c}.rhPct`} defaultValue={value?.conditions?.[c]?.rhPct ?? ""} disabled={disabled} compact />
            ) : null}
          </div>
          <WeighRows prefix={`${prefix}.${c}`} labels={CONDITION_LABELS} rows={value?.conditions?.[c]?.rows} disabled={disabled} />
        </div>
      ))}
    </div>
  );
}

function Waive({ name, value, disabled, hint }: { name: string; value?: string; disabled?: boolean; hint: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Not applicable — reason (leave blank if the test applies)
      </Label>
      <Input id={name} name={name} defaultValue={value ?? ""} placeholder={hint} disabled={disabled} className="max-w-lg text-xs" />
    </div>
  );
}

function WeighRows({ prefix, labels, rows, disabled }: { prefix: string; labels: string[]; rows?: Row[]; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2 max-w-xl">
      <div className="grid grid-cols-[4rem_1fr_1fr_4.5rem] sm:grid-cols-[5.5rem_1fr_1fr_5rem] gap-2 items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">
        <span>Step</span>
        <span>Load L (g)</span>
        <span>Indication I (g)</span>
        <span>ΔL (g)</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {labels.map((label, i) => (
          <div key={i} className="grid grid-cols-[4rem_1fr_1fr_4.5rem] sm:grid-cols-[5.5rem_1fr_1fr_5rem] gap-2 items-center">
            <span className="text-xs font-mono font-medium text-muted-foreground truncate">{label}</span>
            <Input
              name={`${prefix}.${i}.load`}
              aria-label={`${label} load`}
              defaultValue={rows?.[i]?.load ?? ""}
              inputMode="decimal"
              className="tabular-nums text-xs sm:text-sm"
              disabled={disabled}
            />
            <Input
              name={`${prefix}.${i}.indicated`}
              aria-label={`${label} indication`}
              defaultValue={iOf(rows?.[i]?.indicated)}
              inputMode="decimal"
              className="tabular-nums text-xs sm:text-sm"
              disabled={disabled}
            />
            <Input
              name={`${prefix}.${i}.indicated.dL`}
              aria-label={`${label} ΔL`}
              defaultValue={dLOf(rows?.[i]?.indicated)}
              inputMode="decimal"
              className="tabular-nums text-xs sm:text-sm"
              disabled={disabled}
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
  values: Record<string, Reading>;
  disabled?: boolean;
}) {
  const is6 = positions.length > 4;
  return (
    <div className="flex flex-col gap-3 pt-2">
      <Field label="True load (g)" name={loadName} defaultValue={loadValue} disabled={disabled} />
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Platform positions {is6 ? "(rolling load)" : "(4-corner)"} — I and ΔL
        </span>
        <div className={is6 ? "corner-pad corner-pad-6" : "corner-pad"} aria-label="Platform positions">
          {positions.map((pos) => (
            <div key={pos} className="corner">
              <span className="text-[11px] font-bold text-muted-foreground">Corner {pos}</span>
              <div className="flex gap-1">
                <Input name={`${prefix}.${pos}`} aria-label={`Corner ${pos} indication`} defaultValue={iOf(values[pos])} inputMode="decimal" disabled={disabled} />
                <Input
                  name={`${prefix}.${pos}.dL`}
                  aria-label={`Corner ${pos} ΔL`}
                  placeholder="ΔL"
                  defaultValue={dLOf(values[pos])}
                  inputMode="decimal"
                  disabled={disabled}
                  className="w-16"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReadingField({
  label,
  name,
  value,
  disabled,
  compact,
}: {
  label: string;
  name: string;
  value: Reading;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex gap-1">
        <Input
          id={name}
          name={name}
          defaultValue={iOf(value)}
          inputMode="decimal"
          placeholder="I"
          className={`tabular-nums ${compact ? "w-20 sm:w-24" : "w-28 sm:w-32"}`}
          disabled={disabled}
        />
        <Input
          name={`${name}.dL`}
          aria-label={`${label} ΔL`}
          defaultValue={dLOf(value)}
          inputMode="decimal"
          placeholder="ΔL"
          className="tabular-nums w-14 sm:w-16"
          disabled={disabled}
        />
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
  inputMode = "decimal",
}: {
  label: string;
  name: string;
  defaultValue: string;
  compact?: boolean;
  disabled?: boolean;
  inputMode?: "decimal" | "text";
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
        inputMode={inputMode}
        className={`tabular-nums ${compact ? "w-24 sm:w-28" : "w-36 sm:w-44"}`}
        disabled={disabled}
      />
    </div>
  );
}
