// src/types/next-auth.d.ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { JWT, DefaultJWT } from "next-auth/jwt";

// Extend JWT type
declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        id?: string;
    }
}

// Extend Session type
declare module "next-auth" {
    interface Session {
        user?: {
            id?: string;
        } & DefaultSession["user"];
    }
    // Optional: Extend User type if you return more from authorize
    // interface User extends DefaultUser {
    //   id: string;
    // }
}