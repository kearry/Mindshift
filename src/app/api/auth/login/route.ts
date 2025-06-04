import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHmac } from 'crypto';

function base64Url(input: Buffer) {
    return input.toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function signJwt(payload: Record<string, unknown>, secret: string, expiresIn = 3600) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresIn };
    const headerEncoded = base64Url(Buffer.from(JSON.stringify(header)));
    const payloadEncoded = base64Url(Buffer.from(JSON.stringify(body)));
    const data = `${headerEncoded}.${payloadEncoded}`;
    const signature = createHmac('sha256', secret).update(data).digest();
    const signatureEncoded = base64Url(signature);
    return `${data}.${signatureEncoded}`;
}

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
        const token = signJwt({ userId: user.userId, username: user.username }, process.env.JWT_SECRET ?? 'changeme');

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash: _, ...userWithoutPassword } = user;

        const response = NextResponse.json({ message: 'Login successful', token, user: userWithoutPassword });
        response.cookies.set('token', token, { httpOnly: true, path: '/' });
        return response;

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
