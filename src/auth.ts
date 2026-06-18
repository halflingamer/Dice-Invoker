import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import { authPolicy } from "@/auth-policy";
import { prisma } from "@/modules/db/prisma";

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [GitHub],
  session: { strategy: authPolicy.sessionStrategy },
  pages: { signIn: "/" },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
