"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null, email: "" };

// Same visual treatment as components/ui/input.tsx, but a plain native
// <input> instead of Base UI's Input (= Field.Control): Field.Control warns
// if defaultValue changes after mount, and it needs to here — React resets
// uncontrolled fields after every action call, so re-showing the submitted
// email on a failed login requires defaultValue to track server state.
const emailInputClassName = cn(
  "h-8 w-full min-w-0 rounded-xs border border-input bg-card/60 px-2.5 py-1 text-sm transition-all duration-150 outline-none placeholder:text-muted-foreground/70 hover:border-[#aab5a4] focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/40 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20"
);

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="flex flex-1 items-center justify-center p-4 min-h-[calc(100vh-2rem)]">
      <Card className="login-sheet w-full max-w-sm rounded-xs border border-border shadow-md">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl tracking-tight text-primary">NawiMark</CardTitle>
          <CardDescription className="text-xs leading-relaxed text-muted-foreground">
            SIH26035 · type-evaluation desk. We mark lab observations against OIML R-76 Table 6
            <strong> initial</strong>, not shop 2×.
            <br />
            <span className="text-[11px] opacity-85">Mocked demo accounts. Not a live RRSL or eMaap.</span>
            <br />
            <span className="font-mono text-[11px] text-foreground/80">
              tester@nawimark.local or reviewer@nawimark.local
            </span>{" "}
            · password{" "}
            <code className="rounded-2xs bg-muted px-1 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              demo-only-change-me
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={state.email}
                required
                autoComplete="email"
                aria-invalid={!!state.error}
                className={emailInputClassName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                aria-invalid={!!state.error}
              />
            </div>
            {state.error ? (
              <p className="rounded-2xs border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending} className="w-full mt-1">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
