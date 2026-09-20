"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      <h1 className="text-lg font-semibold">Something broke on this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <button type="button" onClick={reset} className="text-sm underline underline-offset-4">
        Try again
      </button>
    </main>
  );
}
