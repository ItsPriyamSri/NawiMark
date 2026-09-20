"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reviewDecisionAction, type ReviewState } from "../../actions";

const initial: ReviewState = { error: null };

export function ReviewForm({
  evaluationId,
  canGrant,
  decided,
}: {
  evaluationId: string;
  canGrant: boolean;
  decided: boolean;
}) {
  const grantAction = reviewDecisionAction.bind(null, evaluationId, "GRANTED");
  const refuseAction = reviewDecisionAction.bind(null, evaluationId, "REFUSED");
  const [grantState, grantFormAction, grantPending] = useActionState(grantAction, initial);
  const [refuseState, refuseFormAction, refusePending] = useActionState(refuseAction, initial);

  if (decided) return null;

  return (
    <section className="sheet">
      <h2 className="px-4 pt-3 text-sm font-semibold">Reviewer decision</h2>
      <div className="sheet-body">
        <p className="sheet-note">
          Grant is model approval on the initial band. A FAIL on any numeric pack mark blocks Grant.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <form action={grantFormAction} className="flex flex-col gap-2">
            <Label htmlFor="reviewNote-grant">Note (optional)</Label>
            <Input id="reviewNote-grant" name="reviewNote" />
            <Button type="submit" disabled={!canGrant || grantPending}>
              {grantPending ? "Granting…" : "Grant"}
            </Button>
          </form>
          <form action={refuseFormAction} className="flex flex-col gap-2">
            <Label htmlFor="reviewNote-refuse">Note (optional)</Label>
            <Input id="reviewNote-refuse" name="reviewNote" />
            <Button type="submit" variant="destructive" disabled={refusePending}>
              {refusePending ? "Refusing…" : "Refuse"}
            </Button>
          </form>
        </div>
        {!canGrant ? (
          <p className="text-sm text-muted-foreground">Grant is blocked: not every pack mark is MARKED_PASS.</p>
        ) : null}
        {grantState.error ? (
          <p className="text-sm text-destructive" role="alert">
            {grantState.error}
          </p>
        ) : null}
        {refuseState.error ? (
          <p className="text-sm text-destructive" role="alert">
            {refuseState.error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
