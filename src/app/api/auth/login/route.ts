import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
// You'll likely need a library for session/token management later (e.g., jsonwebtoken or next-auth)

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Allow login with either email or username
        const { identifier, password } = body; // 'identifier' can be email or username

        // Basic validation
        if (!identifier || !password) {
            return NextResponse.json({ error: 'Missing identifier or password' }, { status: 400 });
        }

        // Find user by email or username
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { username: identifier },
                ],
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 }); // Unauthorized
        }

        // Compare provided password with stored hash
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 }); // Unauthorized
        }

        // --- Session/Token Generation ---
        // TODO: Implement session creation or JWT generation here
        // This part is crucial for keeping the user logged in across requests.
        // For now, we'll just return the user data (excluding password) on success.
        // Example using JWT (requires 'jsonwebtoken' library):
        // const token = jwt.sign({ userId: user.userId, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        // return NextResponse.json({ token });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash: _, ...userWithoutPassword } = user;

        // Placeholder success response - replace with session/token logic
        return NextResponse.json({ message: 'Login successful', user: userWithoutPassword });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}