import { NextAuthOptions, User as NextAuthUser, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient, User as PrismaUser } from '@prisma/client';
import bcrypt from 'bcrypt';
import { JWT } from "next-auth/jwt";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                identifier: { label: "Username or Email", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials): Promise<NextAuthUser | null> {
                if (!credentials?.identifier || !credentials.password) {
                    console.error("Missing credentials for authorization");
                    return null;
                }
                let user: PrismaUser | null = null;
                try {
                    user = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { email: credentials.identifier },
                                { username: credentials.identifier },
                            ],
                        },
                    });
                    if (user && user.passwordHash) {
                        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
                        if (isPasswordValid) {
                            return {
                                id: user.userId.toString(),
                                name: user.username,
                                email: user.email,
                            };
                        } else {
                            console.error("Invalid password for user:", credentials.identifier);
                            return null;
                        }
                    } else {
                        console.error("User not found:", credentials.identifier);
                        return null;
                    }
                } catch (error) {
                    console.error("Authorize error:", error);
                    return null;
                }
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }: { token: JWT; user?: NextAuthUser }): Promise<JWT> {
            if (user?.id) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
            if (token?.id && session?.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt"
    },
};
