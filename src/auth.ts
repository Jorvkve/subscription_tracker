import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedGoogleAccount } from "@/lib/auth-allowlist";

const allowedGoogleEmails = process.env.ALLOWED_GOOGLE_EMAILS;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
  ],
  pages: { signIn: "/signin" },
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const googleProfile = profile as
        | { email?: string; email_verified?: boolean }
        | undefined;
      return isAllowedGoogleAccount(
        googleProfile?.email,
        googleProfile?.email_verified === true,
        allowedGoogleEmails,
      );
    },
  },
});
