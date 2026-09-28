import type { DefaultSession, NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Module augmentation: session/JWT carry the seeded user's id + role
// (TESTER/REVIEWER) so route handlers and pages can branch on ownership.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
  interface User {
    role: Role;
  }
}

// No JWT augmentation: @auth/core is not a direct dependency, so pnpm cannot
// resolve `declare module "@auth/core/jwt"` and `next build` fails. The two
// fields are written in jwt() below and narrowed where session() reads them.

// Edge-safe config: no Prisma/bcrypt here (providers added in auth.ts),
// so this can be imported directly by middleware without pulling a
// Node-only DB client into the edge bundle.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // Correct for this app's topology (single self-hosted origin, no
  // Vercel/multi-tenant — see AGENTS.md "One host"), but trustHost alone
  // only means "believe the incoming Host header." Deploying this without
  // also setting AUTH_URL to the real origin reopens a host-header-
  // injection/open-redirect gap. See .env.example for the AUTH_URL note —
  // it must be set before this goes anywhere but localhost.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only passed on initial sign-in; `authorize()` below always
      // returns a defined id, but the base User type marks it optional.
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
