import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { MongoWorkspaceAuthAdapter } from "@/lib/auth-adapter";
import { getResendFromAddress, sendAuthMagicLinkEmail } from "@/lib/resend";

export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: process.env.AUTH_SECRET ?? "collato-dev-secret-change-me",
    adapter: MongoWorkspaceAuthAdapter(),
    session: {
        strategy: "jwt"
    },
    providers: [
        {
            id: "resend",
            type: "email",
            name: "Email",
            from: getResendFromAddress(),
            maxAge: 24 * 60 * 60,
            async sendVerificationRequest({ identifier, url }) {
                await sendAuthMagicLinkEmail({
                    email: identifier,
                    url
                });
            }
        },
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
        })
    ],
    callbacks: {
        async signIn({ user }) {
            return Boolean(user.email);
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub ?? session.user.id;
            }
            return session;
        }
    }
});


