import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LEADERBOARD_LIMIT = 20;

// Removed unused 'request' parameter
export async function GET() {
    try {
        const users = await prisma.user.findMany({
            orderBy: { totalPoints: 'desc' },
            take: LEADERBOARD_LIMIT,
            select: { userId: true, username: true, displayName: true, profileImageUrl: true, totalPoints: true, /* rank: true */ }
        });
        return NextResponse.json(users);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}