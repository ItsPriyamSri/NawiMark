import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";

// bcrypt hash of a fixed placeholder (cost 10, matching prisma/seed.ts).
// Compared against on the "no such user" path too, so that path costs
// about the same as a real wrong-password check and response latency can't
// be used to probe which emails are registered.
const DUMMY_HASH = "$2b$10$Q.m9FQqwOa58ENHwfKgmWOxkYY4ic5OP/mG3dBU/NMMKDQW1VL8EG";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
          return null;
        }
        const user = await db.user.findUnique({ where: { email } });
        if (!user) {
          await compare(password, DUMMY_HASH); // burn the same time as a real check
          return null;
        }

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
});
