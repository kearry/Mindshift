import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient();

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            // The name to display on the sign in form (optional)
            name: "Credentials",
            // `credentials` is used to generate a form on the built-in sign-in page.
            // You can specify which fields should be submitted.
            // We will use our own custom login form, so this is less important here.
            credentials: {
                identifier: { label: "Username or Email", type: "text", placeholder: "jsmith@example.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, req) {
                // Add logic here to look up the user from the credentials supplied
                if (!credentials?.identifier || !credentials.password) {
                    console.error("Missing credentials for authorization");
                    return null; // Indicate failure
                }

                let user = null;
                try {
                    // Reuse the logic from your previous login API endpoint
                    user = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { email: credentials.identifier },
                                { username: credentials.identifier },
                            ],
                        },
                    });

                    if (user && user.passwordHash) {
                        // Check password
                        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);

                        if (isPasswordValid) {
                            // Any object returned will be saved in `user` property of the JWT / session
                            // Return only necessary, non-sensitive user info
                            return {
                                id: user.userId.toString(), // Must return id as string
                                name: user.username,
                                email: user.email,
                                // Add any other user properties needed in the session/token
                            };
                        } else {
                            console.error("Invalid password for user:", credentials.identifier);
                            return null; // Password mismatch
                        }
                    } else {
                        console.error("User not found:", credentials.identifier);
                        return null; // User not found
                    }
                } catch (error) {
                    console.error("Authorize error:", error);
                    return null; // Error during authorization
                } finally {
                    await prisma.$disconnect();
                }
            }
        })
        // Add other providers like Google, GitHub etc. here later if needed
    ],
    // Add other NextAuth options if needed:
    // session: { strategy: "jwt" }, // or "database"
    // pages: { signIn: '/login' }, // Redirect to your custom login page
    // callbacks: { ... } // To customize session/token content
});

// Export handlers for GET and POST requests
export { handler as GET, handler as POST };