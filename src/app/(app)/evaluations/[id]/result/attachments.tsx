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
      <h2 className="px-4 pt-3 text-sm font-semibold">Photos & supporting documents</h2>
      <div className="sheet-body">
        {files.length === 0 ? <p className="sheet-note">Nothing attached yet.</p> : null}
        <ul className="text-sm">
          {files.map((f) => (
            <li key={f.id}>
              <a className="underline underline-offset-4" href={`/api/evaluations/${evaluationId}/attachments/${f.id}`}>
                {f.filename}
              </a>
            </li>
          ))}
        </ul>
        {canUpload ? (
          <form action={formAction} className="flex flex-wrap items-end gap-2">
            <input type="file" name="file" required className="text-sm" />
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Uploading…" : "Attach"}
            </Button>
          </form>
        ) : null}
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
