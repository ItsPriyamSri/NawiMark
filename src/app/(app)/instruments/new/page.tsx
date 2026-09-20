"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInstrumentAction, type CreateInstrumentState } from "../actions";

const initialState: CreateInstrumentState = { error: null };

export default function NewInstrumentPage() {
  const [state, formAction, pending] = useActionState(createInstrumentAction, initialState);

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>New instrument</CardTitle>
        <CardDescription>
          Manufacturer, model, and technical parameters. Saving runs Table 3 validation —
          an illegal class/e/Max combination (n = Max/e out of band) is rejected here,
          before it reaches the database.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input id="manufacturer" name="manufacturer" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model">Model</Label>
            <Input id="model" name="model" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="class">Accuracy class</Label>
            <select
              id="class"
              name="class"
              required
              defaultValue="III"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="I">I</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IIII">IIII</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxG">Max (g)</Label>
            <Input id="maxG" name="maxG" inputMode="decimal" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eG">e (g)</Label>
            <Input id="eG" name="eG" inputMode="decimal" required />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save instrument"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
