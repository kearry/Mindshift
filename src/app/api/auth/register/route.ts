import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const saltRounds = 10; // Cost factor for bcrypt

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, email, password } = body;

        // Basic validation (add more robust checks)
        if (!username || !email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] },
        });

        if (existingUser) {
            return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 }); // 409 Conflict
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user in database
        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                passwordHash, // Store the hashed password
            },
        });

        // Don't send password hash back to client
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash: _, ...userWithoutPassword } = newUser;

        return NextResponse.json(userWithoutPassword, { status: 201 }); // 201 Created

    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        await prisma.$disconnect(); // Disconnect Prisma client
    }
}