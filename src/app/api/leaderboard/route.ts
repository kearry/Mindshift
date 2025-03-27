import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define the number of top users to fetch for the leaderboard
const LEADERBOARD_LIMIT = 20; // Fetch top 20 users

export async function GET(request: Request) {
    try {
        // Fetch users ordered by totalPoints descending
        const users = await prisma.user.findMany({
            orderBy: {
                totalPoints: 'desc', // Highest points first
            },
            take: LEADERBOARD_LIMIT, // Limit the number of results
            select: {
                userId: true,
                username: true,
                displayName: true,
                profileImageUrl: true, // Include for potential display
                totalPoints: true,
                // Optional: Include rank if it's reliably updated on the User model
                // rank: true,
                // Exclude sensitive fields
            }
        });

        // Optional: Add rank dynamically if not stored in DB
        // const leaderboardData = users.map((user, index) => ({
        //     ...user,
        //     rank: index + 1,
        // }));
        // return NextResponse.json(leaderboardData);

        return NextResponse.json(users); // Return the ordered list

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        // await prisma.$disconnect(); // Manage client lifecycle
    }
}