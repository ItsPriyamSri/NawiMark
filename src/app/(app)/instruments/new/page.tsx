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
              <Input id="manufacturer" name="manufacturer" placeholder="e.g. DemoCo" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Model
              </Label>
              <Input id="model" name="model" placeholder="e.g. NW-30" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="class" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Accuracy class
              </Label>
              <select
                id="class"
                name="class"
                required
                defaultValue="III"
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
                <Input id="maxG" name="maxG" inputMode="decimal" placeholder="30000" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="eG" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  e (g)
                </Label>
                <Input id="eG" name="eG" inputMode="decimal" placeholder="10" required />
              </div>
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
