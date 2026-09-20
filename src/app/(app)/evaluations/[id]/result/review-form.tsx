"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { reviewDecisionAction, type ReviewState } from "../../actions";

const initial: ReviewState = { error: null };

export function ReviewForm({
  evaluationId,
  canGrant,
  decided,
  grantBlockedBy,
}: {
  evaluationId: string;
  canGrant: boolean;
  decided: boolean;
  grantBlockedBy?: string | null;
}) {
  const action = reviewDecisionAction.bind(null, evaluationId);
  const [state, formAction, pending] = useActionState(action, initial);

  if (decided) return null;

  return (
    <section className="sheet border-t-2 border-t-primary">
      <h2 className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
        Reviewer decision
      </h2>
      <div className="sheet-body p-4 flex flex-col gap-4">
        <p className="sheet-note">
          Grant is model approval on the initial band. A FAIL on any numeric pack mark blocks Grant.
        </p>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reviewNote" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Note (optional)
            </Label>
            <input
              id="reviewNote"
              name="reviewNote"
              placeholder="Add verification or refusal notes…"
              className="h-8 w-full max-w-md rounded-xs border border-input bg-card/60 px-2.5 text-sm outline-none transition-all duration-150 hover:border-[#aab5a4] focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="submit"
              name="decision"
              value="GRANTED"
              disabled={!canGrant || pending}
              className="min-w-20"
            >
              {pending ? "Saving…" : "Grant"}
            </Button>
            <Button
              type="submit"
              name="decision"
              value="REFUSED"
              variant="destructive"
              disabled={pending}
              className="min-w-20"
            >
              {pending ? "Saving…" : "Refuse"}
            </Button>
          </div>
        </form>
        {!canGrant && grantBlockedBy ? (
          <p className="text-xs font-medium text-muted-foreground border-l-2 border-destructive/60 pl-2">
            Grant is blocked: <span className="text-destructive font-mono">{grantBlockedBy}</span>
          </p>
        ) : !canGrant ? (
          <p className="text-xs font-medium text-muted-foreground border-l-2 border-destructive/60 pl-2">
            Grant is blocked: not every pack mark is PASS.
          </p>
        ) : null}
        {state.error ? (
          <p className="rounded-2xs border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
