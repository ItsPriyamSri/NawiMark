"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { uploadAttachmentAction, type AttachState } from "../../actions";

const initial: AttachState = { error: null };

export function AttachmentForm({
  evaluationId,
  files,
  canUpload,
}: {
  evaluationId: string;
  files: Array<{ id: string; filename: string }>;
  canUpload: boolean;
}) {
  const action = uploadAttachmentAction.bind(null, evaluationId);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <section className="sheet">
      <h2 className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
        Photos & supporting documents
      </h2>
      <div className="sheet-body p-4 flex flex-col gap-3">
        {files.length === 0 ? <p className="sheet-note">Nothing attached yet.</p> : null}
        <ul className="flex flex-col gap-1.5 text-xs sm:text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-xs">📄</span>
              <a
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 font-mono text-xs"
                href={`/api/evaluations/${evaluationId}/attachments/${f.id}`}
              >
                {f.filename}
              </a>
            </li>
          ))}
        </ul>
        {canUpload ? (
          <form action={formAction} className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="file"
              name="file"
              required
              className="text-xs file:mr-2 file:h-7 file:rounded-xs file:border file:border-border file:bg-muted/60 file:px-2.5 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted cursor-pointer"
            />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? "Uploading…" : "Attach"}
            </Button>
          </form>
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
