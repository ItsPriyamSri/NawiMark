import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge proxy (renamed from `middleware.ts` — Next.js 16 convention), built
// from the edge-safe config only (no Prisma/bcrypt). Protects everything
// except the login page, Auth.js's own API routes, and Next.js
// internals/static assets. `/(app)/**` pages live under this matcher
// automatically since a route group doesn't appear in the URL.
const { auth } = NextAuth(authConfig);
export const proxy = auth;

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
