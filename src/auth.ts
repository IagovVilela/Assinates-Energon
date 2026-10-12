import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/server/passwords";
import { isLoginRateLimited } from "@/server/rate-limit";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: SESSION_MS / 1000 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials.email ?? "").trim().toLowerCase();
        const password = String(credentials.password ?? "");
        if (!email || !password) {
          return null;
        }
        const since = new Date(Date.now() - 15 * 60 * 1000);
        const recent = await prisma.loginAttempt.findMany({
          where: { email, createdAt: { gte: since } },
          select: { email: true, success: true, createdAt: true },
        });
        if (isLoginRateLimited(recent, email)) {
          return null;
        }
        const user = await prisma.user.findUnique({ where: { email } });
        const valid = user ? await verifyPassword(user.passwordHash, password) : false;
        await prisma.loginAttempt.create({
          data: { email, userId: user?.id, success: valid },
        });
        if (!user || !valid) {
          return null;
        }
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const sessionToken = randomBytes(32).toString("base64url");
        await prisma.session.create({
          data: {
            sessionToken,
            userId: user.id,
            expires: new Date(Date.now() + SESSION_MS),
          },
        });
        token.sessionToken = sessionToken;
        token.sub = user.id;
        const profile = await prisma.user.findUnique({
          where: { id: user.id },
          include: { company: true },
        });
        if (profile?.company) {
          const jar = await cookies();
          jar.set("locale", profile.company.locale === "EN" ? "en" : "pt-BR", {
            path: "/",
            sameSite: "lax",
            httpOnly: true,
          });
        }
      }
      return token;
    },
    async session({ session, token }) {
      const sessionToken = typeof token.sessionToken === "string" ? token.sessionToken : undefined;
      if (!sessionToken) {
        return session;
      }
      const stored = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!stored || stored.expires < new Date()) {
        session.user.id = "";
        return session;
      }
      session.sessionToken = sessionToken;
      session.user.id = stored.user.id;
      session.user.email = stored.user.email;
      session.user.name = stored.user.name;
      return session;
    },
  },
});
