import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role, StudentType } from "@prisma/client";

// Apply type augmentations
import "@/types/index";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        gymSlug: { label: "Gym Slug", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !credentials?.gymSlug) {
          return null;
        }

        const gym = await prisma.gym.findUnique({
          where: { slug: credentials.gymSlug as string },
        });

        if (!gym) return null;

        const user = await prisma.user.findUnique({
          where: {
            email_gymId: {
              email: credentials.email as string,
              gymId: gym.id,
            },
          },
        });

        if (!user) return null;

        const passwordValid = await compare(
          credentials.password as string,
          user.password
        );

        if (!passwordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          studentType: user.studentType as StudentType,
          gymId: gym.id,
          gymSlug: gym.slug,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id as string;
        (token as Record<string, unknown>).role = user.role as Role;
        (token as Record<string, unknown>).studentType = user.studentType as StudentType;
        (token as Record<string, unknown>).gymId = user.gymId;
        (token as Record<string, unknown>).gymSlug = user.gymSlug;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.sub as string;
        session.user.role = (token as Record<string, unknown>).role as Role;
        session.user.studentType = (token as Record<string, unknown>).studentType as StudentType;
        session.user.gymId = (token as Record<string, unknown>).gymId as string;
        session.user.gymSlug = (token as Record<string, unknown>).gymSlug as string;
      }
      return session;
    },
  },
});
