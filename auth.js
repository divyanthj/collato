import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { MongoWorkspaceAuthAdapter } from "@/lib/auth-adapter";
import { getResendFromAddress, sendAuthMagicLinkEmail } from "@/lib/resend";

export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: process.env.AUTH_SECRET ?? "collato-dev-secret-change-me",
    trustHost: true,
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
            allowDangerousEmailAccountLinking: true,
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
        })
    ],
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.sub = user.id ?? token.sub;
                token.email = user.email ?? token.email;
                token.name = user.name ?? token.name;
                token.picture = user.image ?? token.picture;
            }

            if (trigger === "update" && session?.user) {
                token.email = session.user.email ?? token.email;
                token.name = session.user.name ?? token.name;
                token.picture = session.user.image ?? token.picture;
            }

            return token;
        },
        async signIn({ user }) {
            return Boolean(user.email);
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub ?? session.user.id;
                session.user.email = typeof token.email === "string" ? token.email : session.user.email;
                session.user.name = typeof token.name === "string" ? token.name : session.user.name;
                session.user.image = typeof token.picture === "string" ? token.picture : session.user.image;
            }
            return session;
        }
    }
});


