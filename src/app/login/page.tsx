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
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
);

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm rounded-sm">
        <CardHeader>
          <CardTitle>NawiMark</CardTitle>
          <CardDescription>
            SIH26035 · type-evaluation desk. We mark lab observations against OIML R-76 Table 6
            <strong> initial</strong>, not shop 2×.
            <br />
            Mocked demo accounts. Not a live RRSL or eMaap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
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
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
