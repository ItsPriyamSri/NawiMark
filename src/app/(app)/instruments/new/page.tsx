"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInstrumentAction, type CreateInstrumentState } from "../actions";

const initialState: CreateInstrumentState = { error: null };

export default function NewInstrumentPage() {
  const [state, formAction, pending] = useActionState(createInstrumentAction, initialState);
  const v = state.values ?? {};

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <div className="flex items-center gap-2">
        <Link href="/instruments" className="text-xs text-muted-foreground hover:text-foreground">
          &larr; Back to instruments
        </Link>
      </div>

      <Card className="rounded-xs border border-border shadow-sm">
        <CardHeader className="gap-1.5 pb-3">
          <CardTitle className="text-lg text-primary">New instrument</CardTitle>
          <CardDescription className="text-xs leading-relaxed text-muted-foreground">
            Manufacturer, model, and technical parameters. Saving runs Table 3 validation —
            an illegal class/e/Max combination (n = Max/e out of band) is rejected here,
            before it reaches the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-3">
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manufacturer" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Manufacturer
              </Label>
              <Input id="manufacturer" name="manufacturer" placeholder="e.g. DemoCo" required defaultValue={v.manufacturer} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Model
              </Label>
              <Input id="model" name="model" placeholder="e.g. NW-30" required defaultValue={v.model} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="class" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Accuracy class
              </Label>
              <select
                id="class"
                name="class"
                required
                defaultValue={v.class ?? "III"}
                className="h-8 w-full rounded-xs border border-input bg-card/60 px-2.5 text-sm outline-none transition-all duration-150 hover:border-[#aab5a4] focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <option value="I">Class I (Special)</option>
                <option value="II">Class II (High)</option>
                <option value="III">Class III (Medium)</option>
                <option value="IIII">Class IIII (Ordinary)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="maxG" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Max (g)
                </Label>
                <Input id="maxG" name="maxG" inputMode="decimal" placeholder="30000" required defaultValue={v.maxG} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="eG" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  e (g)
                </Label>
                <Input id="eG" name="eG" inputMode="decimal" placeholder="10" required defaultValue={v.eG} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <OptionalField id="minG" label="Min (g)" placeholder="200" inputMode="decimal" value={v.minG} />
              <OptionalField id="unomV" label="Nominal voltage Unom (V)" placeholder="230" inputMode="decimal" value={v.unomV} />
            </div>
            <OptionalField id="serialNo" label="Serial / sample no." placeholder="e.g. NW30-0001" value={v.serialNo} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="specs" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Other technical parameters (optional)
              </Label>
              <textarea
                id="specs"
                name="specs"
                rows={3}
                maxLength={1000}
                defaultValue={v.specs}
                placeholder="Load cells, platform size, tare range, zero-setting range, display, power supply…"
                className="w-full rounded-xs border border-input bg-card/60 px-2.5 py-1.5 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
            {state.error ? (
              <p className="rounded-2xs border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
            <div className="pt-2">
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Saving…" : "Save instrument"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function OptionalField({
  id,
  label,
  placeholder,
  inputMode,
  value,
}: {
  id: string;
  label: string;
  placeholder: string;
  inputMode?: "decimal";
  value?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input id={id} name={id} inputMode={inputMode} placeholder={placeholder} defaultValue={value} />
    </div>
  );
}
