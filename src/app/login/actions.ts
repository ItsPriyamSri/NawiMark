"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginState = { error: string | null; email: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    // redirectTo throws a NEXT_REDIRECT control-flow error on success, which
    // is rethrown below (it isn't an AuthError) so Next.js can complete it.
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      // React resets uncontrolled form fields after an action runs, so the
      // email has to come back through state (see the plain <input
      // defaultValue> in page.tsx) for the field to survive a failed login.
      return { error: "Invalid email or password.", email };
    }
    throw error;
  }

  return { error: null, email };
}
